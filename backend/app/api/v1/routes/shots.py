from __future__ import annotations

import asyncio
from datetime import datetime, UTC
from typing import Any

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base import AgentContext, TargetIds
from app.agents.orchestrator import AGENT_STAGE_MAP
from app.agents.storyboard_artist import StoryboardArtistAgent
from app.agents.video_generator import VideoGeneratorAgent
from app.agents.video_merger import VideoMergerAgent
from app.api.deps import SessionDep, SettingsDep, WsManagerDep
from app.config import Settings
from app.db.session import async_session_maker
from app.models.agent_run import AgentRun
from app.models.project import Character, Project, Shot, ShotCharacterBinding
from app.schemas.project import AgentRunRead, RegenerateRequest, ShotRead, ShotUpdate
from app.services.file_cleaner import delete_file
from app.services.image import ImageService
from app.services.llm import LLMService
from app.services.task_manager import task_manager
from app.services.video_factory import create_video_service
from app.ws.manager import ConnectionManager

router = APIRouter()


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _shot_payload(shot: Shot) -> dict[str, Any]:
    return {
        "id": shot.id,
        "project_id": shot.project_id,
        "order": shot.order,
        "description": shot.description,
        "prompt": shot.prompt,
        "image_prompt": shot.image_prompt,
        "image_url": shot.image_url,
        "video_url": shot.video_url,
        "duration": shot.duration,
        "camera": shot.camera,
        "motion_note": shot.motion_note,
        "character_ids": list(shot.character_ids),
        "approval_state": shot.approval_state,
        "approval_version": shot.approval_version,
        "approved_at": shot.approved_at,
        "approved_description": shot.approved_description,
        "approved_prompt": shot.approved_prompt,
        "approved_image_prompt": shot.approved_image_prompt,
        "approved_duration": shot.approved_duration,
        "approved_camera": shot.approved_camera,
        "approved_motion_note": shot.approved_motion_note,
        "approved_character_ids": list(shot.approved_character_ids),
    }


def _validate_shot_approval_ready(shot: Shot) -> None:
    missing = []
    if not shot.description:
        missing.append("description")
    if not shot.prompt:
        missing.append("prompt")
    if not shot.image_prompt:
        missing.append("image_prompt")
    if shot.duration is None:
        missing.append("duration")
    if not shot.camera:
        missing.append("camera")
    if not shot.motion_note:
        missing.append("motion_note")
    if not shot.character_ids:
        missing.append("character_ids")

    if missing:
        raise HTTPException(
            status_code=400,
            detail="Shot approval requires structured intent, duration, camera, motion note, and bound cast",
        )


async def _sync_shot_character_bindings(session: AsyncSession, shot: Shot) -> None:
    await session.execute(
        delete(ShotCharacterBinding).where(ShotCharacterBinding.shot_id == shot.id)
    )
    if shot.character_ids:
        session.add_all(
            [
                ShotCharacterBinding(shot_id=shot.id, character_id=character_id)
                for character_id in shot.character_ids
            ]
        )


async def _validate_shot_character_ids(
    session: AsyncSession, project_id: int, character_ids: list[int]
) -> None:
    if not character_ids:
        return

    res = await session.execute(
        select(Character.id).where(
            Character.project_id == project_id,
            Character.id.in_(character_ids),
        )
    )
    found_ids = {row[0] for row in res.all()}
    missing_ids = [character_id for character_id in character_ids if character_id not in found_ids]
    if missing_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown character_ids for project: {missing_ids}",
        )


async def _run_agent_plan(
    *,
    project_id: int,
    run_id: int,
    agent_plan: list[Any],
    settings: Settings,
    ws: ConnectionManager,
    target_ids: TargetIds | None = None,
) -> None:
    try:
        async with async_session_maker() as session:
            project = await session.get(Project, project_id)
            run = await session.get(AgentRun, run_id)
            if not project or not run:
                return

            ctx = AgentContext(
                settings=settings,
                session=session,
                ws=ws,
                project=project,
                run=run,
                llm=LLMService(settings),
                image=ImageService(settings),
                video=create_video_service(settings),
                target_ids=target_ids,
            )

            await ws.send_event(
                project_id,
                {"type": "run_started", "data": {"run_id": run_id, "project_id": project_id}},
            )

            total_steps = max(len(agent_plan), 1)
            for idx, agent in enumerate(agent_plan):
                progress = idx / total_steps
                run.status = "running"
                run.current_agent = getattr(agent, "name", None)
                run.progress = progress
                run.updated_at = utcnow()
                session.add(run)
                await session.commit()

                await ws.send_event(
                    project_id,
                    {
                        "type": "run_progress",
                        "data": {
                            "run_id": run_id,
                            "current_agent": run.current_agent,
                            "stage": AGENT_STAGE_MAP.get(run.current_agent or "", "ideate"),
                            "progress": progress,
                        },
                    },
                )

                await agent.run(ctx)
                await session.refresh(ctx.project)

            run.status = "succeeded"
            run.current_agent = None
            run.progress = 1.0
            run.updated_at = utcnow()
            session.add(run)
            await session.commit()

            await ws.send_event(project_id, {"type": "run_completed", "data": {"run_id": run_id}})
    except asyncio.CancelledError:
        async with async_session_maker() as cancel_session:
            run = await cancel_session.get(AgentRun, run_id)
            if run and run.status not in ("cancelled", "failed", "succeeded"):
                run.status = "cancelled"
                run.updated_at = utcnow()
                cancel_session.add(run)
                await cancel_session.commit()
        await ws.send_event(project_id, {"type": "run_cancelled", "data": {"run_id": run_id}})
        raise
    except Exception as e:
        async with async_session_maker() as fail_session:
            run = await fail_session.get(AgentRun, run_id)
            if run and run.status not in ("cancelled", "failed", "succeeded"):
                run.status = "failed"
                run.error = str(e)
                run.updated_at = utcnow()
                fail_session.add(run)
                await fail_session.commit()
        await ws.send_event(
            project_id, {"type": "run_failed", "data": {"run_id": run_id, "error": str(e)}}
        )
    finally:
        task_manager.remove(project_id)


@router.put("/{shot_id}", response_model=ShotRead)
@router.patch("/{shot_id}", response_model=ShotRead)
async def update_shot(
    shot_id: int,
    payload: ShotUpdate,
    session: AsyncSession = SessionDep,
    ws: ConnectionManager = WsManagerDep,
):
    shot = await session.get(Shot, shot_id)
    if not shot:
        raise HTTPException(status_code=404, detail="Shot not found")

    project_id = shot.project_id

    data = payload.model_dump(exclude_unset=True)
    character_ids_updated = False
    if "character_ids" in data:
        character_ids = list(
            dict.fromkeys(int(character_id) for character_id in data.pop("character_ids") or [])
        )
        await _validate_shot_character_ids(session, project_id, character_ids)
        shot.character_ids = character_ids
        character_ids_updated = True
    for k, v in data.items():
        setattr(shot, k, v)

    session.add(shot)
    if character_ids_updated:
        await _sync_shot_character_bindings(session, shot)
    await session.commit()
    await session.refresh(shot)

    await ws.send_event(
        project_id,
        {"type": "shot_updated", "data": {"shot": _shot_payload(shot)}},
    )
    return _shot_payload(shot)


@router.post("/{shot_id}/approve", response_model=ShotRead)
async def approve_shot(
    shot_id: int,
    session: AsyncSession = SessionDep,
    ws: ConnectionManager = WsManagerDep,
):
    shot = await session.get(Shot, shot_id)
    if not shot:
        raise HTTPException(status_code=404, detail="Shot not found")

    _validate_shot_approval_ready(shot)
    shot.freeze_approval()
    session.add(shot)
    await session.commit()
    await session.refresh(shot)

    payload = _shot_payload(shot)
    await ws.send_event(
        shot.project_id,
        {"type": "shot_updated", "data": {"shot": payload}},
    )
    return payload


@router.post(
    "/{shot_id}/regenerate", response_model=AgentRunRead, status_code=status.HTTP_201_CREATED
)
async def regenerate_shot(
    shot_id: int,
    payload: RegenerateRequest | None = None,
    session: AsyncSession = SessionDep,
    settings: Settings = SettingsDep,
    ws: ConnectionManager = WsManagerDep,
):
    if payload is None:
        payload = RegenerateRequest(type="video")

    shot = await session.get(Shot, shot_id)
    if not shot:
        raise HTTPException(status_code=404, detail="Shot not found")

    project = await session.get(Project, shot.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project_id = project.id

    # 检查是否有针对该分镜的运行中任务（细粒度锁）
    res = await session.execute(
        select(AgentRun)
        .where(AgentRun.project_id == project_id)
        .where(AgentRun.status.in_(["queued", "running"]))
        .where(AgentRun.resource_type == "shot")
        .where(AgentRun.resource_id == shot_id)
        .limit(1)
    )
    if res.scalars().first() is not None:
        raise HTTPException(status_code=409, detail="This shot is already being regenerated")

    agent_plan: list[Any]
    target_ids = TargetIds(shot_ids=[shot_id])
    if payload.type == "image":
        delete_file(shot.image_url)
        shot.image_url = None
        session.add(shot)
        await session.commit()
        await session.refresh(shot)

        await ws.send_event(
            project_id,
            {"type": "shot_updated", "data": {"shot": _shot_payload(shot)}},
        )

        agent_plan = [StoryboardArtistAgent()]
    else:
        delete_file(shot.video_url)
        shot.video_url = None
        shot.duration = None

        delete_file(project.video_url)
        project.video_url = None

        session.add(shot)
        session.add(project)
        await session.commit()
        await session.refresh(shot)

        await ws.send_event(
            project_id,
            {"type": "shot_updated", "data": {"shot": _shot_payload(shot)}},
        )
        await ws.send_event(
            project_id,
            {"type": "project_updated", "data": {"project": {"id": project_id, "video_url": None}}},
        )

        agent_plan = [VideoGeneratorAgent(), VideoMergerAgent()]

    run = AgentRun(
        project_id=project_id,
        status="running",
        current_agent=getattr(agent_plan[0], "name", None) if agent_plan else None,
        progress=0.0,
        error=None,
        resource_type="shot",  # 设置资源类型
        resource_id=shot_id,  # 设置资源 ID
    )
    session.add(run)
    await session.commit()
    await session.refresh(run)

    task = asyncio.create_task(
        _run_agent_plan(
            project_id=project_id,
            run_id=run.id,
            agent_plan=agent_plan,
            settings=settings,
            ws=ws,
            target_ids=target_ids,
        )
    )
    task_manager.register(project_id, task)
    return AgentRunRead.model_validate(run)


@router.delete("/{shot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shot(
    shot_id: int,
    session: AsyncSession = SessionDep,
    ws: ConnectionManager = WsManagerDep,
):
    shot = await session.get(Shot, shot_id)
    if not shot:
        raise HTTPException(status_code=404, detail="Shot not found")

    project_id = shot.project_id

    # 删除分镜相关文件
    delete_file(shot.image_url)
    delete_file(shot.video_url)

    # 删除项目最终视频（因为分镜变化了）
    project = await session.get(Project, project_id)
    cleared_project_video = False
    if project and project.video_url:
        delete_file(project.video_url)
        project.video_url = None
        session.add(project)
        cleared_project_video = True

    # 删除数据库记录
    await session.delete(shot)
    await session.commit()

    # 发送 WebSocket 事件
    await ws.send_event(project_id, {"type": "shot_deleted", "data": {"shot_id": shot_id}})
    if cleared_project_video:
        await ws.send_event(
            project_id,
            {"type": "project_updated", "data": {"project": {"id": project_id, "video_url": None}}},
        )

    return None

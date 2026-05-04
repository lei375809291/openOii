from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, cast

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from app.agents.base import AgentContext
from app.agents.character_artist import SingleCharacterArtistAgent
from app.agents.orchestrator import AGENT_STAGE_MAP
from app.api.deps import SessionDep, SettingsDep, WsManagerDep
from app.config import Settings
from app.db.session import async_session_maker
from app.models.agent_run import AgentRun
from app.models.project import Character, Project
from app.schemas.project import (
    AgentRunRead,
    CharacterRead,
    CharacterUpdate,
    RegenerateRequest,
)
from app.services.creative_control import (
    apply_character_rerun_edits,
    collect_project_blocking_clips,
    invalidate_character_downstream_outputs,
)
from app.services.file_cleaner import delete_file
from app.services.image import ImageService
from app.services.llm import LLMService
from app.services.task_manager import task_manager
from app.services.video_factory import create_video_service
from app.ws.manager import ConnectionManager

router = APIRouter()


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _require_run_id(run: AgentRun) -> int:
    run_id = run.id
    if run_id is None:
        raise RuntimeError("Persisted AgentRun is missing an id")
    return run_id


def _character_payload(character: Character) -> dict[str, Any]:
    return {
        "id": character.id,
        "project_id": character.project_id,
        "name": character.name,
        "description": character.description,
        "image_url": character.image_url,
        "approval_state": character.approval_state,
        "approval_version": character.approval_version,
        "approved_at": character.approved_at,
        "approved_name": character.approved_name,
        "approved_description": character.approved_description,
        "approved_image_url": character.approved_image_url,
    }


async def _run_agent_plan(
    *,
    project_id: int,
    run_id: int,
    agent_plan: list[Any],
    settings: Settings,
    ws: ConnectionManager,
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

            last_agent_name = getattr(agent_plan[-1], "name", None) if agent_plan else None
            final_stage = AGENT_STAGE_MAP.get(last_agent_name or "", "character")
            await ws.send_event(
                project_id,
                {
                    "type": "run_completed",
                    "data": {"run_id": run_id, "current_stage": final_stage},
                },
            )
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


@router.put("/{character_id}", response_model=CharacterRead)
@router.patch("/{character_id}", response_model=CharacterRead)
async def update_character(
    character_id: int,
    payload: CharacterUpdate,
    session: AsyncSession = SessionDep,
    ws: ConnectionManager = WsManagerDep,
):
    character = await session.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(character, k, v)

    session.add(character)
    await session.commit()
    await session.refresh(character)

    await ws.send_event(
        character.project_id,
        {"type": "character_updated", "data": {"character": _character_payload(character)}},
    )
    return _character_payload(character)


@router.post("/{character_id}/approve", response_model=CharacterRead)
async def approve_character(
    character_id: int,
    session: AsyncSession = SessionDep,
    ws: ConnectionManager = WsManagerDep,
):
    character = await session.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    character.freeze_approval()
    session.add(character)
    await session.commit()
    await session.refresh(character)

    payload = _character_payload(character)
    await ws.send_event(
        character.project_id,
        {"type": "character_updated", "data": {"character": payload}},
    )
    return payload


@router.post(
    "/{character_id}/regenerate",
    response_model=AgentRunRead,
    status_code=status.HTTP_201_CREATED,
)
async def regenerate_character(
    character_id: int,
    payload: RegenerateRequest,
    session: AsyncSession = SessionDep,
    settings: Settings = SettingsDep,
    ws: ConnectionManager = WsManagerDep,
):
    if payload.type != "image":
        raise HTTPException(
            status_code=400, detail="Character regeneration only supports type=image"
        )

    character = await session.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    project = await session.get(Project, character.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project_id = character.project_id

    # 检查是否有针对该角色的运行中任务（细粒度锁）
    project_id_col = cast(InstrumentedAttribute[int], cast(object, AgentRun.project_id))
    status_col = cast(InstrumentedAttribute[str], cast(object, AgentRun.status))
    resource_type_col = cast(
        InstrumentedAttribute[str | None], cast(object, AgentRun.resource_type)
    )
    resource_id_col = cast(InstrumentedAttribute[int | None], cast(object, AgentRun.resource_id))
    res = await session.execute(
        select(AgentRun)
        .where(project_id_col == project_id)
        .where(status_col.in_(("queued", "running")))
        .where(resource_type_col == "character")
        .where(resource_id_col == character_id)
        .limit(1)
    )
    if res.scalars().first() is not None:
        raise HTTPException(status_code=409, detail="This character is already being regenerated")

    await apply_character_rerun_edits(
        session,
        character,
        description=payload.description,
        image_url=payload.image_url,
    )
    await invalidate_character_downstream_outputs(session, project, character_id)
    await session.commit()
    await session.refresh(character)
    await session.refresh(project)
    blocking_clips = await collect_project_blocking_clips(session, project)

    await ws.send_event(
        project_id,
        {"type": "character_updated", "data": {"character": _character_payload(character)}},
    )
    await ws.send_event(
        project_id,
        {
            "type": "project_updated",
            "data": {
                "project": {
                    "id": project_id,
                    "video_url": project.video_url,
                    "status": project.status,
                    "blocking_clips": blocking_clips,
                }
            },
        },
    )

    agent_plan: list[Any] = [SingleCharacterArtistAgent(character_id)]
    run = AgentRun(
        project_id=project_id,
        status="running",
        current_agent=getattr(agent_plan[0], "name", None),
        progress=0.0,
        error=None,
        resource_type="character",  # 设置资源类型
        resource_id=character_id,  # 设置资源 ID
    )
    session.add(run)
    await session.commit()
    await session.refresh(run)
    run_id = _require_run_id(run)

    task = asyncio.create_task(
        _run_agent_plan(
            project_id=project_id,
            run_id=run_id,
            agent_plan=agent_plan,
            settings=settings,
            ws=ws,
        )
    )
    task_manager.register(project_id, task)
    return AgentRunRead.model_validate(run)


@router.delete("/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_character(
    character_id: int,
    session: AsyncSession = SessionDep,
    ws: ConnectionManager = WsManagerDep,
):
    character = await session.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    project_id = character.project_id

    # 删除角色图片文件
    delete_file(character.image_url)

    # 删除数据库记录
    await session.delete(character)
    await session.commit()

    # 发送 WebSocket 事件
    await ws.send_event(
        project_id, {"type": "character_deleted", "data": {"character_id": character_id}}
    )

    return None

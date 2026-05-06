from __future__ import annotations

import asyncio
from typing import Any, cast

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from app.agents.base import TargetIds
from app.agents.render import RenderAgent
from app.api.deps import SessionDep, SettingsDep, WsManagerDep, require_run_id
from app.config import Settings
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
from app.services.agent_runner import run_agent_plan
from app.services.file_cleaner import delete_file
from app.services.task_manager import task_manager
from app.ws.manager import ConnectionManager

router = APIRouter()


def _require_run_id(run: AgentRun) -> int:
    return require_run_id(run)


def _character_read(character: Character) -> dict[str, Any]:
    return CharacterRead.model_validate(character).model_dump(mode="json")


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
        {"type": "character_updated", "data": {"character": _character_read(character)}},
    )
    return _character_read(character)


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

    payload = _character_read(character)
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
        {"type": "character_updated", "data": {"character": _character_read(character)}},
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

    agent_plan: list[Any] = [RenderAgent()]
    target_ids = TargetIds(character_ids=[character_id])
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
        run_agent_plan(
            project_id=project_id,
            run_id=run_id,
            agent_plan=agent_plan,
            settings=settings,
            ws=ws,
            target_ids=target_ids,
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

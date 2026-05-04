from __future__ import annotations

from datetime import datetime
from typing import cast

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from app.api.deps import SessionDep, SettingsDep
from app.config import Settings
from app.db.utils import utcnow
from app.models.message import Message
from app.models.project import Character, Project, Shot
from app.schemas.project import (
     CharacterRead,
     MessageRead,
     ProjectCreate,
     ProjectBatchDeleteRequest,
     ProjectProviderSettingsRead,
     ProjectListRead,
     ProjectRead,
     ProjectUpdate,
     ShotRead,
)
from app.services.file_cleaner import get_local_path
from app.services.project_deletion import delete_project_by_id, delete_projects_by_ids
from app.services.provider_resolution import resolve_project_provider_settings_async

router = APIRouter()


async def _project_provider_settings(project: Project, settings: Settings) -> ProjectProviderSettingsRead:
    return (
        await resolve_project_provider_settings_async(project, settings, probe_mode="cache_only")
    ).as_project_provider_settings()


async def _project_read_model(project: Project, settings: Settings) -> ProjectRead:
    return ProjectRead(
        id=project.id if project.id is not None else 0,
        title=project.title,
        story=project.story,
        style=project.style,
        summary=project.summary,
        video_url=project.video_url,
        status=project.status,
        provider_settings=await _project_provider_settings(project, settings),
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    session: AsyncSession = SessionDep,
    settings: Settings = SettingsDep,
):
    style = (payload.style or "").strip() or "anime"
    project = Project(
        title=payload.title,
        story=payload.story,
        style=style,
        status=payload.status or "draft",
        text_provider_override=payload.text_provider_override,
        image_provider_override=payload.image_provider_override,
        video_provider_override=payload.video_provider_override,
    )
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return await _project_read_model(project, settings)


@router.get("", response_model=ProjectListRead)
async def list_projects(session: AsyncSession = SessionDep, settings: Settings = SettingsDep):
    project_created_at_col = cast(InstrumentedAttribute[datetime], cast(object, Project.created_at))
    res = await session.execute(select(Project).order_by(project_created_at_col.desc()))
    items = res.scalars().all()
    return {
        "items": [await _project_read_model(p, settings) for p in items],
        "total": len(items),
    }


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: int,
    session: AsyncSession = SessionDep,
    settings: Settings = SettingsDep,
):
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return await _project_read_model(project, settings)


@router.get("/{project_id}/final-video")
async def download_final_video(project_id: int, session: AsyncSession = SessionDep):
    project = await session.get(Project, project_id)
    if not project or not project.video_url:
        raise HTTPException(status_code=404, detail="Final video not found")

    path = get_local_path(project.video_url)
    if path is None or not path.exists():
        raise HTTPException(status_code=404, detail="Final video not found")

    return FileResponse(path, filename=path.name)


@router.put("/{project_id}", response_model=ProjectRead)
@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: int,
    payload: ProjectUpdate,
    session: AsyncSession = SessionDep,
    settings: Settings = SettingsDep,
):
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        if k == "style":
            v = (v or "").strip() or "anime"
        setattr(project, k, v)
    project.updated_at = utcnow()
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return await _project_read_model(project, settings)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: int, session: AsyncSession = SessionDep):
    """完全删除项目及所有关联数据（包括文件）"""
    await delete_project_by_id(session, project_id)
    return None


@router.post("/batch-delete", status_code=status.HTTP_204_NO_CONTENT)
async def batch_delete_projects(payload: ProjectBatchDeleteRequest, session: AsyncSession = SessionDep):
    await delete_projects_by_ids(session, payload.ids)
    return None


@router.get("/{project_id}/characters", response_model=list[CharacterRead])
async def list_characters(project_id: int, session: AsyncSession = SessionDep):
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    character_project_id_col = cast(InstrumentedAttribute[int], cast(object, Character.project_id))
    res = await session.execute(select(Character).where(character_project_id_col == project_id))
    return [CharacterRead.model_validate(c) for c in res.scalars().all()]


@router.get("/{project_id}/shots", response_model=list[ShotRead])
async def list_shots(project_id: int, session: AsyncSession = SessionDep):
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    shot_project_id_col = cast(InstrumentedAttribute[int], cast(object, Shot.project_id))
    shot_order_col = cast(InstrumentedAttribute[int], cast(object, Shot.order))
    res = await session.execute(
        select(Shot).where(shot_project_id_col == project_id).order_by(shot_order_col.asc())
    )
    return [ShotRead.model_validate(s) for s in res.scalars().all()]


@router.get("/{project_id}/messages", response_model=list[MessageRead])
async def list_messages(project_id: int, session: AsyncSession = SessionDep):
    """获取项目的所有消息记录"""
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    message_project_id_col = cast(InstrumentedAttribute[int], cast(object, Message.project_id))
    message_created_at_col = cast(InstrumentedAttribute[datetime], cast(object, Message.created_at))
    res = await session.execute(
        select(Message)
        .where(message_project_id_col == project_id)
        .order_by(message_created_at_col.asc())
    )
    return [MessageRead.model_validate(m) for m in res.scalars().all()]

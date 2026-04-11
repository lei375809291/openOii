from __future__ import annotations

from datetime import datetime, timezone
from typing import cast

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from app.api.deps import AdminDep, SessionDep
from app.models.agent_run import AgentMessage, AgentRun
from app.models.message import Message
from app.models.project import Character, Project, Shot
from app.schemas.project import (
    CharacterRead,
    MessageRead,
    ProjectCreate,
    ProjectListRead,
    ProjectRead,
    ProjectUpdate,
    ShotRead,
)
from app.services.file_cleaner import delete_file, delete_files, get_local_path

router = APIRouter()


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def _delete_project_files(session: AsyncSession, project: Project, project_id: int) -> None:
    """删除项目关联的所有文件（视频、角色图片、分镜图片/视频）"""
    # 删除项目最终视频
    delete_file(project.video_url)

    # 删除角色图片
    character_project_id_col = cast(InstrumentedAttribute[int], cast(object, Character.project_id))
    chars_res = await session.execute(
        select(Character).where(character_project_id_col == project_id)
    )
    chars = chars_res.scalars().all()
    delete_files([c.image_url for c in chars])

    # 删除分镜图片和视频
    shot_project_id_col = cast(InstrumentedAttribute[int], cast(object, Shot.project_id))
    shots_res = await session.execute(select(Shot).where(shot_project_id_col == project_id))
    shots = shots_res.scalars().all()
    delete_files([s.image_url for s in shots])
    delete_files([s.video_url for s in shots])


async def _delete_project_data(session: AsyncSession, project_id: int) -> None:
    """删除项目关联的所有数据库记录"""
    # 删除 Message（聊天消息）
    message_project_id_col = cast(InstrumentedAttribute[int], cast(object, Message.project_id))
    await session.execute(delete(Message).where(message_project_id_col == project_id))

    # 删除 AgentMessage（通过 AgentRun 关联）
    agent_run_id_col = cast(InstrumentedAttribute[int | None], cast(object, AgentRun.id))
    agent_run_project_id_col = cast(InstrumentedAttribute[int], cast(object, AgentRun.project_id))
    agent_message_run_id_col = cast(
        InstrumentedAttribute[int | None], cast(object, AgentMessage.run_id)
    )
    run_ids_subq = select(agent_run_id_col).where(agent_run_project_id_col == project_id)
    await session.execute(delete(AgentMessage).where(agent_message_run_id_col.in_(run_ids_subq)))

    # 删除 AgentRun
    await session.execute(delete(AgentRun).where(agent_run_project_id_col == project_id))

    # 删除 Shot
    shot_project_id_col = cast(InstrumentedAttribute[int], cast(object, Shot.project_id))
    await session.execute(delete(Shot).where(shot_project_id_col == project_id))

    # 删除 Character
    character_project_id_col = cast(InstrumentedAttribute[int], cast(object, Character.project_id))
    await session.execute(delete(Character).where(character_project_id_col == project_id))


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(payload: ProjectCreate, session: AsyncSession = SessionDep):
    style = (payload.style or "").strip() or "anime"
    project = Project(
        title=payload.title,
        story=payload.story,
        style=style,
        status=payload.status or "draft",
    )
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return ProjectRead.model_validate(project)


@router.get("", response_model=ProjectListRead)
async def list_projects(session: AsyncSession = SessionDep):
    project_created_at_col = cast(InstrumentedAttribute[datetime], cast(object, Project.created_at))
    res = await session.execute(select(Project).order_by(project_created_at_col.desc()))
    items = res.scalars().all()
    return {"items": [ProjectRead.model_validate(p) for p in items], "total": len(items)}


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(project_id: int, session: AsyncSession = SessionDep):
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectRead.model_validate(project)


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
    project_id: int, payload: ProjectUpdate, session: AsyncSession = SessionDep
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
    return ProjectRead.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: int, session: AsyncSession = SessionDep, _: None = AdminDep):
    """完全删除项目及所有关联数据（包括文件）"""
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # 0. 先取消所有运行中的任务（防止异步任务继续操作）
    agent_run_project_id_col = cast(InstrumentedAttribute[int], cast(object, AgentRun.project_id))
    agent_run_status_col = cast(InstrumentedAttribute[str], cast(object, AgentRun.status))
    await session.execute(
        update(AgentRun)
        .where(agent_run_project_id_col == project_id)
        .where(agent_run_status_col.in_(("queued", "running")))
        .values(status="cancelled")
    )

    # 1. 删除所有关联文件
    await _delete_project_files(session, project, project_id)

    # 2. 删除所有关联数据库记录
    await _delete_project_data(session, project_id)

    # 3. 最后删除 Project
    await session.delete(project)
    await session.commit()
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

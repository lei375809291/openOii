from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from .project import CharacterRead, RecoverySummaryRead, ShotRead


WsEventType = Literal[
    "connected",
    "pong",
    "echo",
    "run_started",
    "run_progress",
    "run_message",
    "run_completed",
    "run_failed",
    "run_awaiting_confirm",  # 等待用户确认
    "run_confirmed",  # 用户已确认
    "run_cancelled",  # 任务已取消
    "agent_handoff",  # Agent 交接
    "character_created",  # 角色创建
    "character_updated",  # 角色更新（图片生成等）
    "character_deleted",  # 角色删除
    "shot_created",  # 分镜创建
    "shot_updated",  # 分镜更新（图片/视频生成等）
    "shot_deleted",  # 分镜删除
    "project_updated",  # 项目更新（视频拼接完成等）
    "data_cleared",  # 数据清理（重新生成时）
]


class RunProgressEventData(BaseModel):
    run_id: int
    project_id: int | None = None
    current_agent: str | None = None
    current_stage: str | None = None
    stage: str | None = None
    next_stage: str | None = None
    progress: float = Field(ge=0.0, le=1.0)
    recovery_summary: RecoverySummaryRead | None = None


class RunAwaitingConfirmEventData(BaseModel):
    run_id: int
    project_id: int | None = None
    agent: str
    gate: str | None = None
    current_stage: str | None = None
    stage: str | None = None
    next_stage: str | None = None
    recovery_summary: RecoverySummaryRead
    preserved_stages: list[str] = Field(default_factory=list)
    message: str | None = None
    completed: str | None = None
    next_step: str | None = None
    question: str | None = None


class RunConfirmedEventData(BaseModel):
    run_id: int
    project_id: int | None = None
    agent: str
    gate: str | None = None
    current_stage: str | None = None
    stage: str | None = None
    next_stage: str | None = None
    recovery_summary: RecoverySummaryRead | None = None


class CharacterUpdatedEventData(BaseModel):
    character: CharacterRead


class ShotUpdatedEventData(BaseModel):
    shot: ShotRead


class ProjectUpdatedPayload(BaseModel):
    id: int
    title: str | None = None
    story: str | None = None
    style: str | None = None
    summary: str | None = None
    video_url: str | None = None
    status: str | None = None


class ProjectUpdatedEventData(BaseModel):
    project: ProjectUpdatedPayload


class WsEvent(BaseModel):
    type: WsEventType
    data: dict[str, Any] = Field(default_factory=dict)

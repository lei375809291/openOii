from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from .project import CharacterRead, RecoverySummaryRead, ShotRead


WsEventType = Literal[
    "connected",
    "pong",
    "echo",
    "error",
    "run_started",
    "run_progress",
    "run_message",
    "run_completed",
    "run_failed",
    "run_awaiting_confirm",
    "run_confirmed",
    "run_cancelled",
    "agent_handoff",
    "character_created",
    "character_updated",
    "character_deleted",
    "shot_created",
    "shot_updated",
    "shot_deleted",
    "project_updated",
    "data_cleared",
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


class RunStartedEventData(BaseModel):
    run_id: int
    project_id: int | None = None
    provider_snapshot: dict[str, Any] | None = None
    current_stage: str | None = None
    stage: str | None = None
    next_stage: str | None = None
    progress: float = Field(ge=0.0, le=1.0, default=0.0)
    current_agent: str | None = None
    recovery_summary: RecoverySummaryRead | None = None
    preserved_stages: list[str] = Field(default_factory=list)


class RunMessageEventData(BaseModel):
    run_id: int | None = None
    project_id: int | None = None
    agent: str | None = None
    role: str | None = None
    content: str = ""
    summary: str | None = None
    progress: float | None = Field(default=None, ge=0.0, le=1.0)
    isLoading: bool | None = None


class RunCompletedEventData(BaseModel):
    run_id: int | None = None
    project_id: int | None = None
    current_stage: str | None = None
    message: str | None = None


class RunFailedEventData(BaseModel):
    run_id: int | None = None
    project_id: int | None = None
    error: str | None = None
    agent: str | None = None
    current_stage: str | None = None


class RunCancelledEventData(BaseModel):
    run_id: int | None = None
    project_id: int | None = None
    run_ids: list[int] | None = None
    cancelled_count: int | None = None


class AgentHandoffEventData(BaseModel):
    from_agent: str
    to_agent: str
    message: str | None = None


class DataClearedEventData(BaseModel):
    cleared_types: list[str] = Field(default_factory=list)
    start_agent: str | None = None
    mode: str | None = None


class ErrorEventData(BaseModel):
    code: str
    message: str


class CharacterCreatedEventData(BaseModel):
    character: CharacterRead


class CharacterDeletedEventData(BaseModel):
    character_id: int


class ShotCreatedEventData(BaseModel):
    shot: ShotRead


class ShotDeletedEventData(BaseModel):
    shot_id: int


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
    blocking_clips: list[dict[str, Any]] | None = None


class ProjectUpdatedEventData(BaseModel):
    project: ProjectUpdatedPayload


class WsEvent(BaseModel):
    type: WsEventType
    data: dict[str, Any] = Field(default_factory=dict)

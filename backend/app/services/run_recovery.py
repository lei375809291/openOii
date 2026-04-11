from __future__ import annotations

from collections.abc import Sequence
from types import SimpleNamespace
from typing import Any, Literal, cast

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_run import AgentRun
from app.models.artifact import Artifact
from app.models.stage import Stage
from app.orchestration import build_phase2_graph, get_checkpoint_history
from app.orchestration.persistence import build_postgres_checkpointer
from app.schemas.project import (
    AgentRunRead,
    RecoveryControlRead,
    RecoveryStageRead,
    RecoverySummaryRead,
)


PHASE2_STAGE_ORDER: tuple[str, ...] = (
    "ideate",
    "script",
    "character",
    "character_approval",
    "storyboard",
    "storyboard_approval",
    "clip",
    "merge",
    "review",
)

AGENT_TO_STAGE: dict[str, str] = {
    "onboarding": "ideate",
    "director": "ideate",
    "scriptwriter": "script",
    "character_artist": "character",
    "storyboard_artist": "storyboard",
    "video_generator": "clip",
    "video_merger": "merge",
    "review": "review",
}


def _thread_id_for_run(run: AgentRun) -> str:
    return f"agent-run-{run.id}" if run.id is not None else "agent-run-pending"


def _stage_index(stage: str | None) -> int:
    if not isinstance(stage, str) or stage not in PHASE2_STAGE_ORDER:
        return 0
    return PHASE2_STAGE_ORDER.index(stage)


def _next_stage(stage: str | None) -> str | None:
    index = _stage_index(stage)
    next_index = index + 1
    if next_index >= len(PHASE2_STAGE_ORDER):
        return None
    return PHASE2_STAGE_ORDER[next_index]


def _safe_stage_name(value: Any) -> str | None:
    if isinstance(value, str) and value in PHASE2_STAGE_ORDER:
        return value
    return None


def _stage_from_snapshot(snapshot: Any) -> str | None:
    values = getattr(snapshot, "values", None)
    if not isinstance(values, dict):
        return None
    current_stage = _safe_stage_name(values.get("current_stage"))
    if current_stage is not None:
        return current_stage
    route_stage = _safe_stage_name(values.get("route_stage"))
    if route_stage is not None:
        return route_stage
    stage_history = values.get("stage_history")
    if isinstance(stage_history, list):
        for entry in reversed(stage_history):
            stage_name = _safe_stage_name(entry)
            if stage_name is not None:
                return stage_name
    return None


async def _checkpoint_history(database_url: str, run: AgentRun) -> list[Any]:
    if run.id is None:
        return []
    try:
        async with build_postgres_checkpointer(database_url) as checkpointer:
            compiled_graph = build_phase2_graph().compile(checkpointer=cast(Any, checkpointer))
            graph_run = cast(Any, SimpleNamespace(id=run.id, thread_id=_thread_id_for_run(run)))
            return get_checkpoint_history(compiled_graph, graph_run, limit=8)
    except Exception:
        return []


async def _stage_artifact_counts(session: AsyncSession, run_id: int | None) -> dict[str, int]:
    if run_id is None:
        return {}
    result = await session.execute(
        select(Stage.name, func.count(Artifact.id))
        .join(Artifact, Artifact.stage_id == Stage.id, isouter=True)
        .where(Stage.run_id == run_id)
        .group_by(Stage.name)
    )
    return {name: int(count or 0) for name, count in result.all()}


def _infer_current_stage(run: AgentRun, snapshots: Sequence[Any]) -> str:
    latest_stage = None
    for snapshot in snapshots:
        latest_stage = _stage_from_snapshot(snapshot)
        if latest_stage is not None:
            break

    if latest_stage is not None:
        return latest_stage

    mapped_stage = AGENT_TO_STAGE.get(run.current_agent or "")
    if mapped_stage is not None:
        return mapped_stage

    return "ideate"


async def build_recovery_summary(
    *,
    session: AsyncSession,
    database_url: str,
    run: AgentRun,
) -> RecoverySummaryRead:
    run_pk = run.id or 0
    snapshots = await _checkpoint_history(database_url, run)
    current_stage = _infer_current_stage(run, snapshots)
    next_stage = _next_stage(current_stage)
    artifact_counts = await _stage_artifact_counts(session, run_pk)

    current_index = _stage_index(current_stage)
    stage_history = [
        RecoveryStageRead(
            name=stage,
            status="current"
            if stage == current_stage
            else "completed"
            if index < current_index
            else "pending",
            artifact_count=artifact_counts.get(stage, 0),
        )
        for index, stage in enumerate(PHASE2_STAGE_ORDER)
    ]

    preserved_stages = [stage.name for stage in stage_history if stage.status == "completed"]

    return RecoverySummaryRead(
        project_id=run.project_id,
        run_id=run_pk,
        thread_id=_thread_id_for_run(run),
        current_stage=current_stage,
        next_stage=next_stage,
        preserved_stages=preserved_stages,
        stage_history=stage_history,
        resumable=run.status in {"queued", "running", "failed", "cancelled"},
    )


async def build_recovery_control_surface(
    *,
    session: AsyncSession,
    database_url: str,
    run: AgentRun,
    state: Literal["active", "recoverable"],
) -> RecoveryControlRead:
    summary = await build_recovery_summary(session=session, database_url=database_url, run=run)
    detail = (
        "Project already has an active run" if state == "active" else "Project has a resumable run"
    )
    return RecoveryControlRead(
        state=state,
        detail=detail,
        thread_id=summary.thread_id,
        active_run=AgentRunRead.model_validate(run),
        recovery_summary=summary,
    )

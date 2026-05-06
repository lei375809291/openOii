from __future__ import annotations

from dataclasses import dataclass
from operator import add
from typing import Annotated, Any, Literal, TypedDict


Phase2Stage = Literal[
    "plan",
    "plan_approval",
    "character",
    "character_approval",
    "shot",
    "shot_approval",
    "compose",
    "review",
]

PRODUCTION_STAGE_SEQUENCE: tuple[str, ...] = (
    "plan",
    "character",
    "shot",
    "compose",
)


def next_production_stage(stage: str | None) -> str | None:
    if not isinstance(stage, str):
        return None
    base = stage.removesuffix("_approval")
    if base not in PRODUCTION_STAGE_SEQUENCE:
        return None
    next_index = PRODUCTION_STAGE_SEQUENCE.index(base) + 1
    if next_index >= len(PRODUCTION_STAGE_SEQUENCE):
        return None
    return PRODUCTION_STAGE_SEQUENCE[next_index]


def workflow_progress_for_stage(stage: str, *, within_stage: float = 0.0) -> float:
    base = stage.removesuffix("_approval")
    if base not in PRODUCTION_STAGE_SEQUENCE:
        return 0.0

    clamped_within = max(0.0, min(within_stage, 1.0))
    stage_index = PRODUCTION_STAGE_SEQUENCE.index(base)
    total = len(PRODUCTION_STAGE_SEQUENCE)
    return min((stage_index + clamped_within) / total, 1.0)


class Phase2State(TypedDict, total=False):
    project_id: int
    run_id: int
    thread_id: str
    current_stage: str
    next_stage: str
    stage_history: Annotated[list[str], add]
    approval_history: Annotated[list[str], add]
    artifact_lineage: Annotated[list[str], add]
    approval_feedback: str
    review_requested: bool
    route_stage: str
    route_mode: str


@dataclass(slots=True)
class Phase2RuntimeContext:
    orchestrator: Any
    agent_context: Any
    start_stage: Phase2Stage = "plan"
    auto_mode: bool = False

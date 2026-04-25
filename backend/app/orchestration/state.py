from __future__ import annotations

from dataclasses import dataclass
from operator import add
from typing import Annotated, Any, Literal, TypedDict


Phase2Stage = Literal[
    "ideate",
    "ideate_approval",
    "script",
    "script_approval",
    "character",
    "character_approval",
    "storyboard",
    "storyboard_approval",
    "clip",
    "clip_approval",
    "merge",
    "review",
]


PRODUCTION_STAGE_SEQUENCE: tuple[str, ...] = (
    "ideate",
    "script",
    "character",
    "storyboard",
    "clip",
    "merge",
)


def next_production_stage(stage: str | None) -> str | None:
    if not isinstance(stage, str) or stage not in PRODUCTION_STAGE_SEQUENCE:
        return None
    next_index = PRODUCTION_STAGE_SEQUENCE.index(stage) + 1
    if next_index >= len(PRODUCTION_STAGE_SEQUENCE):
        return None
    return PRODUCTION_STAGE_SEQUENCE[next_index]


def workflow_progress_for_stage(stage: str, *, within_stage: float = 0.0) -> float:
    if stage not in PRODUCTION_STAGE_SEQUENCE:
        return 0.0

    clamped_within = max(0.0, min(within_stage, 1.0))
    stage_index = PRODUCTION_STAGE_SEQUENCE.index(stage)
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
    start_stage: Phase2Stage = "ideate"
    auto_mode: bool = False

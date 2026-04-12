from __future__ import annotations

from dataclasses import dataclass
from operator import add
from typing import Annotated, Any, Literal, TypedDict


Phase2Stage = Literal[
    "ideate",
    "script",
    "character",
    "character_approval",
    "storyboard",
    "storyboard_approval",
    "clip",
    "merge",
    "review",
]


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

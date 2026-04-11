from __future__ import annotations

from operator import add
from typing import Annotated, get_args, get_origin, get_type_hints

from app.models.run import Run


def test_phase2_state_contract_uses_thread_id_and_stage_history_reducer() -> None:
    from app.orchestration.state import Phase2State

    hints = get_type_hints(Phase2State, include_extras=True)

    assert hints["project_id"] is int
    assert hints["run_id"] is int
    assert hints["thread_id"] is str
    assert hints["current_stage"] is str

    stage_history_hint = hints["stage_history"]
    assert get_origin(stage_history_hint) is Annotated
    assert get_args(stage_history_hint)[1] is add

    assert "shot_id" not in hints
    assert "artifact_id" not in hints


def test_phase2_runtime_config_uses_persisted_run_thread_id() -> None:
    from app.orchestration.runtime import build_graph_config

    run = Run(project_id=7, thread_id="thread-7")

    assert build_graph_config(run) == {"configurable": {"thread_id": "thread-7"}}


def test_phase2_graph_exports_durable_entrypoints() -> None:
    import app.orchestration as orchestration

    assert callable(orchestration.build_phase2_graph)
    assert orchestration.phase2_graph is not None

    compiled = orchestration.build_phase2_graph().compile()

    assert compiled is not None

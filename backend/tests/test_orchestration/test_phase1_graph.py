from __future__ import annotations

from operator import add
from typing import Annotated, get_args, get_type_hints, get_origin

from app.models.run import Run


def test_phase1_state_contract_uses_explicit_ids_and_reducer_backed_notes() -> None:
    from app.orchestration.state import Phase1State

    hints = get_type_hints(Phase1State, include_extras=True)

    assert hints["project_id"] is int
    assert hints["run_id"] is int
    assert hints["thread_id"] is str

    notes_hint = hints["notes"]
    assert get_origin(notes_hint) is Annotated
    assert get_args(notes_hint)[1] is add


def test_runtime_config_uses_persisted_run_thread_id() -> None:
    from app.orchestration.runtime import build_graph_config

    run = Run(project_id=7, thread_id="thread-7")

    assert build_graph_config(run) == {"configurable": {"thread_id": "thread-7"}}


def test_phase1_graph_compiles_without_legacy_orchestrator() -> None:
    from app.orchestration.graph import build_phase1_graph

    graph = build_phase1_graph()
    compiled = graph.compile()

    assert compiled is not None


def test_phase1_graph_merges_notes_with_reducer() -> None:
    from app.orchestration.graph import build_phase1_graph

    compiled = build_phase1_graph().compile()

    result = compiled.invoke(
        {
            "project_id": 7,
            "run_id": 11,
            "thread_id": "thread-11",
            "notes": ["seed"],
        }
    )

    assert result["notes"] == ["seed", "phase-1:7:11"]


def test_orchestration_package_exports_phase1_entrypoints() -> None:
    import app.orchestration as orchestration

    assert orchestration.Phase1State is not None
    assert callable(orchestration.build_graph_config)
    assert callable(orchestration.build_phase1_graph)

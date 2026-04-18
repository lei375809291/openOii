from __future__ import annotations

from operator import add
from typing import Annotated, get_args, get_type_hints, get_origin

from app.models.run import Run


def test_phase2_state_contract_uses_expected_types() -> None:
    from app.orchestration.state import Phase2State

    hints = get_type_hints(Phase2State, include_extras=True)

    assert hints["project_id"] is int
    assert hints["run_id"] is int
    assert hints["thread_id"] is str

    notes_hint = hints["stage_history"]
    assert get_origin(notes_hint) is Annotated
    assert get_args(notes_hint)[1] is add


def test_runtime_config_uses_persisted_run_thread_id() -> None:
    from app.orchestration.runtime import build_graph_config

    run = Run(project_id=7, thread_id="thread-7")

    assert build_graph_config(run) == {"configurable": {"thread_id": "thread-7"}}


def test_phase2_graph_compiles_without_legacy_orchestrator() -> None:
    from app.orchestration.graph import build_phase2_graph

    graph = build_phase2_graph()
    compiled = graph.compile()

    assert compiled is not None


def test_phase2_graph_declares_expected_nodes() -> None:
    from app.orchestration.graph import build_phase2_graph

    compiled = build_phase2_graph().compile()
    node_names = set(compiled.get_graph().nodes.keys())

    assert {
        "ideate",
        "ideate_approval",
        "script",
        "script_approval",
        "character",
        "character_approval",
        "storyboard",
        "storyboard_approval",
        "review",
        "clip",
        "clip_approval",
        "merge",
    }.issubset(node_names)


def test_orchestration_package_exports_phase2_entrypoints() -> None:
    import app.orchestration as orchestration

    assert orchestration.Phase2State is not None
    assert callable(orchestration.build_graph_config)
    assert callable(orchestration.build_phase2_graph)

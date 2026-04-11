from __future__ import annotations

from typing import get_type_hints


def test_phase2_recovery_contract_is_stage_granular_only() -> None:
    from app.orchestration.state import Phase2State

    hints = get_type_hints(Phase2State, include_extras=True)

    assert "thread_id" in hints
    assert "current_stage" in hints
    assert "stage_history" in hints
    assert "shot_id" not in hints
    assert "artifact_id" not in hints
    assert "asset_id" not in hints


def test_phase2_recovery_contract_exposes_resume_from_last_valid_stage() -> None:
    from app.orchestration.graph import build_phase2_graph

    compiled = build_phase2_graph().compile()

    assert hasattr(compiled, "get_state_history")
    assert hasattr(compiled, "update_state")

from __future__ import annotations

from types import SimpleNamespace

import pytest
from typing import get_type_hints

from app.agents.orchestrator import GenerationOrchestrator
from app.schemas.project import RecoverySummaryRead
from tests.factories import create_project, create_run


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


@pytest.mark.asyncio
async def test_resume_from_recovery_uses_run_provider_snapshot(test_session, test_settings, monkeypatch):
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id, status="failed")
    run.provider_snapshot = {
        "text": {"selected_key": "openai", "source": "project", "valid": True, "status": "valid"},
        "image": {"selected_key": "openai", "source": "default", "valid": True, "status": "valid"},
        "video": {"selected_key": "openai", "source": "default", "valid": True, "status": "valid"},
    }
    project.text_provider_override = "anthropic"
    await test_session.commit()

    captured = {"text_provider": None, "video_provider": None}

    def _fake_text_service(settings):
        captured["text_provider"] = settings.text_provider
        return SimpleNamespace()

    def _fake_video_service(settings):
        captured["video_provider"] = settings.video_provider
        return SimpleNamespace()

    class _DummyCompiledGraph:
        def get_state_history(self, *_args, **_kwargs):
            return []

        def compile(self, *_args, **_kwargs):
            return self

    class _DummyCheckpointer:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_exc):
            return None

    def _noop_graph_context(_database_url: str):
        return _DummyCheckpointer()

    async def _fake_recovery_summary(*, session, database_url, run):
        return RecoverySummaryRead(
            project_id=run.project_id,
            run_id=run.id or 0,
            thread_id=f"agent-run-{run.id}",
            current_stage="ideate",
            next_stage="script",
            preserved_stages=[],
            stage_history=[],
            resumable=True,
        )

    async def _noop_invoke_phase2_graph(self, **_kwargs):
        return None

    class _StubWs:
        async def send_event(self, _project_id: int, _event: dict) -> None:
            return None

    monkeypatch.setattr("app.agents.orchestrator.create_text_service", _fake_text_service)
    monkeypatch.setattr("app.agents.orchestrator.create_video_service", _fake_video_service)
    monkeypatch.setattr("app.agents.orchestrator.build_phase2_graph", lambda: _DummyCompiledGraph())
    monkeypatch.setattr("app.agents.orchestrator.build_postgres_checkpointer", _noop_graph_context)
    monkeypatch.setattr("app.agents.orchestrator.build_recovery_summary", _fake_recovery_summary)
    monkeypatch.setattr(GenerationOrchestrator, "_invoke_phase2_graph", _noop_invoke_phase2_graph)
    async def _noop_clear_confirm_event(_: int) -> None:
        return None

    monkeypatch.setattr("app.agents.orchestrator.clear_confirm_event_redis", _noop_clear_confirm_event)

    orchestrator = GenerationOrchestrator(settings=test_settings, ws=_StubWs(), session=test_session)
    await orchestrator.resume_from_recovery(project_id=project.id, run_id=run.id)

    assert captured["text_provider"] == "openai"
    assert captured["video_provider"] == "openai"

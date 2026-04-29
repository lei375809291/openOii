from __future__ import annotations

from operator import add
from types import SimpleNamespace
from typing import Any
from typing import Annotated, get_args, get_origin, get_type_hints

import pytest

from app.config import Settings
from app.models.run import Run
from app.agents.orchestrator import GenerationOrchestrator
from app.orchestration.nodes import _normalize_resume_value
from app.orchestration.nodes import (
    clip_approval_node,
    review_node,
    route_after_review,
    route_after_storyboard_approval,
    route_from_start,
    storyboard_approval_node,
)
from app.orchestration.nodes import (
    _auto_approval_result,
    _approval_result,
    _manual_approval_node,
    route_after_character_approval,
    route_after_clip_approval,
    route_after_ideate_approval,
    route_after_script_approval,
)


class MockWsManager:
    def __init__(self):
        self.events = []

    async def send_event(self, project_id: int, event: dict):
        self.events.append((project_id, event))


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


def test_route_helpers_fall_back_to_expected_stages() -> None:
    assert route_after_ideate_approval({}) == "script"
    assert route_after_script_approval({}) == "character"
    assert route_after_character_approval({}) == "storyboard"
    assert route_after_storyboard_approval({}) == "clip"
    assert route_after_clip_approval({}) == "merge"
    assert route_after_review({}) == "script"
    assert route_from_start({}) == "ideate"


def test_approval_result_helpers_set_review_routing() -> None:
    approved = _approval_result(
        approval_stage="script_approval",
        history_key="script",
        next_stage="character",
        feedback="",
    )
    revised = _approval_result(
        approval_stage="script_approval",
        history_key="script",
        next_stage="character",
        feedback="needs work",
    )
    auto = _auto_approval_result(
        approval_stage="script_approval",
        history_key="script",
        next_stage="character",
    )

    assert approved["route_stage"] == "character"
    assert approved["review_requested"] is False
    assert revised["route_stage"] == "review"
    assert revised["review_requested"] is True
    assert auto["approval_feedback"] == ""


@pytest.mark.asyncio
async def test_manual_approval_node_auto_mode_short_circuits() -> None:
    runtime = SimpleNamespace(context=SimpleNamespace(auto_mode=True))

    result = await _manual_approval_node(
        runtime,
        approval_stage="script_approval",
        history_key="script",
        gate="scriptwriter",
        message="msg",
        next_stage="character",
    )

    assert result["route_stage"] == "character"
    assert result["review_requested"] is False


@pytest.mark.asyncio
async def test_manual_approval_node_normalizes_interrupt_resume(monkeypatch) -> None:
    runtime = SimpleNamespace(context=SimpleNamespace(auto_mode=False))

    monkeypatch.setattr("app.orchestration.nodes.interrupt", lambda payload: {"feedback": "  ok  "})

    result = await _manual_approval_node(
        runtime,
        approval_stage="script_approval",
        history_key="script",
        gate="scriptwriter",
        message="msg",
        next_stage="character",
    )

    assert result["approval_feedback"] == "ok"
    assert result["route_stage"] == "review"


@pytest.mark.asyncio
async def test_manual_approval_node_routes_to_review_when_feedback_present(monkeypatch) -> None:
    runtime = SimpleNamespace(context=SimpleNamespace(auto_mode=False))

    monkeypatch.setattr("app.orchestration.nodes.interrupt", lambda payload: " needs review ")

    result = await _manual_approval_node(
        runtime,
        approval_stage="script_approval",
        history_key="script",
        gate="scriptwriter",
        message="msg",
        next_stage="character",
    )

    assert result["review_requested"] is True
    assert result["route_stage"] == "review"


def test_phase2_graph_exports_durable_entrypoints() -> None:
    import app.orchestration as orchestration

    assert callable(orchestration.build_phase2_graph)
    assert orchestration.phase2_graph is not None

    compiled = orchestration.build_phase2_graph().compile()

    assert compiled is not None


class _NoopAgent:
    def __init__(self, name: str, executed: list[str]) -> None:
        self.name = name
        self._executed = executed

    async def run(self, _ctx: Any) -> None:
        self._executed.append(self.name)


class _Ws:
    async def send_event(self, _project_id: int, _event: dict[str, Any]) -> None:
        return None


class _Orchestrator:
    def __init__(self, executed: list[str]) -> None:
        self.ws = _Ws()
        self.agents = [
            _NoopAgent("onboarding", executed),
            _NoopAgent("director", executed),
            _NoopAgent("scriptwriter", executed),
            _NoopAgent("character_artist", executed),
            _NoopAgent("storyboard_artist", executed),
            _NoopAgent("video_generator", executed),
            _NoopAgent("video_merger", executed),
            _NoopAgent("review", executed),
        ]

    def _agent_index(self, agent_name: str) -> int:
        for index, agent in enumerate(self.agents):
            if agent.name == agent_name:
                return index
        raise ValueError(agent_name)

    async def _set_run(self, run: Any, **fields: Any) -> Any:
        for key, value in fields.items():
            setattr(run, key, value)
        return run


def _initial_state(start_stage: str) -> dict[str, Any]:
    return {
        "project_id": 1,
        "run_id": 1,
        "thread_id": "agent-run-1",
        "current_stage": start_stage,
        "stage_history": [],
        "approval_history": [],
        "artifact_lineage": [],
        "review_requested": False,
        "approval_feedback": "",
        "route_stage": start_stage,
        "route_mode": "full",
    }


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("start_stage", "expected_agents", "expected_gate"),
    [
        ("ideate", ["onboarding", "director"], "director"),
        ("script", ["scriptwriter"], "scriptwriter"),
        ("character", ["character_artist"], "character_artist"),
        ("storyboard", ["storyboard_artist"], "storyboard_artist"),
        ("clip", ["video_generator"], "video_generator"),
    ],
)
async def test_phase2_graph_interrupts_before_advancing_to_next_stage(
    start_stage: str,
    expected_agents: list[str],
    expected_gate: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.orchestration.graph import build_phase2_graph
    from app.orchestration.runtime import build_phase2_runtime_context

    if start_stage == "storyboard":
        async def _allow_clip_generation(*_args: Any, **_kwargs: Any) -> bool:
            return True

        monkeypatch.setattr(
            "app.orchestration.nodes.can_enter_clip_generation",
            _allow_clip_generation,
        )

    executed: list[str] = []
    orchestrator = _Orchestrator(executed)
    runtime_context = build_phase2_runtime_context(
        orchestrator=orchestrator,
        agent_context=SimpleNamespace(
            project=SimpleNamespace(id=1),
            run=SimpleNamespace(id=1, resource_type=None, resource_id=None),
            session=None,
            target_ids=None,
        ),
        start_stage=start_stage,  # type: ignore[arg-type]
        auto_mode=False,
    )

    compiled = build_phase2_graph().compile()
    result = await compiled.ainvoke(
        _initial_state(start_stage),
        {"configurable": {"thread_id": f"thread-{start_stage}"}},
        context=runtime_context,
    )

    assert executed == expected_agents
    interrupts = result.get("__interrupt__") or []
    assert interrupts, "expected approval interrupt before entering next stage"
    interrupt_value = getattr(interrupts[0], "value", None)
    assert interrupt_value["gate"] == expected_gate


@pytest.mark.asyncio
async def test_phase2_graph_auto_skips_clip_merge_when_video_provider_invalid() -> None:
    from app.orchestration.graph import build_phase2_graph
    from app.orchestration.runtime import build_phase2_runtime_context

    executed: list[str] = []
    orchestrator = _Orchestrator(executed)
    runtime_context = build_phase2_runtime_context(
        orchestrator=orchestrator,
        agent_context=SimpleNamespace(
            project=SimpleNamespace(id=1),
            run=SimpleNamespace(
                id=1,
                resource_type=None,
                resource_id=None,
                provider_snapshot={"video": {"valid": False, "selected_key": "openai", "source": "default"}},
            ),
            session=None,
            target_ids=None,
        ),
        start_stage="storyboard",  # type: ignore[arg-type]
        auto_mode=False,
    )

    compiled = build_phase2_graph().compile()
    result = await compiled.ainvoke(
        _initial_state("storyboard"),
        {"configurable": {"thread_id": "thread-storyboard-no-video"}},
        context=runtime_context,
    )

    assert executed == ["storyboard_artist"]
    interrupts = result.get("__interrupt__") or []
    assert not interrupts, "video-provider invalid should auto-skip clip/merge without interrupt"
    assert result.get("current_stage") == "merge"


def test_normalize_resume_value_handles_supported_shapes() -> None:
    assert _normalize_resume_value(None) == ""
    assert _normalize_resume_value("  yes  ") == "yes"
    assert _normalize_resume_value({"feedback": "  fine  "}) == "fine"
    assert _normalize_resume_value({"text": "  ok  "}) == "ok"
    assert _normalize_resume_value(123) == "123"


@pytest.mark.asyncio
async def test_storyboard_approval_routes_to_review_when_clip_not_ready(monkeypatch):
    orchestrator = GenerationOrchestrator(
        settings=Settings(database_url="sqlite+aiosqlite:///:memory:", anthropic_api_key="test", image_api_key="test", video_api_key="test"),
        ws=MockWsManager(),
        session=None,
    )
    project = SimpleNamespace(id=1)
    run = SimpleNamespace(id=2, provider_snapshot={})
    agent_ctx = SimpleNamespace(project=project, run=run, session=SimpleNamespace(), target_ids=None)
    runtime = SimpleNamespace(context=SimpleNamespace(auto_mode=False, orchestrator=orchestrator, agent_context=agent_ctx))
    async def fake_clip_ready(*args, **kwargs):
        return False

    monkeypatch.setattr("app.orchestration.nodes.can_enter_clip_generation", fake_clip_ready)

    state = await storyboard_approval_node({}, runtime)

    assert state["review_requested"] is True
    assert state["route_stage"] == "review"


@pytest.mark.asyncio
async def test_storyboard_approval_video_invalid_auto_routes_to_merge(monkeypatch):
    orchestrator = GenerationOrchestrator(
        settings=Settings(database_url="sqlite+aiosqlite:///:memory:", anthropic_api_key="test", image_api_key="test", video_api_key="test"),
        ws=MockWsManager(),
        session=None,
    )
    project = SimpleNamespace(id=1)
    run = SimpleNamespace(id=2, provider_snapshot={"video": {"valid": False}})
    agent_ctx = SimpleNamespace(project=project, run=run, session=SimpleNamespace(), target_ids=None)
    runtime = SimpleNamespace(context=SimpleNamespace(auto_mode=False, orchestrator=orchestrator, agent_context=agent_ctx))

    state = await storyboard_approval_node({}, runtime)

    assert state["route_stage"] == "merge"


@pytest.mark.asyncio
async def test_clip_approval_video_invalid_auto_routes_to_merge(monkeypatch):
    orchestrator = GenerationOrchestrator(
        settings=Settings(database_url="sqlite+aiosqlite:///:memory:", anthropic_api_key="test", image_api_key="test", video_api_key="test"),
        ws=MockWsManager(),
        session=None,
    )
    project = SimpleNamespace(id=1)
    run = SimpleNamespace(id=2, provider_snapshot={"video": {"valid": False}})
    agent_ctx = SimpleNamespace(project=project, run=run, session=SimpleNamespace(), target_ids=None)
    runtime = SimpleNamespace(context=SimpleNamespace(auto_mode=False, orchestrator=orchestrator, agent_context=agent_ctx))

    state = await clip_approval_node({}, runtime)

    assert state["route_stage"] == "merge"


def test_route_helpers_prefer_route_stage_and_fallbacks():
    assert route_from_start({}) == "ideate"
    assert route_after_review({}) == "script"
    assert route_after_storyboard_approval({}) == "clip"
    assert route_after_storyboard_approval({"review_requested": True}) == "review"


@pytest.mark.asyncio
async def test_review_node_routes_to_scriptwriter_and_cleans_up(monkeypatch):
    orchestrator = GenerationOrchestrator(
        settings=Settings(database_url="sqlite+aiosqlite:///:memory:", anthropic_api_key="test", image_api_key="test", video_api_key="test"),
        ws=MockWsManager(),
        session=SimpleNamespace(refresh=lambda obj: None),
    )
    project = SimpleNamespace(id=1)
    run = SimpleNamespace(id=2)
    agent_ctx = SimpleNamespace(project=project, run=run, session=SimpleNamespace(), user_feedback="keep it short", rerun_mode=None, target_ids=None)
    runtime = SimpleNamespace(context=SimpleNamespace(orchestrator=orchestrator, agent_context=agent_ctx))

    async def review_run(ctx):
        return {"start_agent": "scriptwriter", "mode": "incremental", "target_ids": [1, 2]}

    review_agent = SimpleNamespace(run=review_run)
    orchestrator.agents = [SimpleNamespace(name="scriptwriter"), review_agent]
    monkeypatch.setattr(orchestrator, "_agent_index", lambda name: 1 if name == "review" else 0)

    cleaned = {"called": False}

    async def fake_cleanup(project_id, start_agent, mode="full"):
        cleaned["called"] = True
        cleaned["args"] = (project_id, start_agent, mode)

    monkeypatch.setattr(orchestrator, "_cleanup_for_rerun", fake_cleanup)
    async def fake_refresh(obj):
        return None

    orchestrator.session = SimpleNamespace(refresh=fake_refresh)

    state = await review_node({"approval_feedback": "need shorter"}, runtime)

    assert cleaned["called"] is True
    assert cleaned["args"] == (1, "scriptwriter", "incremental")
    assert state["route_stage"] == "script"
    assert state["route_mode"] == "incremental"

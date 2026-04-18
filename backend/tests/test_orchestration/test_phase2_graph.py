from __future__ import annotations

from operator import add
from types import SimpleNamespace
from typing import Any
from typing import Annotated, get_args, get_origin, get_type_hints

import pytest

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

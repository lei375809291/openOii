from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.agents.orchestrator import (
    GenerationOrchestrator,
    _next_phase2_stage,
    _resume_agent_for_stage,
    _video_generation_skipped_in_result,
    clear_awaiting_payload,
    clear_confirm_event_redis,
    get_awaiting_payload,
    get_awaiting_payload_key,
    get_confirm_channel,
    get_confirm_event_key,
    store_awaiting_payload,
    trigger_confirm_redis,
    wait_for_confirm_redis,
)
from app.config import Settings


class MockWsManager:
    def __init__(self):
        self.events = []

    async def send_event(self, project_id: int, event: dict):
        self.events.append((project_id, event))


class FakeResult:
    def __init__(self, rows=None, scalar=None):
        self._rows = rows or []
        self._scalar = scalar

    def scalars(self):
        return self

    def all(self):
        return self._rows

    def first(self):
        return self._rows[0] if self._rows else None

    def scalar_one_or_none(self):
        return self._scalar


class FakeSession:
    def __init__(self, project=None, run=None, rows=None):
        self.project = project
        self.run = run
        self.rows = rows or []
        self.executed = []
        self.added = []
        self.commits = 0
        self.refreshed = []
        self.rollbacks = 0

    async def execute(self, statement):
        self.executed.append(statement)
        return FakeResult(rows=self.rows, scalar=None)

    async def get(self, model, ident):
        if model.__name__ == "Project":
            return self.project
        if model.__name__ == "AgentRun":
            return self.run
        return None

    async def commit(self):
        self.commits += 1

    async def refresh(self, obj):
        self.refreshed.append(obj)

    async def rollback(self):
        self.rollbacks += 1

    def add(self, obj):
        self.added.append(obj)


class FakeRecovery:
    def __init__(self, next_stage: str | None = None, current_stage: str = "script"):
        self.next_stage = next_stage
        self.current_stage = current_stage
        self.preserved_stages = [current_stage]

    def model_dump(self, mode="json"):
        return {
            "next_stage": self.next_stage,
            "current_stage": self.current_stage,
            "preserved_stages": self.preserved_stages,
        }


class FakeCheckpointerCtx:
    def __init__(self, compiled_graph):
        self.compiled_graph = compiled_graph

    async def __aenter__(self):
        return self.compiled_graph

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakeCompiledGraph:
    def __init__(self, results):
        self.results = list(results)

    async def ainvoke(self, payload, graph_config, context=None):
        if not self.results:
            return {}
        result = self.results.pop(0)
        return result


class TestAgentIndex:
    @pytest.fixture
    def orchestrator(self):
        settings = Settings(
            database_url="sqlite+aiosqlite:///:memory:",
            anthropic_api_key="test",
            image_api_key="test",
            video_api_key="test",
        )
        ws = MockWsManager()
        return GenerationOrchestrator(settings=settings, ws=ws, session=None)

    def test_valid_agent_indices(self, orchestrator):
        assert orchestrator._agent_index("onboarding") == 0
        assert orchestrator._agent_index("director") == 1
        assert orchestrator._agent_index("scriptwriter") == 2
        assert orchestrator._agent_index("character_artist") == 3
        assert orchestrator._agent_index("storyboard_artist") == 4
        assert orchestrator._agent_index("video_generator") == 5
        assert orchestrator._agent_index("video_merger") == 6
        assert orchestrator._agent_index("review") == 7

    def test_invalid_agent_raises(self, orchestrator):
        with pytest.raises(ValueError, match="Unknown agent"):
            orchestrator._agent_index("invalid")


def test_stage_helpers_and_state_building():
    assert _next_phase2_stage(None) is None
    assert _next_phase2_stage("script") == "script_approval"
    assert _resume_agent_for_stage(None) == "scriptwriter"
    assert _resume_agent_for_stage("merge") == "video_merger"
    assert _video_generation_skipped_in_result({"video_generation_skipped": 1}) is True
    assert _video_generation_skipped_in_result([1, 2]) is False
    orchestrator = GenerationOrchestrator(
        settings=Settings(
            database_url="sqlite+aiosqlite:///:memory:",
            anthropic_api_key="test",
            image_api_key="test",
            video_api_key="test",
        ),
        ws=MockWsManager(),
        session=None,
    )
    state = orchestrator._build_phase2_state(project_id=1, run_id=2, thread_id="t1", start_stage="script")
    assert state["current_stage"] == "script"
    assert state["route_stage"] == "script"


@pytest.mark.asyncio
async def test_redis_helpers_round_trip(monkeypatch):
    class FakePubSub:
        async def subscribe(self, channel):
            self.channel = channel

        async def unsubscribe(self, channel):
            self.unsubscribed = channel

        async def close(self):
            self.closed = True

        async def get_message(self, ignore_subscribe_messages=True, timeout=1.0):
            return {"type": "message"}

    class FakeRedis:
        def __init__(self):
            self.values = {}
            self.published = []

        async def set(self, key, value, ex=None):
            self.values[key] = value

        async def get(self, key):
            return self.values.get(key)

        async def delete(self, key):
            self.values.pop(key, None)

        async def publish(self, channel, message):
            self.published.append((channel, message))

        def pubsub(self):
            return FakePubSub()

    fake = FakeRedis()
    async def _get_fake_redis():
        return fake

    monkeypatch.setattr("app.agents.orchestrator.get_redis", _get_fake_redis)

    payload = {"run_id": 1, "project_id": 2}
    await store_awaiting_payload(1, payload)
    assert await get_awaiting_payload(1) == payload
    assert get_awaiting_payload_key(1) == "openoii:awaiting:1"
    assert get_confirm_event_key(1) == "openoii:confirm:1"
    assert get_confirm_channel(1) == "openoii:confirm_channel:1"

    await trigger_confirm_redis(1)
    assert fake.published == [("openoii:confirm_channel:1", "confirm")]

    await clear_confirm_event_redis(1)
    await clear_awaiting_payload(1)


@pytest.mark.asyncio
async def test_wait_for_confirm_redis_returns_true_from_key_and_timeout(monkeypatch):
    class FakePubSub:
        async def subscribe(self, channel):
            self.channel = channel

        async def unsubscribe(self, channel):
            self.unsubscribed = channel

        async def close(self):
            self.closed = True

        async def get_message(self, ignore_subscribe_messages=True, timeout=1.0):
            return None

    class FakeRedis:
        def __init__(self):
            self.values = {get_confirm_event_key(1): "1"}

        async def get(self, key):
            return self.values.get(key)

        async def delete(self, key):
            self.values.pop(key, None)

        def pubsub(self):
            return FakePubSub()

    fake = FakeRedis()
    async def _get_fake_redis():
        return fake

    monkeypatch.setattr("app.agents.orchestrator.get_redis", _get_fake_redis)
    assert await wait_for_confirm_redis(1, timeout=1) is True


@pytest.mark.asyncio
async def test_wait_for_confirm_redis_returns_true_from_pubsub_message(monkeypatch):
    class FakePubSub:
        def __init__(self):
            self.calls = 0

        async def subscribe(self, channel):
            self.channel = channel

        async def unsubscribe(self, channel):
            self.unsubscribed = channel

        async def close(self):
            self.closed = True

        async def get_message(self, ignore_subscribe_messages=True, timeout=1.0):
            self.calls += 1
            return {"type": "message"} if self.calls == 1 else None

    class FakeRedis:
        def __init__(self):
            self.values = {}

        async def get(self, key):
            return self.values.get(key)

        async def delete(self, key):
            self.values.pop(key, None)

        def pubsub(self):
            return FakePubSub()

    fake = FakeRedis()

    async def _get_fake_redis():
        return fake

    monkeypatch.setattr("app.agents.orchestrator.get_redis", _get_fake_redis)
    assert await wait_for_confirm_redis(1, timeout=1) is True


@pytest.mark.asyncio
async def test_wait_for_confirm_redis_times_out(monkeypatch):
    class FakePubSub:
        async def subscribe(self, channel):
            self.channel = channel

        async def unsubscribe(self, channel):
            self.unsubscribed = channel

        async def close(self):
            self.closed = True

        async def get_message(self, ignore_subscribe_messages=True, timeout=1.0):
            return None

    class FakeRedis:
        async def get(self, key):
            return None

        async def delete(self, key):
            return None

        def pubsub(self):
            return FakePubSub()

    fake = FakeRedis()
    async def _get_fake_redis():
        return fake

    monkeypatch.setattr("app.agents.orchestrator.get_redis", _get_fake_redis)
    assert await wait_for_confirm_redis(1, timeout=0) is False


@pytest.mark.asyncio
async def test_cleanup_for_rerun_full_branch(monkeypatch):
    project = SimpleNamespace(id=1)
    session = FakeSession(project=project)
    orchestrator = GenerationOrchestrator(
        settings=Settings(database_url="sqlite+aiosqlite:///:memory:", anthropic_api_key="test", image_api_key="test", video_api_key="test"),
        ws=MockWsManager(),
        session=session,
    )

    called = []
    async def delete_shots(project_id):
        called.append(("shots", project_id))

    async def delete_chars(project_id):
        called.append(("chars", project_id))

    async def clear_chars(project_id):
        called.append(("clear_chars", project_id))

    async def clear_shots(project_id):
        called.append(("clear_shots", project_id))

    async def clear_videos(project_id):
        called.append(("clear_videos", project_id))

    monkeypatch.setattr(orchestrator, "_delete_project_shots", delete_shots)
    monkeypatch.setattr(orchestrator, "_delete_project_characters", delete_chars)
    monkeypatch.setattr(orchestrator, "_clear_character_images", clear_chars)
    monkeypatch.setattr(orchestrator, "_clear_shot_images", clear_shots)
    monkeypatch.setattr(orchestrator, "_clear_shot_videos", clear_videos)

    await orchestrator._cleanup_for_rerun(1, "scriptwriter", mode="full")

    assert ("shots", 1) in called
    assert ("chars", 1) in called
    assert session.commits == 1


@pytest.mark.asyncio
async def test_cleanup_for_rerun_incremental_branch(monkeypatch):
    project = SimpleNamespace(id=1)
    session = FakeSession(project=project)
    orchestrator = GenerationOrchestrator(
        settings=Settings(database_url="sqlite+aiosqlite:///:memory:", anthropic_api_key="test", image_api_key="test", video_api_key="test"),
        ws=MockWsManager(),
        session=session,
    )

    called = []
    async def clear_chars(project_id):
        called.append(("clear_chars", project_id))

    async def clear_shots(project_id):
        called.append(("clear_shots", project_id))

    async def clear_videos(project_id):
        called.append(("clear_videos", project_id))

    monkeypatch.setattr(orchestrator, "_clear_character_images", clear_chars)
    monkeypatch.setattr(orchestrator, "_clear_shot_images", clear_shots)
    monkeypatch.setattr(orchestrator, "_clear_shot_videos", clear_videos)

    await orchestrator._cleanup_for_rerun(1, "storyboard_artist", mode="incremental")

    assert called == [("clear_shots", 1), ("clear_videos", 1)]
    assert session.commits == 1


@pytest.mark.asyncio
async def test_cleanup_for_rerun_unsupported_start_agent_raises():
    orchestrator = GenerationOrchestrator(
        settings=Settings(database_url="sqlite+aiosqlite:///:memory:", anthropic_api_key="test", image_api_key="test", video_api_key="test"),
        ws=MockWsManager(),
        session=FakeSession(project=SimpleNamespace(id=1)),
    )

    with pytest.raises(ValueError, match="Unsupported start_agent"):
        await orchestrator._cleanup_for_rerun(1, "unknown", mode="full")


@pytest.mark.asyncio
async def test_set_run_updates_and_commits():
    run = SimpleNamespace(id=1, updated_at=None)
    session = FakeSession()
    orchestrator = GenerationOrchestrator(
        settings=Settings(database_url="sqlite+aiosqlite:///:memory:", anthropic_api_key="test", image_api_key="test", video_api_key="test"),
        ws=MockWsManager(),
        session=session,
    )

    updated = await orchestrator._set_run(run, status="running", progress=0.5)

    assert updated.status == "running"
    assert updated.progress == 0.5
    assert session.commits == 1
    assert session.refreshed == [run]


@pytest.mark.asyncio
async def test_log_persists_agent_message():
    session = FakeSession()
    orchestrator = GenerationOrchestrator(
        settings=Settings(database_url="sqlite+aiosqlite:///:memory:", anthropic_api_key="test", image_api_key="test", video_api_key="test"),
        ws=MockWsManager(),
        session=session,
    )

    await orchestrator._log(1, agent="orchestrator", role="system", content="hello")

    assert session.commits == 1
    assert session.added[0].content == "hello"
    assert session.added[0].agent == "orchestrator"


@pytest.mark.asyncio
async def test_build_agent_context_uses_provider_snapshot(monkeypatch):
    project = SimpleNamespace(id=1)
    run = SimpleNamespace(id=2, provider_snapshot={"provider": "openai"})
    session = FakeSession(project=project, run=run)
    orchestrator = GenerationOrchestrator(
        settings=Settings(database_url="sqlite+aiosqlite:///:memory:", anthropic_api_key="test", image_api_key="test", video_api_key="test"),
        ws=MockWsManager(),
        session=session,
    )

    ctx = orchestrator._build_agent_context(project=project, run=run, request=SimpleNamespace(notes=""))

    assert ctx.project is project
    assert ctx.run is run


@pytest.mark.asyncio
async def test_invoke_phase2_graph_handles_interrupt_and_completion(monkeypatch):
    project = SimpleNamespace(id=1, status="draft")
    run = SimpleNamespace(id=2)
    session = FakeSession(project=project, run=run)
    ws = MockWsManager()
    orchestrator = GenerationOrchestrator(
        settings=Settings(database_url="sqlite+aiosqlite:///:memory:", anthropic_api_key="test", image_api_key="test", video_api_key="test"),
        ws=ws,
        session=session,
    )

    async def fake_wait_for_confirm(project_id, run_obj, agent_name):
        return "好的"

    monkeypatch.setattr(orchestrator, "_wait_for_confirm", fake_wait_for_confirm)

    compiled_graph = FakeCompiledGraph(
        [
            {"__interrupt__": [SimpleNamespace(value={"gate": "director"})], "video_generation_skipped": True},
            {},
        ]
    )

    result = await orchestrator._invoke_phase2_graph(
        project=project,
        run=run,
        ctx=SimpleNamespace(project=project),
        compiled_graph=compiled_graph,
        graph_config={"configurable": {"thread_id": "t1"}},
        runtime_context=SimpleNamespace(),
        initial_payload={"x": 1},
        auto_mode=False,
    )

    assert result is True
    assert project.status == "ready"


@pytest.mark.asyncio
async def test_run_from_agent_returns_early_when_project_missing():
    session = FakeSession(project=None, run=None)
    orchestrator = GenerationOrchestrator(
        settings=Settings(database_url="sqlite+aiosqlite:///:memory:", anthropic_api_key="test", image_api_key="test", video_api_key="test"),
        ws=MockWsManager(),
        session=session,
    )

    await orchestrator.run_from_agent(project_id=1, run_id=2, request=SimpleNamespace(notes=""), agent_name="scriptwriter")

    assert session.commits == 0


@pytest.mark.asyncio
async def test_run_from_agent_handles_failure_and_sends_failed(monkeypatch):
    project = SimpleNamespace(id=1, status="draft")
    run = SimpleNamespace(id=2, provider_snapshot={})
    session = FakeSession(project=project, run=run)
    ws = MockWsManager()
    orchestrator = GenerationOrchestrator(
        settings=Settings(database_url="sqlite+aiosqlite:///:memory:", anthropic_api_key="test", image_api_key="test", video_api_key="test"),
        ws=ws,
        session=session,
    )

    async def boom(*args, **kwargs):
        raise RuntimeError("boom")

    async def noop_async(*args, **kwargs):
        return None

    monkeypatch.setattr(orchestrator, "_cleanup_for_rerun", boom)
    monkeypatch.setattr(orchestrator, "_agent_index", lambda name: 0)
    monkeypatch.setattr("app.agents.orchestrator.clear_confirm_event_redis", noop_async)
    monkeypatch.setattr("app.agents.orchestrator.clear_awaiting_payload", noop_async)

    await orchestrator.run_from_agent(project_id=1, run_id=2, request=SimpleNamespace(notes=""), agent_name="scriptwriter")

    assert session.rollbacks == 1
    assert ws.events[-1][1]["type"] == "run_failed"


@pytest.mark.asyncio
async def test_resume_from_recovery_happy_path(monkeypatch):
    project = SimpleNamespace(id=1, status="draft")
    run = SimpleNamespace(id=2, provider_snapshot={})
    session = FakeSession(project=project, run=run)
    ws = MockWsManager()
    orchestrator = GenerationOrchestrator(
        settings=Settings(database_url="sqlite+aiosqlite:///:memory:", anthropic_api_key="test", image_api_key="test", video_api_key="test"),
        ws=ws,
        session=session,
    )

    async def fake_recovery(**kwargs):
        return FakeRecovery(next_stage="script", current_stage="script")

    class FakeGraph:
        def compile(self, checkpointer=None):
            return FakeCompiledGraph([{}])

    async def fake_checkpointer(_db):
        return FakeCheckpointerCtx(FakeCompiledGraph([{}]))

    async def fake_build_stage_recovery_config(*args, **kwargs):
        return {"configurable": {"thread_id": "t1"}}

    async def fake_invoke(**kwargs):
        return False

    monkeypatch.setattr("app.agents.orchestrator.build_recovery_summary", fake_recovery)
    monkeypatch.setattr("app.agents.orchestrator.build_postgres_checkpointer", lambda db: FakeCheckpointerCtx(FakeCompiledGraph([{}])))
    monkeypatch.setattr("app.agents.orchestrator.build_phase2_graph", lambda: FakeGraph())
    monkeypatch.setattr("app.agents.orchestrator.build_stage_recovery_config", fake_build_stage_recovery_config)
    monkeypatch.setattr(orchestrator, "_invoke_phase2_graph", fake_invoke)
    monkeypatch.setattr(orchestrator, "_build_agent_context", lambda **kwargs: SimpleNamespace(project=project, run=run, session=session, user_feedback=None))
    async def fake_set_run(run, **fields):
        for key, value in fields.items():
            setattr(run, key, value)
        return run

    async def fake_log(*args, **kwargs):
        return None

    monkeypatch.setattr(orchestrator, "_set_run", fake_set_run)
    monkeypatch.setattr(orchestrator, "_log", fake_log)
    monkeypatch.setattr(orchestrator, "_agent_index", lambda name: 0)
    monkeypatch.setattr("app.agents.orchestrator.clear_confirm_event_redis", lambda run_id: fake_log())
    monkeypatch.setattr("app.agents.orchestrator.clear_awaiting_payload", lambda run_id: fake_log())

    await orchestrator.resume_from_recovery(project_id=1, run_id=2)

    assert ws.events[0][1]["type"] == "run_started"
    assert ws.events[-1][1]["type"] == "run_completed"


@pytest.mark.asyncio
async def test_run_from_agent_happy_path(monkeypatch):
    project = SimpleNamespace(id=1, status="draft")
    run = SimpleNamespace(id=2, provider_snapshot={})
    session = FakeSession(project=project, run=run)
    ws = MockWsManager()
    orchestrator = GenerationOrchestrator(
        settings=Settings(database_url="sqlite+aiosqlite:///:memory:", anthropic_api_key="test", image_api_key="test", video_api_key="test"),
        ws=ws,
        session=session,
    )

    ctx = SimpleNamespace(project=project, run=run, session=session, user_feedback=None, rerun_mode=None, target_ids=None)
    monkeypatch.setattr(orchestrator, "_build_agent_context", lambda **kwargs: ctx)
    async def noop_async(*args, **kwargs):
        return None

    async def run_phase2_graph(**kwargs):
        return False

    async def set_run(run, **fields):
        return run

    monkeypatch.setattr(orchestrator, "_cleanup_for_rerun", noop_async)
    monkeypatch.setattr(orchestrator, "_run_phase2_graph", run_phase2_graph)
    monkeypatch.setattr(orchestrator, "_set_run", set_run)
    monkeypatch.setattr(orchestrator, "_log", noop_async)
    monkeypatch.setattr(orchestrator, "_agent_index", lambda name: 0)
    monkeypatch.setattr("app.agents.orchestrator.clear_confirm_event_redis", noop_async)
    monkeypatch.setattr("app.agents.orchestrator.clear_awaiting_payload", noop_async)

    await orchestrator.run_from_agent(project_id=1, run_id=2, request=SimpleNamespace(notes=""), agent_name="scriptwriter")

    assert ws.events[0][1]["type"] == "run_started"
    assert ws.events[-1][1]["type"] == "run_completed"


@pytest.mark.asyncio
async def test_run_from_agent_review_branch(monkeypatch):
    project = SimpleNamespace(id=1, status="draft")
    run = SimpleNamespace(id=2, provider_snapshot={})
    session = FakeSession(project=project, run=run)
    ws = MockWsManager()
    orchestrator = GenerationOrchestrator(
        settings=Settings(database_url="sqlite+aiosqlite:///:memory:", anthropic_api_key="test", image_api_key="test", video_api_key="test"),
        ws=ws,
        session=session,
    )

    ctx = SimpleNamespace(project=project, run=run, session=session, user_feedback=None, rerun_mode=None, target_ids=None)
    async def fake_review_run(_ctx):
        _ctx.rerun_mode = "incremental"
        _ctx.user_feedback = "notes"
        return {"start_agent": "scriptwriter", "mode": "incremental"}

    monkeypatch.setattr(orchestrator, "_build_agent_context", lambda **kwargs: ctx)
    async def noop_async(*args, **kwargs):
        return None

    async def run_phase2_graph(**kwargs):
        return False

    async def set_run(run, **fields):
        return run

    monkeypatch.setattr(orchestrator, "_cleanup_for_rerun", noop_async)
    monkeypatch.setattr(orchestrator, "_run_phase2_graph", run_phase2_graph)
    monkeypatch.setattr(orchestrator, "_set_run", set_run)
    monkeypatch.setattr(orchestrator, "_log", noop_async)
    monkeypatch.setattr(orchestrator, "_agent_index", lambda name: 0)
    monkeypatch.setattr(orchestrator.agents[0], "run", fake_review_run)
    monkeypatch.setattr("app.agents.orchestrator.clear_confirm_event_redis", noop_async)
    monkeypatch.setattr("app.agents.orchestrator.clear_awaiting_payload", noop_async)

    await orchestrator.run_from_agent(project_id=1, run_id=2, request=SimpleNamespace(notes="notes"), agent_name="review")

    assert ctx.user_feedback == "notes"
    assert ctx.rerun_mode == "incremental"

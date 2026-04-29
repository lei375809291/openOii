from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.db import session as session_module


def test_patch_aiosqlite_event_loop_noop_when_module_missing(monkeypatch):
    monkeypatch.setattr(session_module, "aiosqlite", None, raising=False)

    session_module._patch_aiosqlite_event_loop()


def test_patch_aiosqlite_event_loop_handles_import_error(monkeypatch):
    def fake_import(name):
        raise ImportError(name)

    monkeypatch.setattr(session_module, "__import__", fake_import, raising=False)

    session_module._patch_aiosqlite_event_loop()


def test_build_engine_uses_current_settings(monkeypatch):
    fake_settings = SimpleNamespace(database_url="sqlite+aiosqlite:///:memory:", db_echo=True)
    monkeypatch.setattr(session_module, "get_settings", lambda: fake_settings)

    engine = session_module._build_engine()

    assert str(engine.url) == "sqlite+aiosqlite:///:memory:"


@pytest.mark.asyncio
async def test_init_db_runs_create_all_and_config(monkeypatch):
    calls = {"create_all": False, "ensure_initialized": False, "apply_overrides": False, "checkpointer": False}

    class FakeConn:
        async def run_sync(self, fn):
            calls["create_all"] = True

    class FakeEngineBegin:
        async def __aenter__(self):
            return FakeConn()

        async def __aexit__(self, exc_type, exc, tb):
            return False

    class FakeEngine:
        def begin(self):
            return FakeEngineBegin()

    class FakeConfigService:
        def __init__(self, session):
            self.session = session

        async def ensure_initialized(self):
            calls["ensure_initialized"] = True

        async def apply_settings_overrides(self):
            calls["apply_overrides"] = True

    class FakeSessionCtx:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def execute(self, *args, **kwargs):
            return None

        async def commit(self):
            return None

    monkeypatch.setattr(session_module, "engine", FakeEngine())
    monkeypatch.setattr(session_module, "async_session_maker", lambda: FakeSessionCtx())
    monkeypatch.setattr(session_module, "get_settings", lambda: SimpleNamespace(database_url="sqlite+aiosqlite:///:memory:"))
    monkeypatch.setattr("app.services.config_service.ConfigService", FakeConfigService)
    async def fake_checkpointer(url):
        calls["checkpointer"] = True

    monkeypatch.setattr(session_module, "ensure_postgres_checkpointer_setup", fake_checkpointer)

    await session_module.init_db()

    assert calls == {
        "create_all": True,
        "ensure_initialized": True,
        "apply_overrides": True,
        "checkpointer": True,
    }


@pytest.mark.asyncio
async def test_get_session_yields_async_session():
    async for session in session_module.get_session():
        assert session is not None
        break

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_build_postgres_checkpointer_normalizes_asyncpg_sqlalchemy_url_without_setup(monkeypatch):
    import app.orchestration.persistence as persistence

    captured: dict[str, object] = {"setup_calls": 0}

    class _DummyCheckpointer:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def setup(self):
            captured["setup_calls"] = int(captured["setup_calls"]) + 1

    def _fake_from_conn_string(conn_str: str):
        captured["conn_str"] = conn_str
        return _DummyCheckpointer()

    monkeypatch.setattr(
        persistence.AsyncPostgresSaver,
        "from_conn_string",
        staticmethod(_fake_from_conn_string),
    )

    async with persistence.build_postgres_checkpointer(
        "postgresql+asyncpg://openoii:openoii_dev@localhost:55432/openoii"
    ):
        pass

    assert captured["conn_str"] == "postgresql://openoii:openoii_dev@localhost:55432/openoii"
    assert captured["setup_calls"] == 0


@pytest.mark.asyncio
async def test_ensure_postgres_checkpointer_setup_runs_once_per_connection(monkeypatch):
    import app.orchestration.persistence as persistence

    persistence._checkpointer_setup_states.clear()
    persistence._checkpointer_setup_locks.clear()

    captured: dict[str, object] = {"execute_calls": 0, "close_calls": 0}

    class _DummyConn:
        async def execute(self, statement: str):
            captured["execute_calls"] = int(captured["execute_calls"]) + 1

        async def close(self):
            captured["close_calls"] = int(captured["close_calls"]) + 1

    async def _fake_connect(conn_str: str):
        captured.setdefault("conn_strs", []).append(conn_str)
        return _DummyConn()

    monkeypatch.setattr(
        persistence.asyncpg,
        "connect",
        _fake_connect,
    )

    database_url = "postgresql+asyncpg://openoii:openoii_dev@localhost:55432/openoii"
    await persistence.ensure_postgres_checkpointer_setup(database_url)
    await persistence.ensure_postgres_checkpointer_setup(database_url)

    assert captured["conn_strs"] == ["postgresql://openoii:openoii_dev@localhost:55432/openoii"]
    assert captured["execute_calls"] == len(persistence._BOOTSTRAP_STATEMENTS)
    assert captured["close_calls"] == 1

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_build_postgres_checkpointer_normalizes_asyncpg_sqlalchemy_url(monkeypatch):
    import app.orchestration.persistence as persistence

    captured: dict[str, str] = {}

    class _DummyCheckpointer:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def setup(self):
            return None

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

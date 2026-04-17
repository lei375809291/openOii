from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver


def _normalize_checkpointer_conn_string(database_url: str) -> str:
    if database_url.startswith("postgresql+asyncpg://"):
        return "postgresql://" + database_url.removeprefix("postgresql+asyncpg://")
    if database_url.startswith("postgres+asyncpg://"):
        return "postgres://" + database_url.removeprefix("postgres+asyncpg://")
    return database_url


@asynccontextmanager
async def build_postgres_checkpointer(database_url: str) -> AsyncIterator[object]:
    if database_url.startswith(("postgres://", "postgresql://", "postgresql+")):
        conn_str = _normalize_checkpointer_conn_string(database_url)
        async with AsyncPostgresSaver.from_conn_string(conn_str) as checkpointer:
            await checkpointer.setup()
            yield checkpointer
        return

    yield InMemorySaver()

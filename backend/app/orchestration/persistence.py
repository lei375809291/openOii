from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver


@asynccontextmanager
async def build_postgres_checkpointer(database_url: str) -> AsyncIterator[object]:
    if database_url.startswith(("postgres://", "postgresql://", "postgresql+")):
        async with AsyncPostgresSaver.from_conn_string(database_url) as checkpointer:
            await checkpointer.setup()
            yield checkpointer
        return

    yield InMemorySaver()

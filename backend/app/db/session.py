from __future__ import annotations

from collections.abc import AsyncGenerator
from pathlib import Path

from alembic import command as alembic_command
from alembic.config import Config as AlembicConfig
from sqlalchemy import func, update
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlmodel import SQLModel

from app.config import get_settings
from app.models import agent_run, artifact, config_item, message, project, run, stage  # noqa: F401
from app.orchestration.persistence import ensure_postgres_checkpointer_setup

ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"
ALEMBIC_DIR = Path(__file__).resolve().parents[2] / "alembic"


def _build_engine() -> AsyncEngine:
    settings = get_settings()
    return create_async_engine(settings.database_url, echo=settings.db_echo, pool_pre_ping=True)


engine: AsyncEngine = _build_engine()
async_session_maker: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


def _run_alembic_upgrade() -> None:
    settings = get_settings()
    cfg = AlembicConfig(str(ALEMBIC_INI))
    cfg.set_main_option("script_location", str(ALEMBIC_DIR))
    cfg.set_main_option(
        "sqlalchemy.url",
        settings.database_url.replace("+asyncpg", "+psycopg2"),
    )
    alembic_command.upgrade(cfg, "head")


async def init_db() -> None:
    """Initialize database tables and cleanup stale runs."""
    settings = get_settings()
    agent_run_table = SQLModel.metadata.tables["agentrun"]
    project_table = SQLModel.metadata.tables["project"]

    loop = __import__("asyncio").get_running_loop()
    await loop.run_in_executor(None, _run_alembic_upgrade)

    async with async_session_maker() as session:
        from app.services.config_service import ConfigService
        from app.models.agent_run import AgentRun
        from app.models.project import Project

        config_service = ConfigService(session)
        await config_service.ensure_initialized()
        await config_service.apply_settings_overrides()

        await session.execute(
            update(AgentRun)
            .where(agent_run_table.c.status.in_(["queued", "running"]))
            .values(status="cancelled", error="Service restarted")
        )

        await session.execute(
            update(Project)
            .where((project_table.c.style.is_(None)) | (func.trim(project_table.c.style) == ""))
            .values(style="anime")
        )
        await session.commit()

    await ensure_postgres_checkpointer_setup(settings.database_url)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session

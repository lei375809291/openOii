from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import select

from app.db.session import _run_alembic_upgrade, init_db
from app.models.agent_run import AgentRun
from app.models.project import Project


def _mock_session_maker(session):
    @asynccontextmanager
    async def _maker():
        yield session
    return _maker


@pytest.mark.asyncio
async def test_init_db_cancels_stale_runs(test_session, test_settings):
    project = Project(title="t", story="s", style="anime")
    test_session.add(project)
    await test_session.commit()
    await test_session.refresh(project)

    run_queued = AgentRun(
        project_id=project.id, status="queued", current_agent="onboarding", progress=0.0
    )
    run_running = AgentRun(
        project_id=project.id, status="running", current_agent="director", progress=0.5
    )
    run_done = AgentRun(
        project_id=project.id, status="succeeded", current_agent="director", progress=1.0
    )
    test_session.add_all([run_queued, run_running, run_done])
    await test_session.commit()

    with patch("app.db.session.get_settings", return_value=test_settings), \
         patch("app.db.session._run_alembic_upgrade"), \
         patch("app.db.session.async_session_maker", _mock_session_maker(test_session)), \
         patch("app.orchestration.persistence.ensure_postgres_checkpointer_setup"):
        await init_db()

    stale = (await test_session.execute(
        select(AgentRun).where(AgentRun.status.in_(["queued", "running"]))
    )).scalars().all()
    assert len(stale) == 0

    done = (await test_session.execute(
        select(AgentRun).where(AgentRun.status == "succeeded")
    )).scalars().all()
    assert len(done) == 1


@pytest.mark.asyncio
async def test_init_db_sets_default_style(test_session, test_settings):
    project = Project(title="t", story="s", style="")
    test_session.add(project)
    await test_session.commit()
    await test_session.refresh(project)

    with patch("app.db.session.get_settings", return_value=test_settings), \
         patch("app.db.session._run_alembic_upgrade"), \
         patch("app.db.session.async_session_maker", _mock_session_maker(test_session)), \
         patch("app.orchestration.persistence.ensure_postgres_checkpointer_setup"):
        await init_db()

    updated = (await test_session.execute(
        select(Project).where(Project.id == project.id)
    )).scalar_one()
    assert updated.style == "anime"


@pytest.mark.asyncio
async def test_init_db_alembic_timeout(test_session, test_settings):
    with patch("app.db.session.get_settings", return_value=test_settings), \
         patch("app.db.session._run_alembic_upgrade"), \
         patch("app.db.session.async_session_maker", _mock_session_maker(test_session)), \
         patch("app.orchestration.persistence.ensure_postgres_checkpointer_setup"), \
         patch("asyncio.wait_for", side_effect=asyncio.TimeoutError):
        await init_db()


@pytest.mark.asyncio
async def test_init_db_alembic_failure(test_session, test_settings):
    with patch("app.db.session.get_settings", return_value=test_settings), \
         patch("app.db.session._run_alembic_upgrade", side_effect=RuntimeError("alembic died")), \
         patch("app.db.session.async_session_maker", _mock_session_maker(test_session)), \
         patch("app.orchestration.persistence.ensure_postgres_checkpointer_setup"):
        await init_db()


def test_run_alembic_upgrade_handles_existing_table(test_settings):
    with patch("app.db.session.get_settings", return_value=test_settings), \
         patch("alembic.command.upgrade"), \
         patch("sqlalchemy.create_engine") as mock_ce:
        mock_engine = MagicMock()
        mock_conn = MagicMock()
        mock_inspector = MagicMock()
        mock_inspector.get_table_names.return_value = ["alembic_version", "other_table"]
        mock_engine.connect.return_value.__enter__ = lambda s: mock_conn
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        with patch("sqlalchemy.inspect", return_value=mock_inspector):
            mock_ce.return_value = mock_engine
            _run_alembic_upgrade()
        mock_conn.execute.assert_called()


def test_run_alembic_upgrade_creates_missing_table(test_settings):
    with patch("app.db.session.get_settings", return_value=test_settings), \
         patch("alembic.command.upgrade"), \
         patch("sqlalchemy.create_engine") as mock_ce:
        mock_engine = MagicMock()
        mock_conn = MagicMock()
        mock_inspector = MagicMock()
        mock_inspector.get_table_names.return_value = ["other_table"]
        mock_engine.connect.return_value.__enter__ = lambda s: mock_conn
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        with patch("sqlalchemy.inspect", return_value=mock_inspector):
            mock_ce.return_value = mock_engine
            _run_alembic_upgrade()
        mock_conn.execute.assert_called()

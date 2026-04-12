from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect
from sqlmodel import SQLModel

from app.models import agent_run, artifact, config_item, message, project, run, stage  # noqa: F401


def _backend_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _alembic_config(db_url: str) -> Config:
    config = Config(str(_backend_root() / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", db_url)
    return config


def test_alembic_upgrade_head_rebuilds_blank_database(tmp_path: Path) -> None:
    db_path = tmp_path / "phase1-migration.db"
    db_path.unlink(missing_ok=True)

    db_url = f"sqlite+pysqlite:///{db_path}"
    command.upgrade(_alembic_config(db_url), "head")

    engine = create_engine(db_url)
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
    finally:
        engine.dispose()

    expected_tables = {
        "agentrun",
        "agentmessage",
        "artifact",
        "character",
        "configitem",
        "message",
        "project",
        "run",
        "shot",
        "stage",
        "alembic_version",
    }

    assert tables == expected_tables

    column_engine = create_engine(db_url)
    try:
        run_columns = {column["name"] for column in inspect(column_engine).get_columns("run")}
    finally:
        column_engine.dispose()
    assert {"project_id", "thread_id", "status", "version", "source"}.issubset(run_columns)


def test_alembic_stamp_adopts_existing_create_all_database(tmp_path: Path) -> None:
    db_path = tmp_path / "phase1-existing.db"
    db_path.unlink(missing_ok=True)

    db_url = f"sqlite+pysqlite:///{db_path}"
    engine = create_engine(db_url)
    try:
        SQLModel.metadata.create_all(engine)
    finally:
        engine.dispose()

    command.stamp(_alembic_config(db_url), "head")
    command.upgrade(_alembic_config(db_url), "head")

    stamped_engine = create_engine(db_url)
    try:
        inspector = inspect(stamped_engine)
        tables = set(inspector.get_table_names())
    finally:
        stamped_engine.dispose()

    assert "alembic_version" in tables
    assert {"project", "agentrun", "run", "stage", "artifact"}.issubset(tables)

from __future__ import annotations

import asyncio

import pytest

from app.api.v1.routes import generation as generation_routes
from app.schemas.project import (
    AgentRunRead,
    RecoveryControlRead,
    RecoveryStageRead,
    RecoverySummaryRead,
)
from tests.factories import create_project, create_run


def _immediate_task(coro):
    """Helper to make asyncio.create_task synchronous for testing"""
    loop = asyncio.get_running_loop()
    coro.close()
    future = loop.create_future()
    future.set_result(None)
    return future


def _recovery_control(run, *, state: str, detail: str):
    summary = RecoverySummaryRead(
        project_id=run.project_id,
        run_id=run.id,
        thread_id=f"agent-run-{run.id}",
        current_stage="script",
        next_stage="character",
        preserved_stages=["ideate"],
        stage_history=[
            RecoveryStageRead(name="ideate", status="completed", artifact_count=2),
            RecoveryStageRead(name="script", status="current", artifact_count=1),
            RecoveryStageRead(name="character", status="pending", artifact_count=0),
        ],
        resumable=True,
    )
    return RecoveryControlRead(
        state=state,
        detail=detail,
        thread_id=f"agent-run-{run.id}",
        active_run=AgentRunRead.model_validate(run),
        recovery_summary=summary,
    )


@pytest.mark.asyncio
async def test_generate_project_rejects_second_active_full_run(
    async_client, test_session, monkeypatch
):
    monkeypatch.setattr(generation_routes.asyncio, "create_task", _immediate_task)

    project = await create_project(test_session)
    active_run = await create_run(test_session, project_id=project.id, status="running")

    async def _fake_recovery_control(**kwargs):
        return _recovery_control(
            active_run,
            state="active",
            detail="Project already has an active run",
        )

    monkeypatch.setattr(generation_routes, "build_recovery_control_surface", _fake_recovery_control)

    res = await async_client.post(f"/api/v1/projects/{project.id}/generate", json={})

    assert res.status_code == 409
    data = res.json()
    assert data["state"] == "active"
    assert "active run" in data["detail"].lower()
    assert data["available_actions"] == ["resume", "cancel"]
    assert data["thread_id"] == f"agent-run-{active_run.id}"
    assert data["recovery_summary"]["current_stage"] == "script"
    assert data["recovery_summary"]["next_stage"] == "character"
    assert data["recovery_summary"]["stage_history"][0]["name"] == "ideate"


@pytest.mark.asyncio
async def test_generate_project_conflict_is_explicit_about_resume_or_cancel(
    async_client, test_session, monkeypatch
):
    monkeypatch.setattr(generation_routes.asyncio, "create_task", _immediate_task)

    project = await create_project(test_session)
    resumable_run = await create_run(test_session, project_id=project.id, status="failed")

    async def _fake_recovery_control(**kwargs):
        return _recovery_control(
            resumable_run,
            state="recoverable",
            detail="Project has a resumable run",
        )

    monkeypatch.setattr(generation_routes, "build_recovery_control_surface", _fake_recovery_control)

    res = await async_client.post(f"/api/v1/projects/{project.id}/generate", json={})

    assert res.status_code == 409
    data = res.json()
    assert data["state"] == "recoverable"
    assert data["available_actions"] == ["resume", "cancel"]
    assert data["thread_id"] == f"agent-run-{resumable_run.id}"
    assert data["recovery_summary"]["preserved_stages"] == ["ideate"]

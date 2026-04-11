from __future__ import annotations

import asyncio

import pytest

from app.api.v1.routes import generation as generation_routes
from tests.factories import create_project, create_run


def _immediate_task(coro):
    """Helper to make asyncio.create_task synchronous for testing"""
    loop = asyncio.get_running_loop()
    coro.close()
    future = loop.create_future()
    future.set_result(None)
    return future


@pytest.mark.asyncio
async def test_generate_project_rejects_second_active_full_run(
    async_client, test_session, monkeypatch
):
    monkeypatch.setattr(generation_routes.asyncio, "create_task", _immediate_task)

    project = await create_project(test_session)
    await create_run(test_session, project_id=project.id, status="running")

    res = await async_client.post(f"/api/v1/projects/{project.id}/generate", json={})

    assert res.status_code == 409
    data = res.json()
    assert "active run" in data["detail"].lower()
    assert data["available_actions"] == ["resume", "cancel"]


@pytest.mark.asyncio
async def test_generate_project_conflict_is_explicit_about_resume_or_cancel(
    async_client, test_session, monkeypatch
):
    monkeypatch.setattr(generation_routes.asyncio, "create_task", _immediate_task)

    project = await create_project(test_session)
    await create_run(test_session, project_id=project.id, status="running")

    res = await async_client.post(f"/api/v1/projects/{project.id}/generate", json={})

    assert res.status_code == 409
    data = res.json()
    assert data["available_actions"] == ["resume", "cancel"]
    assert data["active_run"]["thread_id"]

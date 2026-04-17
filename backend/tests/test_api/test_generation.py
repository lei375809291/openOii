from __future__ import annotations

import json
import asyncio

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import select

from app.api.deps import get_app_settings, get_db_session, get_ws_manager
from app.agents.review import ReviewAgent
from app.api.v1.routes import generation as generation_routes
from app.main import create_app
from app.models.agent_run import AgentRun
from tests.agent_fixtures import FakeLLM, make_context
from tests.factories import create_project, create_run, create_shot


def _immediate_task(coro):
    """Helper to make asyncio.create_task synchronous for testing"""
    loop = asyncio.get_running_loop()
    coro.close()
    future = loop.create_future()
    future.set_result(None)
    return future


@pytest.mark.asyncio
async def test_generate_project_not_found(async_client):
    res = await async_client.post("/api/v1/projects/99999/generate", json={})
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_generate_project_success(async_client, test_session, monkeypatch):
    monkeypatch.setattr(generation_routes.asyncio, "create_task", _immediate_task)

    project = await create_project(test_session)
    res = await async_client.post(f"/api/v1/projects/{project.id}/generate", json={})
    assert res.status_code == 201
    data = res.json()
    run = await test_session.get(AgentRun, data["id"])
    assert run is not None
    assert run.status == "running"


@pytest.mark.asyncio
async def test_generate_project_does_not_require_admin_token(
    test_session, test_settings, ws_manager, monkeypatch
):
    monkeypatch.setattr(generation_routes.asyncio, "create_task", _immediate_task)

    app = create_app()

    async def override_get_session():
        yield test_session

    async def override_get_settings():
        return test_settings

    async def override_get_ws():
        return ws_manager

    app.dependency_overrides[get_db_session] = override_get_session
    app.dependency_overrides[get_app_settings] = override_get_settings
    app.dependency_overrides[get_ws_manager] = override_get_ws

    project = await create_project(test_session)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(f"/api/v1/projects/{project.id}/generate", json={})

    assert res.status_code == 201


@pytest.mark.asyncio
async def test_cancel_project_run_no_active(async_client, test_session):
    project = await create_project(test_session)
    res = await async_client.post(f"/api/v1/projects/{project.id}/cancel")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "no_active_run"


@pytest.mark.asyncio
async def test_cancel_project_run_updates(async_client, test_session):
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id, status="running")

    res = await async_client.post(f"/api/v1/projects/{project.id}/cancel")
    assert res.status_code == 200
    await test_session.refresh(run)
    assert run.status == "cancelled"


@pytest.mark.asyncio
async def test_feedback_project_success(async_client, test_session, monkeypatch):
    monkeypatch.setattr(generation_routes.asyncio, "create_task", _immediate_task)

    project = await create_project(test_session)
    res = await async_client.post(
        f"/api/v1/projects/{project.id}/feedback",
        json={"content": "Please adjust tone"},
    )
    assert res.status_code == 202
    data = res.json()
    run = await test_session.get(AgentRun, data["run_id"])
    assert run is not None
    assert run.status == "queued"

    from app.models.message import Message

    res = await test_session.execute(select(Message).where(Message.run_id == run.id))
    messages = res.scalars().all()
    assert len(messages) == 1
    assert messages[0].content == "Please adjust tone"


@pytest.mark.asyncio
async def test_review_agent_routes_retry_merge_back_to_video_merger(test_session, test_settings):
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    await create_shot(test_session, project_id=project.id, video_url="http://video.test/1.mp4")

    llm_payload = {
        "analysis": {
            "feedback_type": "video",
            "summary": "需要重新拼接最终视频",
            "target_items": ["最终视频"],
            "suggested_changes": "重新拼接成片",
        },
        "routing": {
            "start_agent": "scriptwriter",
            "mode": "full",
            "reason": "模型误判",
        },
        "target_ids": {},
    }
    ctx = await make_context(
        test_session,
        test_settings,
        project=project,
        run=run,
        llm=FakeLLM(json.dumps(llm_payload, ensure_ascii=False)),
    )
    ctx.user_feedback = "请基于当前最终视频重新合成"

    agent = ReviewAgent()
    routing = await agent.run(ctx)

    assert routing["start_agent"] == "video_merger"
    assert routing["mode"] == "incremental"

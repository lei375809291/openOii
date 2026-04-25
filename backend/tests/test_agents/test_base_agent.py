from __future__ import annotations

from typing import Any, cast

import pytest
from fastapi import WebSocket
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel, select
from starlette.websockets import WebSocketState

from app.agents.base import BaseAgent
from app.models import (  # noqa: F401
    agent_run,
    artifact,
    message,
    project as _project_models,
    run as _run_models,
    stage,
)
from app.models.message import Message
from app.ws.manager import ws_manager
from tests.agent_fixtures import make_context
from tests.factories import create_character, create_project, create_run, create_shot


class DummyAgent(BaseAgent):
    name = "dummy"


class _FakeWebSocket:
    client_state = WebSocketState.CONNECTED

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    async def send_json(self, payload: dict[str, Any]) -> None:
        self.sent.append(payload)


@pytest.mark.asyncio
async def test_send_message_is_visible_to_other_sessions_immediately(tmp_path, test_settings):
    database_url = f"sqlite+aiosqlite:///{tmp_path / 'base-agent.db'}"
    engine = create_async_engine(database_url, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_maker() as writer_session:
        ctx = await make_context(writer_session, test_settings)
        agent = DummyAgent()

        await agent.send_message(ctx, "第一条可见消息", progress=0.0, is_loading=True)

        async with session_maker() as reader_session:
            res = await reader_session.execute(select(Message).where(Message.project_id == ctx.project.id))
            messages = list(res.scalars().all())

        assert len(messages) == 1
        assert messages[0].content == "第一条可见消息"
        assert messages[0].agent == "dummy"
        assert messages[0].is_loading is True
        assert ctx.ws.events[-1][1]["type"] == "run_message"

    await engine.dispose()


@pytest.mark.asyncio
async def test_send_character_event_emits_schema_complete_payload(test_session, test_settings):
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    character = await create_character(test_session, project_id=project.id, name="Hero")
    ctx = await make_context(test_session, test_settings, project=project, run=run)
    ctx.ws = ws_manager

    fake_ws = _FakeWebSocket()
    ws_manager._conns.clear()
    ws_manager._conns[project.id].add(cast(WebSocket, cast(object, fake_ws)))

    await DummyAgent().send_character_event(ctx, character, "character_updated")

    payload = fake_ws.sent[-1]["data"]["character"]
    assert payload["approval_state"] == "draft"
    assert payload["approval_version"] == 0
    assert "approved_image_url" in payload


@pytest.mark.asyncio
async def test_send_shot_event_emits_schema_complete_payload(test_session, test_settings):
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    shot = await create_shot(test_session, project_id=project.id, description="Opening shot")
    ctx = await make_context(test_session, test_settings, project=project, run=run)
    ctx.ws = ws_manager

    fake_ws = _FakeWebSocket()
    ws_manager._conns.clear()
    ws_manager._conns[project.id].add(cast(WebSocket, cast(object, fake_ws)))

    await DummyAgent().send_shot_event(ctx, shot, "shot_updated")

    payload = fake_ws.sent[-1]["data"]["shot"]
    assert payload["approval_state"] == "draft"
    assert payload["approval_version"] == 0
    assert payload["character_ids"] == []
    assert "approved_character_ids" in payload

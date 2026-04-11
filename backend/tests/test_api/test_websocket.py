from __future__ import annotations

from typing import Any, cast

import pytest
from pydantic import ValidationError
from fastapi import WebSocket
from starlette.websockets import WebSocketState

from app.ws.manager import ws_manager


class _FakeWebSocket:
    client_state = WebSocketState.CONNECTED

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    async def send_json(self, payload: dict[str, Any]) -> None:
        self.sent.append(payload)


def test_websocket_ping_echo(ws_client):
    with ws_client.websocket_connect("/ws/projects/1") as ws:
        connected = ws.receive_json()
        assert connected["type"] == "connected"
        assert connected["data"]["project_id"] == 1

        ws.send_json({"type": "ping"})
        pong = ws.receive_json()
        assert pong["type"] == "pong"

        ws.send_json({"type": "echo", "data": {"hello": "world"}})
        echo = ws.receive_json()
        assert echo["type"] == "echo"
        assert echo["data"]["hello"] == "world"


@pytest.mark.asyncio
async def test_websocket_manager_enriches_recovery_payloads():
    fake_ws = _FakeWebSocket()
    ws_manager._conns.clear()
    ws_manager._conns[1].add(cast(WebSocket, cast(object, fake_ws)))

    await ws_manager.send_event(
        1,
        {
            "type": "run_awaiting_confirm",
            "data": {
                "run_id": 7,
                "project_id": 1,
                "agent": "scriptwriter",
                "gate": "scriptwriter",
                "current_stage": "script",
                "stage": "script",
                "next_stage": "character",
                "preserved_stages": ["ideate"],
                "recovery_summary": {
                    "project_id": 1,
                    "run_id": 7,
                    "thread_id": "agent-run-7",
                    "current_stage": "script",
                    "next_stage": "character",
                    "preserved_stages": ["ideate"],
                    "stage_history": [
                        {"name": "ideate", "status": "completed", "artifact_count": 2},
                        {"name": "script", "status": "current", "artifact_count": 1},
                        {"name": "character", "status": "pending", "artifact_count": 0},
                    ],
                    "resumable": True,
                },
                "message": "ready",
                "completed": "scriptwriter done",
                "next_step": "continue",
                "question": "continue?",
            },
        },
    )

    payload = fake_ws.sent[0]
    data = cast(dict[str, Any], payload["data"])
    recovery_summary = cast(dict[str, Any], data["recovery_summary"])
    assert payload["type"] == "run_awaiting_confirm"
    assert recovery_summary["next_stage"] == "character"
    assert data["current_stage"] == "script"


@pytest.mark.asyncio
async def test_websocket_manager_scopes_project_updated_events_to_project_connections():
    fake_ws_1 = _FakeWebSocket()
    fake_ws_2 = _FakeWebSocket()
    ws_manager._conns.clear()
    ws_manager._conns[1].add(cast(WebSocket, cast(object, fake_ws_1)))
    ws_manager._conns[2].add(cast(WebSocket, cast(object, fake_ws_2)))

    await ws_manager.send_event(
        1,
        {
            "type": "project_updated",
            "data": {
                "project": {
                    "id": 1,
                    "title": "Realtime Story",
                    "video_url": "https://cdn.example.com/final.mp4",
                },
            },
        },
    )

    assert len(fake_ws_1.sent) == 1
    payload = fake_ws_1.sent[0]
    data = cast(dict[str, Any], payload["data"])
    project = cast(dict[str, Any], data["project"])
    assert payload["type"] == "project_updated"
    assert project["id"] == 1
    assert project["video_url"] == "https://cdn.example.com/final.mp4"
    assert fake_ws_2.sent == []


@pytest.mark.asyncio
async def test_websocket_manager_rejects_invalid_project_updated_payload():
    ws_manager._conns.clear()

    with pytest.raises(ValidationError):
        await ws_manager.send_event(
            1,
            {
                "type": "project_updated",
                "data": {
                    "project": {
                        "video_url": "https://cdn.example.com/final.mp4",
                    },
                },
            },
        )


@pytest.mark.asyncio
async def test_websocket_manager_rejects_invalid_outbound_payload():
    ws_manager._conns.clear()

    with pytest.raises(ValidationError):
        await ws_manager.send_event(
            1,
            {
                "type": "run_progress",
                "data": {
                    "run_id": 7,
                    "current_stage": "script",
                },
            },
        )

from __future__ import annotations

import pytest
from pydantic import ValidationError
from starlette.websockets import WebSocketState

from app.ws.manager import ws_manager


class _FakeWebSocket:
    client_state = WebSocketState.CONNECTED

    def __init__(self) -> None:
        self.sent: list[dict[str, object]] = []

    async def send_json(self, payload):
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
    ws_manager._conns[1].add(fake_ws)

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

    assert fake_ws.sent[0]["type"] == "run_awaiting_confirm"
    assert fake_ws.sent[0]["data"]["recovery_summary"]["next_stage"] == "character"
    assert fake_ws.sent[0]["data"]["current_stage"] == "script"


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

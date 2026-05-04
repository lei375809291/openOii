from __future__ import annotations

import pytest
from unittest.mock import patch

from app.api.deps import require_admin, get_app_settings, get_ws_manager

from fastapi import HTTPException


@pytest.mark.asyncio
async def test_get_app_settings_returns_settings():
    result = await get_app_settings()
    assert result is not None


@pytest.mark.asyncio
async def test_get_ws_manager_returns_manager():
    result = await get_ws_manager()
    assert result is not None


@pytest.mark.asyncio
async def test_require_admin_no_token_configured():
    with patch("app.api.deps.get_settings", return_value=type("S", (), {"admin_token": ""})()):
        with pytest.raises(HTTPException) as exc_info:
            await require_admin(x_admin_token=None)
        assert exc_info.value.status_code == 503


@pytest.mark.asyncio
async def test_require_admin_wrong_token():
    with patch("app.api.deps.get_settings", return_value=type("S", (), {"admin_token": "secret"})()):
        with pytest.raises(HTTPException) as exc_info:
            await require_admin(x_admin_token="wrong")
        assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_require_admin_correct_token():
    with patch("app.api.deps.get_settings", return_value=type("S", (), {"admin_token": "secret"})()):
        result = await require_admin(x_admin_token="secret")
        assert result is None


@pytest.mark.asyncio
async def test_require_admin_no_header():
    with patch("app.api.deps.get_settings", return_value=type("S", (), {"admin_token": "secret"})()):
        with pytest.raises(HTTPException) as exc_info:
            await require_admin(x_admin_token=None)
        assert exc_info.value.status_code == 403

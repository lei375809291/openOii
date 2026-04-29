from __future__ import annotations

import pytest

from app.api.deps import get_app_settings, get_ws_manager


@pytest.mark.asyncio
async def test_get_app_settings():
    settings = await get_app_settings()
    assert settings is not None
    assert hasattr(settings, "database_url")


@pytest.mark.asyncio
async def test_get_ws_manager():
    mgr = await get_ws_manager()
    assert mgr is not None

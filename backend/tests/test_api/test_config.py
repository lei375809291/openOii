from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.api import deps as api_deps
from app.api.deps import get_app_settings, get_db_session, get_ws_manager
from app.api.v1.routes import config as config_routes
from app.main import create_app
from app.models.config_item import ConfigItem
from app.schemas.config import TestConnectionResponse as ConfigTestConnectionResponse
from tests.factories import create_config_item


def _write_env_file(tmp_path, values: dict[str, str]) -> str:
    env_file = tmp_path / "provider.env"
    env_file.write_text(
        "\n".join(f"{key}={value}" for key, value in values.items()), encoding="utf-8"
    )
    return str(env_file)


@pytest.mark.asyncio
async def test_list_configs_empty(async_client):
    """测试获取空配置列表"""
    res = await async_client.get("/api/v1/config")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    # 可能有来自 .env 的配置，所以不强制为空


@pytest.mark.asyncio
async def test_list_configs_with_data(async_client, test_session):
    """测试获取包含数据的配置列表"""
    await create_config_item(test_session, key="TEST_KEY_1", value="value1")
    await create_config_item(test_session, key="TEST_KEY_2", value="value2", is_sensitive=True)

    res = await async_client.get("/api/v1/config")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)

    # 查找我们创建的配置项
    test_items = [item for item in data if item["key"].startswith("TEST_KEY_")]
    assert len(test_items) == 2

    # 验证敏感信息被脱敏
    sensitive_item = next(item for item in test_items if item["key"] == "TEST_KEY_2")
    assert sensitive_item["is_sensitive"] is True
    assert sensitive_item["is_masked"] is True
    assert "***" in sensitive_item["value"]


@pytest.mark.asyncio
async def test_update_configs_new_item(async_client, test_session):
    """测试创建新配置项"""
    res = await async_client.put(
        "/api/v1/config",
        json={"configs": {"NEW_CONFIG_KEY": "new_value"}},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["updated"] == 1
    assert data["skipped"] == 0

    # 验证数据库中存在
    item = await test_session.get(ConfigItem, "NEW_CONFIG_KEY")
    assert item is not None
    assert item.value == "new_value"


@pytest.mark.asyncio
async def test_update_configs_existing_item(async_client, test_session):
    """测试更新已存在的配置项"""
    await create_config_item(test_session, key="EXISTING_KEY", value="old_value")

    res = await async_client.put(
        "/api/v1/config",
        json={"configs": {"EXISTING_KEY": "new_value"}},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["updated"] == 1

    # 验证值已更新
    item = await test_session.get(ConfigItem, "EXISTING_KEY")
    assert item is not None
    assert item.value == "new_value"


@pytest.mark.asyncio
async def test_update_configs_post_alias(async_client, test_session):
    res = await async_client.post(
        "/api/v1/config",
        json={"configs": {"POST_ALIAS_KEY": "post_value"}},
    )

    assert res.status_code == 200
    data = res.json()
    assert data["updated"] == 1

    item = await test_session.get(ConfigItem, "POST_ALIAS_KEY")
    assert item is not None
    assert item.value == "post_value"


@pytest.mark.asyncio
async def test_update_configs_skip_masked_value(async_client, test_session):
    """测试跳过脱敏值（不更新）"""
    await create_config_item(
        test_session, key="SENSITIVE_KEY", value="secret123456", is_sensitive=True
    )

    # 尝试用脱敏值更新（应该被跳过）
    res = await async_client.put(
        "/api/v1/config",
        json={"configs": {"SENSITIVE_KEY": "secr******3456"}},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["skipped"] == 1
    assert data["updated"] == 0

    # 验证值未改变
    item = await test_session.get(ConfigItem, "SENSITIVE_KEY")
    assert item is not None
    assert item.value == "secret123456"


@pytest.mark.asyncio
async def test_update_configs_restart_required(async_client, test_session):
    """测试需要重启的配置项"""
    res = await async_client.put(
        "/api/v1/config",
        json={"configs": {"DATABASE_URL": "postgresql://new_url"}},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["restart_required"] is True
    assert "DATABASE_URL" in data["restart_keys"]
    assert "重启" in data["message"]


@pytest.mark.asyncio
async def test_update_configs_no_restart_required(async_client, test_session):
    """测试不需要重启的配置项"""
    res = await async_client.put(
        "/api/v1/config",
        json={"configs": {"IMAGE_API_KEY": "new_key"}},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["restart_required"] is False
    assert len(data["restart_keys"]) == 0


@pytest.mark.asyncio
async def test_reveal_value_existing(async_client, test_session):
    """测试获取已存在配置的原始值"""
    await create_config_item(
        test_session, key="SECRET_KEY", value="my_secret_value", is_sensitive=True
    )

    res = await async_client.post(
        "/api/v1/config/reveal",
        json={"key": "SECRET_KEY"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["key"] == "SECRET_KEY"
    assert data["value"] == "my_secret_value"


@pytest.mark.asyncio
async def test_reveal_value_not_found(async_client, test_session):
    """测试获取不存在配置的原始值"""
    res = await async_client.post(
        "/api/v1/config/reveal",
        json={"key": "NON_EXISTENT_KEY"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["key"] == "NON_EXISTENT_KEY"
    assert data["value"] is None


@pytest.mark.asyncio
async def test_test_connection_happy_path(async_client, monkeypatch):
    async def _fake_test_llm_connection(_settings):
        return ConfigTestConnectionResponse(
            success=True, message="LLM 服务连接成功", details="模型: test"
        )

    monkeypatch.setattr(config_routes, "_test_llm_connection", _fake_test_llm_connection)

    res = await async_client.post(
        "/api/v1/config/test-connection",
        json={"service": "llm"},
    )

    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["message"] == "LLM 服务连接成功"


@pytest.mark.asyncio
async def test_update_configs_empty_payload(async_client):
    """测试空配置更新"""
    res = await async_client.put(
        "/api/v1/config",
        json={"configs": {}},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["updated"] == 0
    assert data["skipped"] == 0


@pytest.mark.asyncio
async def test_update_configs_null_value(async_client):
    """测试 null 值配置（应该被跳过）"""
    res = await async_client.put(
        "/api/v1/config",
        json={"configs": {"NULL_KEY": None}},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["skipped"] == 1
    assert data["updated"] == 0


@pytest.mark.asyncio
async def test_update_configs_multiple_items(async_client, test_session):
    """测试批量更新多个配置项"""
    res = await async_client.put(
        "/api/v1/config",
        json={
            "configs": {
                "KEY_1": "value1",
                "KEY_2": "value2",
                "KEY_3": "value3",
            }
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["updated"] == 3

    # 验证所有项都已创建
    for i in range(1, 4):
        item = await test_session.get(ConfigItem, f"KEY_{i}")
        assert item is not None
        assert item.value == f"value{i}"


@pytest.mark.asyncio
async def test_sensitive_key_detection(async_client, test_session):
    """测试敏感键自动检测"""
    # 创建包含敏感关键词的配置
    res = await async_client.put(
        "/api/v1/config",
        json={
            "configs": {
                "MY_API_KEY": "key123",
                "AUTH_TOKEN": "token456",
                "DB_PASSWORD": "pass789",
            }
        },
    )
    assert res.status_code == 200

    # 获取配置列表，验证敏感标记
    res = await async_client.get("/api/v1/config")
    data = res.json()

    sensitive_keys = ["MY_API_KEY", "AUTH_TOKEN", "DB_PASSWORD"]
    for key in sensitive_keys:
        item = next((i for i in data if i["key"] == key), None)
        assert item is not None
        assert item["is_sensitive"] is True
        assert item["is_masked"] is True


@pytest.mark.asyncio
async def test_provider_surface_prefers_database_values_over_env(
    monkeypatch, tmp_path, async_client, test_session
):
    monkeypatch.setenv(
        "ENV_FILE",
        _write_env_file(
            tmp_path,
            {
                "TEXT_API_KEY": "env-text-key",
                "TEXT_MODEL": "env-text-model",
                "IMAGE_API_KEY": "env-image-key",
                "IMAGE_MODEL": "env-image-model",
                "VIDEO_API_KEY": "env-video-key",
                "VIDEO_MODEL": "env-video-model",
            },
        ),
    )

    await create_config_item(
        test_session, key="TEXT_API_KEY", value="db-text-key", is_sensitive=True
    )
    await create_config_item(test_session, key="TEXT_MODEL", value="db-text-model")
    await create_config_item(
        test_session, key="IMAGE_API_KEY", value="db-image-key", is_sensitive=True
    )
    await create_config_item(test_session, key="IMAGE_MODEL", value="db-image-model")
    await create_config_item(
        test_session, key="VIDEO_API_KEY", value="db-video-key", is_sensitive=True
    )
    await create_config_item(test_session, key="VIDEO_MODEL", value="db-video-model")

    res = await async_client.get("/api/v1/config")
    assert res.status_code == 200
    data = {item["key"]: item for item in res.json()}

    for key, raw_value in {
        "TEXT_API_KEY": "db-text-key",
        "TEXT_MODEL": "db-text-model",
        "IMAGE_API_KEY": "db-image-key",
        "IMAGE_MODEL": "db-image-model",
        "VIDEO_API_KEY": "db-video-key",
        "VIDEO_MODEL": "db-video-model",
    }.items():
        assert data[key]["source"] == "db"
        if key.endswith("_API_KEY"):
            assert data[key]["is_sensitive"] is True
            assert data[key]["is_masked"] is True
            assert raw_value not in data[key]["value"]
        else:
            assert data[key]["is_sensitive"] is False
            assert data[key]["is_masked"] is False
            assert data[key]["value"] == raw_value


@pytest.mark.asyncio
async def test_reveal_value_falls_back_to_env_for_provider_key(monkeypatch, tmp_path, async_client):
    monkeypatch.setenv(
        "ENV_FILE",
        _write_env_file(tmp_path, {"IMAGE_API_KEY": "env-image-key"}),
    )

    res = await async_client.post("/api/v1/config/reveal", json={"key": "IMAGE_API_KEY"})
    assert res.status_code == 200
    data = res.json()
    assert data["key"] == "IMAGE_API_KEY"
    assert data["value"] == "env-image-key"


@pytest.mark.asyncio
async def test_test_connection_requires_admin_token_when_configured(
    test_session, test_settings, ws_manager, monkeypatch
):
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
    test_settings.admin_token = "secret-admin-token"
    monkeypatch.setattr(api_deps, "get_settings", lambda: test_settings)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/config/test-connection",
            json={"service": "llm"},
        )

    assert res.status_code == 403
    assert res.json()["detail"] == "Not authorized"

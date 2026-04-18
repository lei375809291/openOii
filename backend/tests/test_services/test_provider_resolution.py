from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.config import Settings
from app.services.provider_resolution import (
    TEXT_PROBE_MAX_RETRIES,
    probe_text_provider,
    resolve_project_provider_settings,
    resolve_project_provider_settings_async,
)
from app.services.text_capabilities import TextProviderCapability


def make_project(**overrides: str | None) -> SimpleNamespace:
    return SimpleNamespace(
        text_provider_override=overrides.get("text_provider_override"),
        image_provider_override=overrides.get("image_provider_override"),
        video_provider_override=overrides.get("video_provider_override"),
    )


def test_resolver_uses_runtime_defaults_for_text_provider() -> None:
    settings = Settings(
        text_provider="openai",
        text_api_key="text-key",
        image_api_key="image-key",
        video_api_key="video-key",
    )

    result = resolve_project_provider_settings(make_project(), settings)

    assert result.valid is True
    assert result.text.selected_key == "openai"
    assert result.text.source == "default"
    assert result.text.resolved_key == "openai"
    assert result.text.valid is True
    assert result.text.status == "valid"
    assert result.text.reason_code is None
    assert result.text.capabilities is not None
    assert result.text.capabilities.stream is True


def test_resolver_marks_doubao_without_credentials_invalid() -> None:
    settings = Settings(image_api_key="image-key", text_provider="anthropic", anthropic_api_key="anthropic-key")

    result = resolve_project_provider_settings(
        make_project(video_provider_override="doubao"),
        settings,
    )

    assert result.video.selected_key == "doubao"
    assert result.video.source == "project"
    assert result.video.resolved_key is None
    assert result.video.valid is False
    assert result.video.reason_code == "provider_missing_credentials"
    assert result.video.reason_message
    assert result.valid is False


def test_resolver_is_deterministic_for_same_inputs() -> None:
    settings = Settings(
        text_provider="openai",
        text_api_key="text-key",
        image_api_key="image-key",
        video_provider="doubao",
        doubao_api_key="doubao-key",
    )
    project = make_project(text_provider_override="openai", video_provider_override="doubao")

    first = resolve_project_provider_settings(project, settings)
    second = resolve_project_provider_settings(project, settings)

    assert first.model_dump() == second.model_dump()


@pytest.mark.asyncio
async def test_async_resolver_marks_text_provider_degraded_when_stream_is_unavailable(monkeypatch) -> None:
    settings = Settings(
        text_provider="openai",
        text_api_key="text-key",
        image_api_key="image-key",
        video_api_key="video-key",
    )

    async def fake_probe(_settings: Settings) -> TextProviderCapability:
        return TextProviderCapability(
            status="degraded",
            generate=True,
            stream=False,
            reason_code="provider_stream_unavailable",
            reason_message="文本 Provider 流式不可用，已自动回退非流式生成。",
        )

    monkeypatch.setattr(
        "app.services.provider_resolution.probe_text_provider",
        fake_probe,
    )

    result = await resolve_project_provider_settings_async(make_project(), settings)

    assert result.valid is True
    assert result.text.valid is True
    assert result.text.status == "degraded"
    assert result.text.reason_code == "provider_stream_unavailable"
    assert result.text.capabilities is not None
    assert result.text.capabilities.generate is True
    assert result.text.capabilities.stream is False


@pytest.mark.asyncio
async def test_probe_text_provider_uses_nonzero_probe_retries(monkeypatch) -> None:
    settings = Settings(
        text_provider="openai",
        text_api_key="text-key",
        text_base_url="https://text.example.com",
        text_model="gpt-test",
        text_endpoint="/chat/completions",
    )
    captured: dict[str, int] = {}

    class DummyTextService:
        def __init__(self, probe_settings: Settings, *, max_retries: int = 0):
            captured["max_retries"] = max_retries

        async def probe(self) -> TextProviderCapability:
            return TextProviderCapability(status="valid", generate=True, stream=True)

    monkeypatch.setattr("app.services.provider_resolution.TextService", DummyTextService)

    result = await probe_text_provider(settings)

    assert captured["max_retries"] == TEXT_PROBE_MAX_RETRIES
    assert result.status == "valid"

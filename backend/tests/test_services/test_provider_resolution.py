from __future__ import annotations

from types import SimpleNamespace

from app.config import Settings
from app.services.provider_resolution import resolve_project_provider_settings


def make_project(**overrides: str | None) -> SimpleNamespace:
    return SimpleNamespace(
        text_provider_override=overrides.get("text_provider_override"),
        image_provider_override=overrides.get("image_provider_override"),
        video_provider_override=overrides.get("video_provider_override"),
    )


def test_resolver_uses_runtime_defaults_for_text_provider() -> None:
    settings = Settings(text_provider="openai", text_api_key="text-key", image_api_key="image-key")

    result = resolve_project_provider_settings(make_project(), settings)

    assert result.valid is True
    assert result.text.selected_key == "openai"
    assert result.text.source == "default"
    assert result.text.resolved_key == "openai"
    assert result.text.valid is True
    assert result.text.reason_code is None


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

from __future__ import annotations

from typing import Literal, Protocol

from pydantic import BaseModel

from app.config import Settings
from app.schemas.project import ProjectProviderEntry, ProjectProviderSettingsRead


class ProjectProviderOverrides(Protocol):
    text_provider_override: str | None
    image_provider_override: str | None
    video_provider_override: str | None


TEXT_PROVIDER_KEYS = ("anthropic", "openai")
IMAGE_PROVIDER_KEYS = ("openai",)
VIDEO_PROVIDER_KEYS = ("openai", "doubao")


class ProviderResolution(BaseModel):
    valid: bool
    text: ProjectProviderEntry
    image: ProjectProviderEntry
    video: ProjectProviderEntry

    def as_project_provider_settings(self) -> ProjectProviderSettingsRead:
        return ProjectProviderSettingsRead(
            text=self.text,
            image=self.image,
            video=self.video,
        )

    def as_error_details(self) -> dict[str, object]:
        return {
            "valid": self.valid,
            "modalities": self.as_project_provider_settings().model_dump(),
        }


def _normalize_provider_key(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    return normalized or None


def _missing_credentials_message(label: str) -> str:
    return f"{label} Provider 缺少凭据，当前无法启动。"


def _resolve_entry(
    *,
    override_key: str | None,
    default_key: str | None,
    supported_keys: tuple[str, ...],
    credential_ok: dict[str, bool],
    modality_label: Literal["文本", "图像", "视频"],
) -> ProjectProviderEntry:
    normalized_override = _normalize_provider_key(override_key)
    normalized_default = _normalize_provider_key(default_key)

    selected_key = normalized_override or normalized_default
    source: Literal["project", "default"] = "project" if normalized_override else "default"

    if selected_key is None:
        return ProjectProviderEntry(
            selected_key="",
            source=source,
            resolved_key=None,
            valid=False,
            reason_code="provider_default_unavailable",
            reason_message=f"{modality_label} Provider 默认值不可用。",
        )

    if selected_key not in supported_keys:
        reason_code = "provider_unknown" if source == "default" else "provider_unsupported"
        return ProjectProviderEntry(
            selected_key=selected_key,
            source=source,
            resolved_key=None,
            valid=False,
            reason_code=reason_code,
            reason_message=f"{modality_label} Provider '{selected_key}' 不受支持。",
        )

    if not credential_ok.get(selected_key, False):
        return ProjectProviderEntry(
            selected_key=selected_key,
            source=source,
            resolved_key=None,
            valid=False,
            reason_code="provider_missing_credentials",
            reason_message=_missing_credentials_message(selected_key),
        )

    return ProjectProviderEntry(
        selected_key=selected_key,
        source=source,
        resolved_key=selected_key,
        valid=True,
        reason_code=None,
        reason_message=None,
    )


def resolve_project_provider_settings(
    project: ProjectProviderOverrides,
    settings: Settings,
) -> ProviderResolution:
    text = _resolve_entry(
        override_key=project.text_provider_override,
        default_key=settings.text_provider,
        supported_keys=TEXT_PROVIDER_KEYS,
        credential_ok={
            "anthropic": bool(settings.anthropic_api_key or settings.anthropic_auth_token),
            "openai": bool(settings.text_api_key),
        },
        modality_label="文本",
    )
    image = _resolve_entry(
        override_key=project.image_provider_override,
        default_key="openai",
        supported_keys=IMAGE_PROVIDER_KEYS,
        credential_ok={"openai": bool(settings.image_api_key)},
        modality_label="图像",
    )
    video = _resolve_entry(
        override_key=project.video_provider_override,
        default_key=settings.video_provider,
        supported_keys=VIDEO_PROVIDER_KEYS,
        credential_ok={
            "openai": bool(settings.video_api_key),
            "doubao": bool(settings.doubao_api_key),
        },
        modality_label="视频",
    )

    return ProviderResolution(
        valid=text.valid and image.valid and video.valid,
        text=text,
        image=image,
        video=video,
    )

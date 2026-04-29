from __future__ import annotations

import pytest

from app.config import Settings
from app.services.media_service import ImageService, MediaService, VideoService


def make_settings(**overrides):
    return Settings(
        database_url="sqlite+aiosqlite:///:memory:",
        image_base_url=overrides.get("image_base_url", "https://img.example.com/"),
        image_endpoint=overrides.get("image_endpoint", "v1/images"),
        image_model=overrides.get("image_model", "image-model"),
        image_api_key=overrides.get("image_api_key", "image-key"),
        video_base_url=overrides.get("video_base_url", "https://video.example.com/"),
        video_endpoint=overrides.get("video_endpoint", "v1/videos"),
        video_model=overrides.get("video_model", "video-model"),
        video_api_key=overrides.get("video_api_key", "video-key"),
    )


def test_image_service_build_url_adds_leading_slash():
    svc = ImageService(make_settings(image_endpoint="v1/generate"))

    assert svc._build_url() == "https://img.example.com/v1/generate"


def test_video_service_build_url_adds_leading_slash():
    svc = VideoService(make_settings(video_endpoint="v1/generate"))

    assert svc._build_url() == "https://video.example.com/v1/generate"


@pytest.mark.asyncio
async def test_media_service_delegates_to_image_and_video(monkeypatch):
    svc = MediaService(make_settings())

    image_calls = []
    video_calls = []

    async def fake_image_generate(*, prompt, size):
        image_calls.append((prompt, size))
        return {"kind": "image"}

    async def fake_video_generate(*, prompt, **kwargs):
        video_calls.append((prompt, kwargs))
        return {"kind": "video"}

    svc.image.generate = fake_image_generate
    svc.video.generate = fake_video_generate

    image_result = await svc.generate_image("cat", size="512x512")
    video_result = await svc.generate_video("scene", duration=8, ratio="16:9")

    assert image_result == {"kind": "image"}
    assert video_result == {"kind": "video"}
    assert image_calls == [("cat", "512x512")]
    assert video_calls == [("scene", {"duration": 8, "ratio": "16:9"})]


def test_image_service_build_url_already_has_slash():
    svc = ImageService(make_settings(image_endpoint="/v1/images"))
    assert svc._build_url() == "https://img.example.com/v1/images"


def test_video_service_build_url_already_has_slash():
    svc = VideoService(make_settings(video_endpoint="/v1/videos"))
    assert svc._build_url() == "https://video.example.com/v1/videos"


@pytest.mark.asyncio
async def test_image_service_generate_with_style(monkeypatch):
    svc = ImageService(make_settings())

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"data": [{"url": "https://img.example.com/result.png"}]}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers, json):
            assert json["style"] == "vivid"
            return FakeResponse()

    monkeypatch.setattr("app.services.media_service.httpx.AsyncClient", lambda *a, **k: FakeClient())

    result = await svc.generate("cat", style="vivid")
    assert result == {"data": [{"url": "https://img.example.com/result.png"}]}


@pytest.mark.asyncio
async def test_video_service_generate(monkeypatch):
    svc = VideoService(make_settings())

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"data": [{"url": "https://video.example.com/result.mp4"}]}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers, json):
            assert json["model"] == "video-model"
            return FakeResponse()

    monkeypatch.setattr("app.services.media_service.httpx.AsyncClient", lambda *a, **k: FakeClient())

    result = await svc.generate("scene", duration=5.0)
    assert result == {"data": [{"url": "https://video.example.com/result.mp4"}]}

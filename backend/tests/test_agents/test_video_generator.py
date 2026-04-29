from __future__ import annotations

import pytest
from sqlmodel import select

from app.agents.base import TargetIds
from app.agents.video_generator import VideoGeneratorAgent
from app.models.project import Shot
from app.services.doubao_video import DoubaoVideoService
from tests.agent_fixtures import FakeLLM, FakeVideoService, make_context
from tests.factories import create_project, create_run, create_shot


class _FakeDoubaoVideo(DoubaoVideoService):
    """DoubaoVideoService subclass that passes isinstance check without real HTTP."""

    def __init__(self, url: str = "http://video.test/doubao.mp4"):
        self.url = url
        self.count = 0

    async def generate_url(self, **kwargs):  # type: ignore[override]
        self.count += 1
        return self.url


@pytest.mark.asyncio
async def test_video_generator_creates_videos(test_session, test_settings):
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    shot = await create_shot(test_session, project_id=project.id, video_url=None)

    video = FakeVideoService(url="http://video.test/shot.mp4")
    ctx = await make_context(
        test_session,
        test_settings,
        project=project,
        run=run,
        llm=FakeLLM("{}"),
        video=video,
    )

    agent = VideoGeneratorAgent()
    await agent.run(ctx)

    await test_session.refresh(shot)
    assert shot.video_url == "http://video.test/shot.mp4"
    assert shot.duration == 5.0

    res = await test_session.execute(select(Shot).where(Shot.project_id == project.id))
    assert len(res.scalars().all()) == 1


def test_video_generator_builds_prompt_with_character_context_and_style():
    agent = VideoGeneratorAgent()
    shot = Shot(description="A quiet street", prompt=None, order=1)

    prompt = agent._build_video_prompt(
        shot,
        [
            type("C", (), {"name": "Alice", "description": "hero", "image_url": "x"})(),
        ],
        style=" neon noir ",
    )

    assert "A quiet street" in prompt
    assert "Alice" in prompt
    assert prompt.endswith("neon noir")


def test_video_generator_uses_prompt_when_available():
    agent = VideoGeneratorAgent()
    shot = Shot(description="ignored", prompt="use this", order=1)

    prompt = agent._build_video_prompt(shot, [], style="")

    assert prompt.startswith("use this")


def test_video_generator_prefers_duration_when_present():
    agent = VideoGeneratorAgent()
    shot = Shot(description="x", order=1, duration=7.5)

    assert agent._get_duration(shot, default_duration=5.0) == 7.5


def test_video_generator_falls_back_to_default_duration():
    agent = VideoGeneratorAgent()
    shot = Shot(description="x", order=1, duration=None)

    assert agent._get_duration(shot, default_duration=5.0) == 5.0


def test_video_generator_falls_back_to_description_when_prompt_missing():
    agent = VideoGeneratorAgent()
    shot = Shot(description="fallback", prompt=None, order=1)

    prompt = agent._build_video_prompt(shot, [], style="")

    assert prompt.startswith("fallback")


def test_video_generator_trims_blank_style():
    agent = VideoGeneratorAgent()
    shot = Shot(description="fallback", prompt=None, order=1)

    prompt = agent._build_video_prompt(shot, [], style="   ")

    assert prompt == "fallback"


@pytest.mark.asyncio
async def test_video_generator_emits_no_shots_message_when_none_available(test_session, test_settings):
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)

    ctx = await make_context(
        test_session,
        test_settings,
        project=project,
        run=run,
        llm=FakeLLM("{}"),
        video=FakeVideoService(url="http://video.test/shot.mp4"),
    )

    agent = VideoGeneratorAgent()
    await agent.run(ctx)

    assert any("所有分镜已有视频" in event[1]["data"]["content"] for event in ctx.ws.events)


# ---------------------------------------------------------------------------
# Doubao path (isinstance(ctx.video, DoubaoVideoService))
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_video_generator_doubao_path(test_session, test_settings):
    """Doubao branch: generate_url is called with extra kwargs (duration, ratio, …)."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    shot = await create_shot(test_session, project_id=project.id, video_url=None)

    video = _FakeDoubaoVideo(url="http://video.test/doubao.mp4")
    ctx = await make_context(
        test_session,
        test_settings,
        project=project,
        run=run,
        llm=FakeLLM("{}"),
        video=video,
    )

    agent = VideoGeneratorAgent()
    await agent.run(ctx)

    await test_session.refresh(shot)
    assert shot.video_url == "http://video.test/doubao.mp4"
    assert video.count == 1


@pytest.mark.asyncio
async def test_video_generator_doubao_first_frame_mode(test_session, test_settings, monkeypatch):
    """Doubao + image_mode=first_frame: image_url is passed as-is."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    shot = await create_shot(
        test_session,
        project_id=project.id,
        video_url=None,
        image_url="http://test.com/shot.png",
    )

    video = _FakeDoubaoVideo()
    # Enable i2v
    monkeypatch.setattr(test_settings, "enable_image_to_video", True)
    monkeypatch.setattr(test_settings, "video_image_mode", "first_frame")

    ctx = await make_context(
        test_session,
        test_settings,
        project=project,
        run=run,
        llm=FakeLLM("{}"),
        video=video,
    )

    agent = VideoGeneratorAgent()
    await agent.run(ctx)

    await test_session.refresh(shot)
    assert shot.video_url == "http://video.test/doubao.mp4"


@pytest.mark.asyncio
async def test_video_generator_doubao_reference_mode(test_session, test_settings, monkeypatch):
    """Doubao + image_mode=reference: compose_and_save_reference_image is called."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    shot = await create_shot(
        test_session,
        project_id=project.id,
        video_url=None,
        image_url="http://test.com/shot.png",
    )

    video = _FakeDoubaoVideo()
    monkeypatch.setattr(test_settings, "enable_image_to_video", True)
    monkeypatch.setattr(test_settings, "video_image_mode", "reference")

    ctx = await make_context(
        test_session,
        test_settings,
        project=project,
        run=run,
        llm=FakeLLM("{}"),
        video=video,
    )

    agent = VideoGeneratorAgent()
    # Stub compose_and_save_reference_image to avoid real downloads
    compose_calls: list[tuple] = []

    async def _fake_compose_and_save(**kwargs):
        compose_calls.append(kwargs)
        return "/static/images/composed_fake.png"

    agent.image_composer.compose_and_save_reference_image = _fake_compose_and_save  # type: ignore[assignment]
    await agent.run(ctx)

    await test_session.refresh(shot)
    assert shot.video_url == "http://video.test/doubao.mp4"
    assert len(compose_calls) == 1


@pytest.mark.asyncio
async def test_video_generator_doubao_reference_mode_fallback(test_session, test_settings, monkeypatch):
    """Doubao + reference mode: when compose_and_save raises, falls back to shot.image_url."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    shot = await create_shot(
        test_session,
        project_id=project.id,
        video_url=None,
        image_url="http://test.com/shot.png",
    )

    video = _FakeDoubaoVideo()
    monkeypatch.setattr(test_settings, "enable_image_to_video", True)
    monkeypatch.setattr(test_settings, "video_image_mode", "reference")

    ctx = await make_context(
        test_session,
        test_settings,
        project=project,
        run=run,
        llm=FakeLLM("{}"),
        video=video,
    )

    agent = VideoGeneratorAgent()

    async def _fail_compose(**kwargs):
        raise RuntimeError("compose exploded")

    agent.image_composer.compose_and_save_reference_image = _fail_compose  # type: ignore[assignment]
    await agent.run(ctx)

    await test_session.refresh(shot)
    assert shot.video_url == "http://video.test/doubao.mp4"
    # Should have sent the fallback message
    assert any("参考图生成失败" in evt[1]["data"]["content"] for evt in ctx.ws.events)


# ---------------------------------------------------------------------------
# Non-doubao reference mode (compose_reference_image)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_video_generator_non_doubao_reference_mode(test_session, test_settings, monkeypatch):
    """Non-doubao + image_mode=reference: compose_reference_image returns bytes."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    shot = await create_shot(
        test_session,
        project_id=project.id,
        video_url=None,
        image_url="http://test.com/shot.png",
    )

    video = FakeVideoService(url="http://video.test/openai.mp4")
    monkeypatch.setattr(test_settings, "enable_image_to_video", True)
    monkeypatch.setattr(test_settings, "video_image_mode", "reference")

    ctx = await make_context(
        test_session,
        test_settings,
        project=project,
        run=run,
        llm=FakeLLM("{}"),
        video=video,
    )

    agent = VideoGeneratorAgent()
    compose_calls: list[tuple] = []

    async def _fake_compose_reference(**kwargs):
        compose_calls.append(kwargs)
        return b"\x89PNG_fake_bytes"

    agent.image_composer.compose_reference_image = _fake_compose_reference  # type: ignore[assignment]
    await agent.run(ctx)

    await test_session.refresh(shot)
    assert shot.video_url == "http://video.test/openai.mp4"
    assert len(compose_calls) == 1


@pytest.mark.asyncio
async def test_video_generator_non_doubao_reference_fallback(test_session, test_settings, monkeypatch):
    """Non-doubao + reference mode: when compose_reference_image raises, reference_image_bytes is None."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    shot = await create_shot(
        test_session,
        project_id=project.id,
        video_url=None,
        image_url="http://test.com/shot.png",
    )

    video = FakeVideoService(url="http://video.test/openai.mp4")
    monkeypatch.setattr(test_settings, "enable_image_to_video", True)
    monkeypatch.setattr(test_settings, "video_image_mode", "reference")

    ctx = await make_context(
        test_session,
        test_settings,
        project=project,
        run=run,
        llm=FakeLLM("{}"),
        video=video,
    )

    agent = VideoGeneratorAgent()

    async def _fail_compose(**kwargs):
        raise RuntimeError("compose exploded")

    agent.image_composer.compose_reference_image = _fail_compose  # type: ignore[assignment]
    await agent.run(ctx)

    await test_session.refresh(shot)
    assert shot.video_url == "http://video.test/openai.mp4"
    assert any("参考图生成失败" in evt[1]["data"]["content"] for evt in ctx.ws.events)


@pytest.mark.asyncio
async def test_video_generator_non_doubao_first_frame_mode(test_session, test_settings, monkeypatch):
    """Non-doubao + image_mode=first_frame: compose_reference_image called with empty character list."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    shot = await create_shot(
        test_session,
        project_id=project.id,
        video_url=None,
        image_url="http://test.com/shot.png",
    )

    video = FakeVideoService(url="http://video.test/openai.mp4")
    monkeypatch.setattr(test_settings, "enable_image_to_video", True)
    monkeypatch.setattr(test_settings, "video_image_mode", "first_frame")

    ctx = await make_context(
        test_session,
        test_settings,
        project=project,
        run=run,
        llm=FakeLLM("{}"),
        video=video,
    )

    agent = VideoGeneratorAgent()
    compose_calls: list[tuple] = []

    async def _fake_compose_reference(**kwargs):
        compose_calls.append(kwargs)
        return b"\x89PNG_fake_bytes"

    agent.image_composer.compose_reference_image = _fake_compose_reference  # type: ignore[assignment]
    await agent.run(ctx)

    await test_session.refresh(shot)
    assert shot.video_url == "http://video.test/openai.mp4"
    assert len(compose_calls) == 1
    # first_frame mode passes empty character list
    assert compose_calls[0]["character_image_urls"] == []


# ---------------------------------------------------------------------------
# Partial failure / all-shots-fail
# ---------------------------------------------------------------------------

class _FailingVideoService(FakeVideoService):
    """A video service that raises on every generate_url call."""

    async def generate_url(self, **kwargs):
        raise RuntimeError("boom")


class _PartialFailVideoService(FakeVideoService):
    """Fails on the first call, succeeds on subsequent calls."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._call = 0

    async def generate_url(self, **kwargs):
        self._call += 1
        if self._call == 1:
            raise RuntimeError("first shot fails")
        return self.url


@pytest.mark.asyncio
async def test_video_generator_partial_failure(test_session, test_settings):
    """When one shot fails but others succeed, error is sent and others are processed."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    shot1 = await create_shot(test_session, project_id=project.id, order=1, video_url=None)
    shot2 = await create_shot(test_session, project_id=project.id, order=2, video_url=None)

    video = _PartialFailVideoService(url="http://video.test/ok.mp4")
    ctx = await make_context(
        test_session,
        test_settings,
        project=project,
        run=run,
        llm=FakeLLM("{}"),
        video=video,
    )

    agent = VideoGeneratorAgent()
    await agent.run(ctx)

    await test_session.refresh(shot1)
    await test_session.refresh(shot2)
    # First shot should have failed (video_url still None)
    assert shot1.video_url is None
    # Second shot should succeed
    assert shot2.video_url == "http://video.test/ok.mp4"
    # Error message should have been sent
    assert any("视频生成失败" in evt[1]["data"]["content"] for evt in ctx.ws.events)


@pytest.mark.asyncio
async def test_video_generator_all_shots_fail(test_session, test_settings):
    """When all shots fail, sends the 'all failed' message."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    await create_shot(test_session, project_id=project.id, order=1, video_url=None)
    await create_shot(test_session, project_id=project.id, order=2, video_url=None)

    video = _FailingVideoService()
    ctx = await make_context(
        test_session,
        test_settings,
        project=project,
        run=run,
        llm=FakeLLM("{}"),
        video=video,
    )

    agent = VideoGeneratorAgent()
    await agent.run(ctx)

    assert any("所有分镜视频生成均失败" in evt[1]["data"]["content"] for evt in ctx.ws.events)


# ---------------------------------------------------------------------------
# target_ids filtering
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_video_generator_target_ids_filtering(test_session, test_settings):
    """When target_ids.shot_ids is set, only those shots are processed."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    shot1 = await create_shot(test_session, project_id=project.id, order=1, video_url=None)
    shot2 = await create_shot(test_session, project_id=project.id, order=2, video_url=None)

    video = FakeVideoService(url="http://video.test/filtered.mp4")
    ctx = await make_context(
        test_session,
        test_settings,
        project=project,
        run=run,
        llm=FakeLLM("{}"),
        video=video,
    )
    # Only target shot2
    ctx.target_ids = TargetIds(shot_ids=[shot2.id])

    agent = VideoGeneratorAgent()
    await agent.run(ctx)

    await test_session.refresh(shot1)
    await test_session.refresh(shot2)
    # shot1 should remain unchanged (still no video)
    assert shot1.video_url is None
    # shot2 should have been updated
    assert shot2.video_url == "http://video.test/filtered.mp4"
    assert video.count == 1


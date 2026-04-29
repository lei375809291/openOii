from __future__ import annotations

import pytest
from sqlmodel import select

from app.agents.base import TargetIds
from app.agents.storyboard_artist import StoryboardArtistAgent
from app.config import Settings
from app.models.project import Shot
from tests.agent_fixtures import FakeImageService, FakeLLM, make_context
from tests.factories import create_project, create_run, create_shot


@pytest.mark.asyncio
async def test_storyboard_artist_generates_shot_images(test_session, test_settings):
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    shot = await create_shot(test_session, project_id=project.id, image_url=None)

    image = FakeImageService(url="http://image.test/shot.png")
    ctx = await make_context(
        test_session,
        test_settings,
        project=project,
        run=run,
        llm=FakeLLM("{}"),
        image=image,
    )

    agent = StoryboardArtistAgent()
    await agent.run(ctx)

    await test_session.refresh(shot)
    assert shot.image_url == "http://image.test/shot.png"
    assert any(event[1]["type"] == "shot_updated" for event in ctx.ws.events)

    res = await test_session.execute(select(Shot).where(Shot.project_id == project.id))
    assert len(res.scalars().all()) == 1


def test_storyboard_artist_builds_prompt_with_character_context_and_style():
    agent = StoryboardArtistAgent()
    shot = Shot(description="A quiet street", image_prompt=None, order=1)

    prompt = agent._build_image_prompt(
        shot,
        [
            type("C", (), {"name": "Alice", "description": "hero", "image_url": "x"})(),
        ],
        style=" watercolor ",
    )

    assert "A quiet street" in prompt
    assert "Alice" in prompt
    assert "anime, 2D illustration" in prompt
    assert prompt.endswith("watercolor")


def test_storyboard_artist_uses_image_prompt_when_available():
    agent = StoryboardArtistAgent()
    shot = Shot(description="ignored", image_prompt="close-up", order=1)

    prompt = agent._build_image_prompt(shot, [], style="")

    assert prompt.startswith("close-up")


def test_storyboard_artist_falls_back_to_description_when_image_prompt_missing():
    agent = StoryboardArtistAgent()
    shot = Shot(description="fallback description", image_prompt=None, order=1)

    prompt = agent._build_image_prompt(shot, [], style="")

    assert prompt.startswith("fallback description")


def test_storyboard_artist_trims_blank_style():
    agent = StoryboardArtistAgent()
    shot = Shot(description="fallback description", image_prompt=None, order=1)

    prompt = agent._build_image_prompt(shot, [], style="   ")

    assert prompt.startswith("fallback description")


@pytest.mark.asyncio
async def test_storyboard_artist_emits_no_shots_message_when_none_available(test_session, test_settings):
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)

    ctx = await make_context(
        test_session,
        test_settings,
        project=project,
        run=run,
        llm=FakeLLM("{}"),
        image=FakeImageService(url="http://image.test/shot.png"),
    )

    agent = StoryboardArtistAgent()
    await agent.run(ctx)

    assert any("所有分镜已有首帧图片" in event[1]["data"]["content"] for event in ctx.ws.events)


@pytest.mark.asyncio
async def test_i2i_mode_compose_success(test_session, test_settings, monkeypatch):
    """When use_i2i() is True and character images exist, compose is called."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    shot = await create_shot(test_session, project_id=project.id, image_url=None, order=1)

    fake_char = type(
        "C", (), {"name": "Alice", "description": "hero", "image_url": "http://img.test/char.png"}
    )()
    async def _fake_resolve(_session, _shot):
        return [fake_char]

    monkeypatch.setattr(
        "app.agents.storyboard_artist.resolve_shot_bound_approved_characters",
        _fake_resolve,
    )
    monkeypatch.setattr(Settings, "use_i2i", lambda _self: True)

    class FakeComposer:
        async def compose_character_reference_image(self, urls):
            return b"\x89PNG_FAKE"

    image = FakeImageService(url="http://image.test/i2i.png")
    ctx = await make_context(test_session, test_settings, project=project, run=run, image=image)

    agent = StoryboardArtistAgent()
    agent.image_composer = FakeComposer()  # type: ignore[assignment]

    await agent.run(ctx)

    await test_session.refresh(shot)
    assert shot.image_url == "http://image.test/i2i.png"


@pytest.mark.asyncio
async def test_i2i_mode_compose_failure_falls_back(test_session, test_settings, monkeypatch):
    """When compose raises, agent falls back to text-to-image."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    shot = await create_shot(test_session, project_id=project.id, image_url=None, order=1)

    fake_char = type(
        "C", (), {"name": "Bob", "description": "villain", "image_url": "http://img.test/char2.png"}
    )()
    async def _fake_resolve(_session, _shot):
        return [fake_char]

    monkeypatch.setattr(
        "app.agents.storyboard_artist.resolve_shot_bound_approved_characters",
        _fake_resolve,
    )
    monkeypatch.setattr(Settings, "use_i2i", lambda _self: True)

    class BrokenComposer:
        async def compose_character_reference_image(self, urls):
            raise RuntimeError("download failed")

    image = FakeImageService(url="http://image.test/fallback.png")
    ctx = await make_context(test_session, test_settings, project=project, run=run, image=image)

    agent = StoryboardArtistAgent()
    agent.image_composer = BrokenComposer()  # type: ignore[assignment]

    await agent.run(ctx)

    await test_session.refresh(shot)
    # Should still succeed via text-to-image fallback
    assert shot.image_url == "http://image.test/fallback.png"


@pytest.mark.asyncio
async def test_i2i_mode_no_character_images_falls_back(test_session, test_settings, monkeypatch):
    """When use_i2i() is True but no character images exist, falls back to text-to-image."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    shot = await create_shot(test_session, project_id=project.id, image_url=None, order=1)

    # Characters exist but have no image_url
    fake_char = type(
        "C", (), {"name": "Charlie", "description": "sidekick", "image_url": None}
    )()

    async def _fake_resolve(_session, _shot):
        return [fake_char]

    monkeypatch.setattr(
        "app.agents.storyboard_artist.resolve_shot_bound_approved_characters",
        _fake_resolve,
    )
    monkeypatch.setattr(Settings, "use_i2i", lambda _self: True)

    image = FakeImageService(url="http://image.test/noi2i.png")
    ctx = await make_context(test_session, test_settings, project=project, run=run, image=image)

    agent = StoryboardArtistAgent()
    await agent.run(ctx)

    await test_session.refresh(shot)
    assert shot.image_url == "http://image.test/noi2i.png"


@pytest.mark.asyncio
async def test_partial_failure_continues_remaining_shots(test_session, test_settings, monkeypatch):
    """When one shot fails, the agent continues with the rest."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    shot_ok = await create_shot(test_session, project_id=project.id, image_url=None, order=1)
    shot_fail = await create_shot(test_session, project_id=project.id, image_url=None, order=2)
    shot_ok2 = await create_shot(test_session, project_id=project.id, image_url=None, order=3)

    call_count = 0
    original_generate = StoryboardArtistAgent.generate_and_cache_image

    async def controlled_generate(self, ctx, *, prompt, image_bytes=None, timeout_s=None):
        nonlocal call_count
        call_count += 1
        if call_count == 2:
            raise RuntimeError("API error")
        return await original_generate(self, ctx, prompt=prompt, image_bytes=image_bytes, timeout_s=timeout_s)

    monkeypatch.setattr(StoryboardArtistAgent, "generate_and_cache_image", controlled_generate)

    ctx = await make_context(test_session, test_settings, project=project, run=run)

    agent = StoryboardArtistAgent()
    await agent.run(ctx)

    # First and third shots should succeed
    await test_session.refresh(shot_ok)
    await test_session.refresh(shot_fail)
    await test_session.refresh(shot_ok2)
    assert shot_ok.image_url is not None
    assert shot_fail.image_url is None
    assert shot_ok2.image_url is not None

    # Error message for the failed shot
    error_msgs = [e for e in ctx.ws.events if "首帧图片生成失败" in str(e)]
    assert len(error_msgs) >= 1

    # Success message with failure count
    success_msgs = [
        e for e in ctx.ws.events
        if isinstance(e[1], dict)
        and isinstance(e[1].get("data"), dict)
        and "失败" in e[1]["data"].get("content", "")
        and "✅" in e[1]["data"].get("content", "")
    ]
    assert len(success_msgs) >= 1


@pytest.mark.asyncio
async def test_all_shots_fail(test_session, test_settings, monkeypatch):
    """When all shots fail, sends the all-fail message."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    await create_shot(test_session, project_id=project.id, image_url=None, order=1)
    await create_shot(test_session, project_id=project.id, image_url=None, order=2)

    async def always_fail(self, ctx, *, prompt, image_bytes=None, timeout_s=None):
        raise RuntimeError("always fails")

    monkeypatch.setattr(StoryboardArtistAgent, "generate_and_cache_image", always_fail)

    ctx = await make_context(test_session, test_settings, project=project, run=run)

    agent = StoryboardArtistAgent()
    await agent.run(ctx)

    all_fail_msgs = [
        e for e in ctx.ws.events
        if isinstance(e[1], dict)
        and isinstance(e[1].get("data"), dict)
        and "均失败" in e[1]["data"].get("content", "")
    ]
    assert len(all_fail_msgs) >= 1


@pytest.mark.asyncio
async def test_success_message_includes_failure_count(test_session, test_settings, monkeypatch):
    """When some succeed and some fail, the success message includes failure count."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    await create_shot(test_session, project_id=project.id, image_url=None, order=1)
    await create_shot(test_session, project_id=project.id, image_url=None, order=2)
    await create_shot(test_session, project_id=project.id, image_url=None, order=3)

    call_count = 0

    async def fail_second(self, ctx, *, prompt, image_bytes=None, timeout_s=None):
        nonlocal call_count
        call_count += 1
        if call_count == 2:
            raise RuntimeError("boom")
        return "http://image.test/ok.png"

    monkeypatch.setattr(StoryboardArtistAgent, "generate_and_cache_image", fail_second)

    ctx = await make_context(test_session, test_settings, project=project, run=run)

    agent = StoryboardArtistAgent()
    await agent.run(ctx)

    messages = [
        e[1]["data"]["content"]
        for e in ctx.ws.events
        if isinstance(e[1], dict)
        and isinstance(e[1].get("data"), dict)
        and "✅" in e[1]["data"].get("content", "")
    ]
    assert any("1 个失败" in msg for msg in messages)


@pytest.mark.asyncio
async def test_target_ids_filtering(test_session, test_settings):
    """When target_ids.shot_ids is set, only those shots are processed."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    shot_targeted = await create_shot(test_session, project_id=project.id, image_url=None, order=1)
    shot_ignored = await create_shot(test_session, project_id=project.id, image_url=None, order=2)

    ctx = await make_context(test_session, test_settings, project=project, run=run)
    ctx.target_ids = TargetIds(shot_ids=[shot_targeted.id])  # type: ignore[arg-type]

    agent = StoryboardArtistAgent()
    await agent.run(ctx)

    await test_session.refresh(shot_targeted)
    await test_session.refresh(shot_ignored)
    assert shot_targeted.image_url is not None
    # The ignored shot should NOT have been processed (still None)
    assert shot_ignored.image_url is None


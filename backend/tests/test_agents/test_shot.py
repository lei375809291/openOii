from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.agents.shot import ShotAgent
from app.agents.base import TargetIds
from tests.agent_fixtures import FakeImageService, make_context
from tests.factories import create_character, create_project, create_run, create_shot


@pytest.mark.asyncio
async def test_shot_agent_generates_images(test_session, test_settings, monkeypatch):
    project = await create_project(test_session, style="anime")
    run = await create_run(test_session, project_id=project.id)
    shot = await create_shot(test_session, project_id=project.id, image_url=None)
    await test_session.commit()

    image = FakeImageService(url="http://image.test/shot.png")
    ctx = await make_context(test_session, test_settings, project=project, run=run, image=image)
    agent = ShotAgent()

    monkeypatch.setattr(agent, "generate_and_cache_image", AsyncMock(return_value="http://image.test/shot.png"))
    monkeypatch.setattr(
        "app.agents.shot.resolve_shot_bound_approved_characters",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr("asyncio.sleep", AsyncMock(return_value=None))

    count = await agent._render_shots(ctx)
    assert count == 1

    await test_session.refresh(shot)
    assert shot.image_url == "http://image.test/shot.png"


@pytest.mark.asyncio
async def test_shot_agent_skips_shots_with_images(test_session, test_settings):
    project = await create_project(test_session, style="anime")
    run = await create_run(test_session, project_id=project.id)
    await create_shot(test_session, project_id=project.id, image_url="http://img.test/already.png")
    await test_session.commit()

    image = FakeImageService()
    ctx = await make_context(test_session, test_settings, project=project, run=run, image=image)
    agent = ShotAgent()

    count = await agent._render_shots(ctx)
    assert count == 0


@pytest.mark.asyncio
async def test_shot_agent_target_ids_filter(test_session, test_settings, monkeypatch):
    project = await create_project(test_session, style="anime")
    run = await create_run(test_session, project_id=project.id)
    shot1 = await create_shot(test_session, project_id=project.id, image_url=None)
    await create_shot(test_session, project_id=project.id, image_url=None)
    await test_session.commit()

    image = FakeImageService(url="http://image.test/shot1.png")
    ctx = await make_context(test_session, test_settings, project=project, run=run, image=image)
    ctx.target_ids = TargetIds(shot_ids=[shot1.id])
    agent = ShotAgent()

    monkeypatch.setattr(agent, "generate_and_cache_image", AsyncMock(return_value="http://image.test/shot1.png"))
    monkeypatch.setattr(
        "app.agents.shot.resolve_shot_bound_approved_characters",
        AsyncMock(return_value=[]),
    )

    count = await agent._render_shots(ctx)
    assert count == 1


@pytest.mark.asyncio
async def test_shot_agent_image_failure(test_session, test_settings, monkeypatch):
    project = await create_project(test_session, style="anime")
    run = await create_run(test_session, project_id=project.id)
    await create_shot(test_session, project_id=project.id, image_url=None)
    await test_session.commit()

    image = FakeImageService()
    ctx = await make_context(test_session, test_settings, project=project, run=run, image=image)
    agent = ShotAgent()

    monkeypatch.setattr(agent, "generate_and_cache_image", AsyncMock(side_effect=RuntimeError("API down")))
    monkeypatch.setattr(
        "app.agents.shot.resolve_shot_bound_approved_characters",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr("asyncio.sleep", AsyncMock(return_value=None))

    count = await agent._render_shots(ctx)
    assert count == 0


@pytest.mark.asyncio
async def test_shot_agent_compose_reference_fails_fallback(test_session, test_settings, monkeypatch):
    project = await create_project(test_session, style="anime")
    run = await create_run(test_session, project_id=project.id)
    await create_shot(test_session, project_id=project.id, image_url=None)
    char = await create_character(test_session, project_id=project.id, image_url="http://img.test/char.png")
    await test_session.commit()

    image = FakeImageService(url="http://image.test/shot.png")
    ctx = await make_context(test_session, test_settings, project=project, run=run, image=image)
    agent = ShotAgent()

    monkeypatch.setattr(agent, "generate_and_cache_image", AsyncMock(return_value="http://image.test/shot.png"))
    monkeypatch.setattr(
        "app.agents.shot.resolve_shot_bound_approved_characters",
        AsyncMock(return_value=[char]),
    )
    monkeypatch.setattr(agent.image_composer, "compose_character_reference_image", AsyncMock(side_effect=RuntimeError("compose fail")))
    monkeypatch.setattr("asyncio.sleep", AsyncMock(return_value=None))

    count = await agent._render_shots(ctx)
    assert count == 1


@pytest.mark.asyncio
async def test_shot_agent_full_run(test_session, test_settings, monkeypatch):
    project = await create_project(test_session, style="anime")
    run = await create_run(test_session, project_id=project.id)
    shot = await create_shot(test_session, project_id=project.id, image_url=None)
    await test_session.commit()

    image = FakeImageService(url="http://image.test/shot.png")
    ctx = await make_context(test_session, test_settings, project=project, run=run, image=image)
    agent = ShotAgent()

    monkeypatch.setattr(agent, "generate_and_cache_image", AsyncMock(return_value="http://image.test/shot.png"))
    monkeypatch.setattr(
        "app.agents.shot.resolve_shot_bound_approved_characters",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr("asyncio.sleep", AsyncMock(return_value=None))

    await agent.run(ctx)

    await test_session.refresh(shot)
    assert shot.image_url is not None
    assert ctx.completion_info is not None
    assert "1" in ctx.completion_info.completed


def test_style_descriptor_anime():
    agent = ShotAgent()
    result = agent._style_descriptor("anime")
    assert "anime" in result


def test_style_descriptor_unknown():
    agent = ShotAgent()
    result = agent._style_descriptor("nonexistent_style")
    assert "anime" in result


def test_style_descriptor_cinematic():
    agent = ShotAgent()
    result = agent._style_descriptor("cinematic")
    assert "photorealistic" in result


def test_build_shot_prompt():
    from app.models.project import Shot as ShotModel

    agent = ShotAgent()
    shot = ShotModel(id=1, project_id=1, order=1, description="test", image_prompt="hero in forest", prompt=None, scene=None, action=None, expression=None, camera=None, lighting=None, dialogue=None, sfx=None, duration=None, image_url=None, video_url=None, character_ids=[])
    result = agent._build_shot_prompt(shot, [], style="anime")
    assert "hero in forest" in result
    assert "anime" in result


def test_build_shot_prompt_no_image_prompt():
    from app.models.project import Shot as ShotModel

    agent = ShotAgent()
    shot = ShotModel(id=1, project_id=1, order=1, description="fallback desc", image_prompt=None, prompt=None, scene=None, action=None, expression=None, camera=None, lighting=None, dialogue=None, sfx=None, duration=None, image_url=None, video_url=None, character_ids=[])
    result = agent._build_shot_prompt(shot, [], style="cinematic")
    assert "fallback desc" in result


def test_build_shot_prompt_with_characters():
    from app.models.project import Character as CharModel, Shot as ShotModel

    agent = ShotAgent()
    shot = ShotModel(id=1, project_id=1, order=1, description="test", image_prompt="scene", prompt=None, scene=None, action=None, expression=None, camera=None, lighting=None, dialogue=None, sfx=None, duration=None, image_url=None, video_url=None, character_ids=[])
    char = CharModel(id=1, project_id=1, name="Hero", description="warrior", image_url=None)
    result = agent._build_shot_prompt(shot, [char], style="anime")
    assert "Hero" in result

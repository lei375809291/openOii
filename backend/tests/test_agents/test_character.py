from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.agents.character import CharacterAgent
from app.agents.base import TargetIds
from tests.agent_fixtures import FakeImageService, make_context
from tests.factories import create_character, create_project, create_run


@pytest.mark.asyncio
async def test_character_agent_generates_images(test_session, test_settings, monkeypatch):
    project = await create_project(test_session, style="anime")
    run = await create_run(test_session, project_id=project.id)
    char = await create_character(test_session, project_id=project.id, image_url=None)
    await test_session.commit()

    image = FakeImageService(url="http://image.test/char.png")
    ctx = await make_context(test_session, test_settings, project=project, run=run, image=image)
    agent = CharacterAgent()

    monkeypatch.setattr(agent, "generate_and_cache_image", AsyncMock(return_value="http://image.test/char.png"))

    count = await agent._render_characters(ctx)
    assert count == 1

    await test_session.refresh(char)
    assert char.image_url == "http://image.test/char.png"


@pytest.mark.asyncio
async def test_character_agent_skips_characters_with_images(test_session, test_settings):
    project = await create_project(test_session, style="anime")
    run = await create_run(test_session, project_id=project.id)
    await create_character(test_session, project_id=project.id, image_url="http://img.test/already.png")
    await test_session.commit()

    image = FakeImageService()
    ctx = await make_context(test_session, test_settings, project=project, run=run, image=image)
    agent = CharacterAgent()

    count = await agent._render_characters(ctx)
    assert count == 0


@pytest.mark.asyncio
async def test_character_agent_target_ids_filter(test_session, test_settings, monkeypatch):
    project = await create_project(test_session, style="anime")
    run = await create_run(test_session, project_id=project.id)
    char1 = await create_character(test_session, project_id=project.id, image_url=None)
    char2 = await create_character(test_session, project_id=project.id, image_url=None)
    await test_session.commit()

    image = FakeImageService(url="http://image.test/char1.png")
    ctx = await make_context(test_session, test_settings, project=project, run=run, image=image)
    ctx.target_ids = TargetIds(character_ids=[char1.id])
    agent = CharacterAgent()

    monkeypatch.setattr(agent, "generate_and_cache_image", AsyncMock(return_value="http://image.test/char1.png"))

    count = await agent._render_characters(ctx)
    assert count == 1

    await test_session.refresh(char1)
    await test_session.refresh(char2)
    assert char1.image_url is not None
    assert char2.image_url is None


@pytest.mark.asyncio
async def test_character_agent_image_failure(test_session, test_settings, monkeypatch):
    project = await create_project(test_session, style="anime")
    run = await create_run(test_session, project_id=project.id)
    await create_character(test_session, project_id=project.id, image_url=None)
    await test_session.commit()

    image = FakeImageService()
    ctx = await make_context(test_session, test_settings, project=project, run=run, image=image)
    agent = CharacterAgent()

    monkeypatch.setattr(agent, "generate_and_cache_image", AsyncMock(side_effect=RuntimeError("API down")))

    count = await agent._render_characters(ctx)
    assert count == 0

    msg_events = [e for pid, e in ctx.ws.events if e["type"] == "run_message"]
    assert any("图片生成失败" in e["data"]["content"] for e in msg_events)


@pytest.mark.asyncio
async def test_character_agent_full_run(test_session, test_settings, monkeypatch):
    project = await create_project(test_session, style="anime")
    run = await create_run(test_session, project_id=project.id)
    char = await create_character(test_session, project_id=project.id, image_url=None)
    await test_session.commit()

    image = FakeImageService(url="http://image.test/char.png")
    ctx = await make_context(test_session, test_settings, project=project, run=run, image=image)
    agent = CharacterAgent()

    monkeypatch.setattr(agent, "generate_and_cache_image", AsyncMock(return_value="http://image.test/char.png"))

    await agent.run(ctx)

    await test_session.refresh(char)
    assert char.image_url is not None
    assert ctx.completion_info is not None
    assert "1" in ctx.completion_info.completed


def test_style_descriptor_anime():
    agent = CharacterAgent()
    result = agent._style_descriptor("anime")
    assert "anime" in result


def test_style_descriptor_unknown():
    agent = CharacterAgent()
    result = agent._style_descriptor("nonexistent_style")
    assert "anime" in result


def test_style_descriptor_cinematic():
    agent = CharacterAgent()
    result = agent._style_descriptor("cinematic")
    assert "photorealistic" in result


def test_build_character_prompt():
    from app.models.project import Character as CharModel

    agent = CharacterAgent()
    char = CharModel(id=1, project_id=1, name="Hero", description="brave warrior", image_url=None)
    result = agent._build_character_prompt(char, style="anime")
    assert "brave warrior" in result
    assert "anime" in result


def test_build_character_prompt_no_description():
    from app.models.project import Character as CharModel

    agent = CharacterAgent()
    char = CharModel(id=1, project_id=1, name="Hero", description=None, image_url=None)
    result = agent._build_character_prompt(char, style="anime")
    assert "Hero" in result

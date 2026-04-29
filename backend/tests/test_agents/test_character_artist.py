from __future__ import annotations

import pytest
from sqlmodel import select

from app.agents.character_artist import CharacterArtistAgent
from app.models.project import Character
from tests.agent_fixtures import FakeImageService, FakeLLM, make_context
from tests.factories import create_character, create_project, create_run


@pytest.mark.asyncio
async def test_character_artist_generates_images(test_session, test_settings):
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    character = await create_character(test_session, project_id=project.id, image_url=None)

    image = FakeImageService(url="http://image.test/hero.png")
    ctx = await make_context(
        test_session,
        test_settings,
        project=project,
        run=run,
        llm=FakeLLM("{}"),
        image=image,
    )

    agent = CharacterArtistAgent()
    await agent.run(ctx)

    await test_session.refresh(character)
    assert character.image_url == "http://image.test/hero.png"
    assert any(event[1]["type"] == "character_updated" for event in ctx.ws.events)

    res = await test_session.execute(select(Character).where(Character.project_id == project.id))
    assert len(res.scalars().all()) == 1


@pytest.mark.asyncio
async def test_build_image_prompt_includes_description_and_style():
    agent = CharacterArtistAgent()
    character = Character(name="Hero", description="Brave hero")

    prompt = agent._build_image_prompt(character, style="cinematic")

    assert "Brave hero" in prompt
    assert "cinematic" in prompt
    assert "anime" in prompt


@pytest.mark.asyncio
async def test_build_image_prompt_falls_back_to_name_when_description_missing():
    agent = CharacterArtistAgent()
    character = Character(name="Hero", description=None)

    prompt = agent._build_image_prompt(character, style="")

    assert prompt.startswith("Hero,")


@pytest.mark.asyncio
async def test_run_for_character_handles_generation_failure(monkeypatch, test_session, test_settings):
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    character = await create_character(test_session, project_id=project.id, image_url=None)
    ctx = await make_context(test_session, test_settings, project=project, run=run)

    agent = CharacterArtistAgent()

    async def boom(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(agent, "generate_and_cache_image", boom)

    await agent.run_for_character(ctx, character)

    assert any("图片生成失败" in event[1]["data"]["content"] for event in ctx.ws.events)


@pytest.mark.asyncio
async def test_run_when_no_characters_sends_done_message(test_session, test_settings):
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    ctx = await make_context(test_session, test_settings, project=project, run=run)

    agent = CharacterArtistAgent()
    await agent.run(ctx)

    assert any("所有角色已有图片" in event[1]["data"]["content"] for event in ctx.ws.events)


@pytest.mark.asyncio
async def test_single_character_artist_rejects_wrong_project(test_session, test_settings):
    project = await create_project(test_session)
    other_project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    await create_character(test_session, project_id=other_project.id, image_url=None)
    ctx = await make_context(test_session, test_settings, project=project, run=run)

    from app.agents.character_artist import SingleCharacterArtistAgent

    agent = SingleCharacterArtistAgent(character_id=1)
    await agent.run(ctx)

    assert any("未找到指定角色" in event[1]["data"]["content"] for event in ctx.ws.events)

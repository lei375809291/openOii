from __future__ import annotations

import json

import pytest
from sqlmodel import select

from app.agents.onboarding import OnboardingAgent
from app.models.message import Message
from tests.agent_fixtures import FakeLLM, make_context


@pytest.mark.asyncio
async def test_onboarding_updates_project_and_messages(test_session, test_settings):
    payload = {
        "story_breakdown": {"logline": "Test logline"},
        "key_elements": {"characters": ["Hero"]},
        "style_recommendation": {"primary": "anime"},
        "project_update": {"title": "New Title", "story": "New story", "style": "anime"},
    }
    llm = FakeLLM(json.dumps(payload))
    ctx = await make_context(test_session, test_settings, llm=llm)

    agent = OnboardingAgent()
    await agent.run(ctx)

    await test_session.refresh(ctx.project)
    assert ctx.project.status == "planning"
    assert ctx.project.title == "New Title"

    res = await test_session.execute(select(Message).where(Message.run_id == ctx.run.id))
    messages = res.scalars().all()
    assert len(messages) >= 2
    assert any(event[1]["type"] == "project_updated" for event in ctx.ws.events)


@pytest.mark.asyncio
async def test_onboarding_skips_empty_update_fields(test_session, test_settings):
    payload = {
        "story_breakdown": {},
        "key_elements": {},
        "style_recommendation": {},
        "project_update": {"title": "   ", "story": None, "style": ""},
    }
    llm = FakeLLM(json.dumps(payload))
    ctx = await make_context(test_session, test_settings, llm=llm)

    agent = OnboardingAgent()
    await agent.run(ctx)

    await test_session.refresh(ctx.project)
    assert ctx.project.status == "planning"
    assert ctx.project.title != "   "


@pytest.mark.asyncio
async def test_onboarding_all_fields_covered(test_session, test_settings):
    """Cover genre/themes/setting/tone display lines."""
    payload = {
        "story_breakdown": {
            "logline": "A hero's journey",
            "genre": ["Fantasy", "Adventure"],
            "themes": ["courage", "friendship"],
            "setting": "Middle Earth",
            "tone": "Epic",
        },
        "key_elements": {"characters": ["Frodo", "Gandalf"]},
        "style_recommendation": {"primary": "anime", "rationale": "High detail"},
        "project_update": {"title": "Updated", "story": "New story", "style": "anime"},
    }
    llm = FakeLLM(json.dumps(payload))
    ctx = await make_context(test_session, test_settings, llm=llm)

    agent = OnboardingAgent()
    await agent.run(ctx)

    await test_session.refresh(ctx.project)
    assert ctx.project.status == "planning"
    assert ctx.project.title == "Updated"
    assert ctx.project.story == "New story"
    assert ctx.project.style == "anime"


@pytest.mark.asyncio
async def test_onboarding_minimal_payload(test_session, test_settings):
    """Cover branches where story_breakdown has only setting, key_elements has no characters."""
    payload = {
        "story_breakdown": {"setting": "City"},
        "key_elements": {},
        "style_recommendation": {},
        "project_update": {},
    }
    llm = FakeLLM(json.dumps(payload))
    ctx = await make_context(test_session, test_settings, llm=llm)

    agent = OnboardingAgent()
    await agent.run(ctx)

    await test_session.refresh(ctx.project)
    assert ctx.project.status == "planning"


@pytest.mark.asyncio
async def test_onboarding_tone_only(test_session, test_settings):
    """Cover tone-only branch without setting."""
    payload = {
        "story_breakdown": {"tone": "Dark"},
        "key_elements": {},
        "style_recommendation": {},
        "project_update": {},
    }
    llm = FakeLLM(json.dumps(payload))
    ctx = await make_context(test_session, test_settings, llm=llm)

    agent = OnboardingAgent()
    await agent.run(ctx)
    assert ctx.project.status == "planning"

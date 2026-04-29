from __future__ import annotations

import json

import pytest

from app.agents.review import ReviewAgent
from tests.agent_fixtures import FakeLLM, make_context
from tests.factories import create_agent_message, create_project, create_run


@pytest.mark.asyncio
async def test_review_agent_no_feedback_defaults(test_session, test_settings):
    ctx = await make_context(test_session, test_settings, llm=FakeLLM("{}"))

    agent = ReviewAgent()
    result = await agent.run(ctx)
    assert result["start_agent"] == "scriptwriter"


@pytest.mark.asyncio
async def test_review_agent_routing_with_targets(test_session, test_settings):
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    await create_agent_message(test_session, run_id=run.id, content="More detail")

    payload = {
        "analysis": {"feedback_type": "character", "summary": "Adjust character"},
        "routing": {"start_agent": "character_artist", "mode": "incremental", "reason": "Fix"},
        "target_ids": {"character_ids": [1], "shot_ids": [2]},
    }
    llm = FakeLLM(json.dumps(payload))
    ctx = await make_context(test_session, test_settings, project=project, run=run, llm=llm)

    agent = ReviewAgent()
    result = await agent.run(ctx)
    assert result["start_agent"] == "character_artist"
    assert result["mode"] == "incremental"
    assert result["target_ids"].character_ids == [1]
    assert result["target_ids"].shot_ids == [2]


@pytest.mark.asyncio
async def test_review_agent_fallbacks_to_scriptwriter_when_feedback_empty(test_session, test_settings):
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    ctx = await make_context(test_session, test_settings, project=project, run=run, llm=FakeLLM("{}"))
    ctx.user_feedback = "   "

    agent = ReviewAgent()
    result = await agent.run(ctx)

    assert result["start_agent"] == "scriptwriter"
    assert result["reason"] == "未提供具体反馈"


@pytest.mark.asyncio
async def test_review_agent_retry_merge_forces_video_merger(monkeypatch, test_session, test_settings):
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    payload = {
        "analysis": {"feedback_type": "general", "summary": "Retry"},
        "routing": {"start_agent": "scriptwriter", "mode": "full", "reason": "Need merge"},
    }
    ctx = await make_context(test_session, test_settings, project=project, run=run, llm=FakeLLM(json.dumps(payload)))
    ctx.user_feedback = "retry merge"

    agent = ReviewAgent()
    result = await agent.run(ctx)

    assert result["start_agent"] == "video_merger"
    assert result["mode"] == "incremental"


@pytest.mark.asyncio
async def test_review_fallback_start_agent_shot(monkeypatch, test_session, test_settings):
    """_fallback_start_agent returns storyboard_artist for shot feedback."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    payload = {
        "analysis": {"feedback_type": "shot", "summary": "Fix shot"},
        "routing": {"start_agent": "INVALID_AGENT", "mode": "full", "reason": "Bad route"},
    }
    ctx = await make_context(test_session, test_settings, project=project, run=run, llm=FakeLLM(json.dumps(payload)))
    ctx.user_feedback = "Please fix the shot layout"

    agent = ReviewAgent()
    result = await agent.run(ctx)
    assert result["start_agent"] == "storyboard_artist"


@pytest.mark.asyncio
async def test_review_fallback_start_agent_video(monkeypatch, test_session, test_settings):
    """_fallback_start_agent returns video_merger for video feedback."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    payload = {
        "analysis": {"feedback_type": "video", "summary": "Fix video"},
        "routing": {"start_agent": "INVALID", "mode": "full"},
    }
    ctx = await make_context(test_session, test_settings, project=project, run=run, llm=FakeLLM(json.dumps(payload)))
    ctx.user_feedback = "Fix the video transitions"

    agent = ReviewAgent()
    result = await agent.run(ctx)
    assert result["start_agent"] == "video_merger"


@pytest.mark.asyncio
async def test_review_fallback_start_agent_general(monkeypatch, test_session, test_settings):
    """_fallback_start_agent returns scriptwriter for general feedback."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    payload = {
        "analysis": {"feedback_type": "general", "summary": "General"},
        "routing": {"start_agent": "INVALID", "mode": "full"},
    }
    ctx = await make_context(test_session, test_settings, project=project, run=run, llm=FakeLLM(json.dumps(payload)))
    ctx.user_feedback = "Make it more dramatic"

    agent = ReviewAgent()
    result = await agent.run(ctx)
    assert result["start_agent"] == "scriptwriter"


@pytest.mark.asyncio
async def test_review_no_routing_reason_fallback(monkeypatch, test_session, test_settings):
    """When invalid agent and no reason, default reason is set."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    payload = {
        "analysis": {"feedback_type": "general", "summary": "X"},
        "routing": {"start_agent": "INVALID", "mode": "full"},
    }
    ctx = await make_context(test_session, test_settings, project=project, run=run, llm=FakeLLM(json.dumps(payload)))
    ctx.user_feedback = "General feedback text"

    agent = ReviewAgent()
    result = await agent.run(ctx)
    assert "默认路由策略" in result["reason"]


@pytest.mark.asyncio
async def test_review_with_target_info_message(monkeypatch, test_session, test_settings):
    """Cover target_info display branch."""
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    await create_agent_message(test_session, run_id=run.id, content="Feedback")
    payload = {
        "analysis": {"feedback_type": "character", "summary": "Adjust"},
        "routing": {"start_agent": "character_artist", "mode": "incremental", "reason": "Fix"},
        "target_ids": {"character_ids": [1, 2], "shot_ids": [3, 4, 5]},
    }
    ctx = await make_context(test_session, test_settings, project=project, run=run, llm=FakeLLM(json.dumps(payload)))
    ctx.user_feedback = "Adjust character design"

    agent = ReviewAgent()
    result = await agent.run(ctx)
    assert result["target_ids"].character_ids == [1, 2]
    assert result["target_ids"].shot_ids == [3, 4, 5]

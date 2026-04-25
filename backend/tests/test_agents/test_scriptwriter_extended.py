"""Coverage extension for ScriptwriterAgent (full + incremental + helpers)."""
from __future__ import annotations

import json

import pytest
from sqlmodel import select

from app.agents.scriptwriter import (
    ScriptwriterAgent,
    _character_to_description,
    _scene_to_description,
)
from app.models.project import Character, Shot
from tests.agent_fixtures import FakeLLM, make_context


# ---------------------------------------------------------------------------
# pure helper functions
# ---------------------------------------------------------------------------


class TestCharacterToDescription:
    def test_collects_known_keys(self):
        item = {
            "personality_traits": "brave",
            "goals": ["save world", "find love"],
            "fears": "",  # empty -> skipped
            "voice_notes": "deep voice",
            "costume_notes": ["cape", "mask"],
            "description": "primary text",
        }
        result = _character_to_description(item)
        # Description goes first
        assert result.startswith("primary text")
        assert "personality_traits: brave" in result
        assert "goals: save world, find love" in result
        assert "voice_notes: deep voice" in result
        assert "costume_notes: cape, mask" in result
        # Empty string fields are skipped
        assert "fears:" not in result

    def test_falls_back_to_json_when_empty(self):
        item = {"unrelated": "x"}
        result = _character_to_description(item)
        assert json.loads(result) == item

    def test_skips_non_string_list_items(self):
        item = {"goals": [1, 2, "valid", ""]}
        result = _character_to_description(item)
        assert "goals: valid" in result


class TestSceneToDescription:
    def test_assembles_full_scene(self):
        scene = {
            "title": "Opening",
            "location": "Forest",
            "time": "Dawn",
            "description": "Mist swirls",
            "beats": ["Hero arrives", "Wolf howls"],
            "dialogue": [
                {"character": "Hero", "line": "I'm here!", "emotion": "tense"},
                {"character": "Hero", "line": "Help"},  # no emotion
                {"character": "", "line": "skip"},  # invalid
                "not-a-dict",  # invalid
            ],
            "shot_plan": [
                {"description": "Wide shot of forest"},
                "not-a-dict",
                {"description": ""},  # invalid
            ],
        }
        result = _scene_to_description(scene)
        assert "Title: Opening" in result
        assert "Location: Forest" in result
        assert "Time: Dawn" in result
        assert "Mist swirls" in result
        assert "Hero arrives" in result
        assert "- Hero: I'm here! (tense)" in result
        assert "- Hero: Help" in result
        assert "Wide shot of forest" in result

    def test_falls_back_to_json_for_empty_scene(self):
        scene = {"unrelated": "x"}
        result = _scene_to_description(scene)
        assert json.loads(result) == scene


# ---------------------------------------------------------------------------
# ScriptwriterAgent.run() — full mode edge cases
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_run_raises_on_empty_shots(test_session, test_settings):
    payload = {"project_update": {"status": "scripted"}, "characters": [], "shots": []}
    llm = FakeLLM(json.dumps(payload))
    ctx = await make_context(test_session, test_settings, llm=llm)

    agent = ScriptwriterAgent()
    with pytest.raises(ValueError, match="未返回任何分镜"):
        await agent.run(ctx)


@pytest.mark.asyncio
async def test_run_raises_when_all_shots_invalid(test_session, test_settings):
    """A list of shots that all fail validation must raise ValueError."""
    payload = {
        "project_update": {"status": "scripted"},
        "characters": [],
        "shots": [
            {"order": 1, "description": ""},  # empty description -> skipped
            "not-a-dict",
            {"order": 2},  # missing description
        ],
    }
    llm = FakeLLM(json.dumps(payload))
    ctx = await make_context(test_session, test_settings, llm=llm)

    agent = ScriptwriterAgent()
    with pytest.raises(ValueError, match="为空或无效"):
        await agent.run(ctx)


@pytest.mark.asyncio
async def test_run_skips_invalid_character_entries(test_session, test_settings):
    """Invalid character dicts (missing/empty name) must be skipped without error."""
    payload = {
        "project_update": {"status": "scripted"},
        "characters": [
            {"name": "Valid", "description": "good"},
            {"name": "", "description": "skipped"},  # empty name
            {"description": "no name"},  # missing name
            "not-a-dict",
        ],
        "shots": [
            {"order": 1, "description": "Shot 1", "video_prompt": "Action"},
        ],
    }
    llm = FakeLLM(json.dumps(payload))
    ctx = await make_context(test_session, test_settings, llm=llm)

    agent = ScriptwriterAgent()
    await agent.run(ctx)

    res = await test_session.execute(
        select(Character).where(Character.project_id == ctx.project.id)
    )
    chars = res.scalars().all()
    assert len(chars) == 1
    assert chars[0].name == "Valid"


@pytest.mark.asyncio
async def test_run_uses_fallback_order_for_invalid_orders(test_session, test_settings):
    payload = {
        "project_update": {"status": "scripted"},
        "characters": [],
        "shots": [
            {"description": "Shot A"},  # no order -> 1
            {"order": "bad", "description": "Shot B"},  # invalid order -> 2
            {"order": 5, "description": "Shot C"},  # explicit -> 5
            {"description": "Shot D"},  # no order -> 6 (after 5)
        ],
    }
    llm = FakeLLM(json.dumps(payload))
    ctx = await make_context(test_session, test_settings, llm=llm)

    agent = ScriptwriterAgent()
    await agent.run(ctx)

    res = await test_session.execute(
        select(Shot).where(Shot.project_id == ctx.project.id).order_by(Shot.order)
    )
    shots = res.scalars().all()
    assert [s.order for s in shots] == [1, 2, 5, 6]


@pytest.mark.asyncio
async def test_run_with_project_update_status(test_session, test_settings):
    """A non-empty status string must update the project."""
    payload = {
        "project_update": {"status": "  custom-status  "},
        "characters": [],
        "shots": [{"order": 1, "description": "Shot 1"}],
    }
    llm = FakeLLM(json.dumps(payload))
    ctx = await make_context(test_session, test_settings, llm=llm)

    agent = ScriptwriterAgent()
    await agent.run(ctx)

    await test_session.refresh(ctx.project)
    assert ctx.project.status == "custom-status"


# ---------------------------------------------------------------------------
# Incremental mode
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_incremental_mode_creates_and_preserves(test_session, test_settings):
    """Incremental mode preserves existing entities and adds new ones."""
    ctx = await make_context(test_session, test_settings)
    ctx.rerun_mode = "incremental"

    # Pre-existing data
    existing_char = Character(
        project_id=ctx.project.id, name="Keeper", description="To preserve"
    )
    test_session.add(existing_char)
    await test_session.flush()

    existing_shot = Shot(
        project_id=ctx.project.id,
        order=1,
        description="old",
        prompt="old",
        image_prompt="old",
    )
    test_session.add(existing_shot)
    await test_session.flush()

    payload = {
        "project_update": {"status": "scripted"},
        "preserve_ids": {
            "characters": [existing_char.id],
            "shots": [existing_shot.id],
        },
        "characters": [
            {"name": "NewChar", "description": "fresh"},  # new
            # Update existing
            {"id": existing_char.id, "name": "Keeper-Updated", "description": "updated"},
        ],
        "shots": [
            {"id": existing_shot.id, "order": 1, "description": "updated shot"},
            {"order": 2, "description": "new shot"},
        ],
    }
    ctx.llm = FakeLLM(json.dumps(payload))

    agent = ScriptwriterAgent()
    await agent.run(ctx)

    res = await test_session.execute(
        select(Character).where(Character.project_id == ctx.project.id)
    )
    chars = res.scalars().all()
    names = sorted(c.name for c in chars)
    assert "Keeper-Updated" in names  # preserved + updated
    assert "NewChar" in names  # newly created

    res = await test_session.execute(
        select(Shot).where(Shot.project_id == ctx.project.id).order_by(Shot.order)
    )
    shots = res.scalars().all()
    assert len(shots) == 2
    assert shots[0].description == "updated shot"
    assert shots[1].description == "new shot"


@pytest.mark.asyncio
async def test_incremental_mode_deletes_unpreserved(test_session, test_settings):
    """Items not in preserve_ids must be deleted."""
    ctx = await make_context(test_session, test_settings)
    ctx.rerun_mode = "incremental"

    # Two existing characters, only one preserved
    keeper = Character(project_id=ctx.project.id, name="Keep", description="x")
    deleter = Character(project_id=ctx.project.id, name="Delete", description="y")
    test_session.add_all([keeper, deleter])
    await test_session.flush()

    keeper_shot = Shot(
        project_id=ctx.project.id, order=1, description="keep", prompt="k", image_prompt="k"
    )
    delete_shot = Shot(
        project_id=ctx.project.id, order=2, description="del", prompt="d", image_prompt="d"
    )
    test_session.add_all([keeper_shot, delete_shot])
    await test_session.flush()

    payload = {
        "preserve_ids": {
            "characters": [keeper.id],
            "shots": [keeper_shot.id],
        },
        "characters": [],
        "shots": [{"id": keeper_shot.id, "order": 1, "description": "keep"}],
    }
    ctx.llm = FakeLLM(json.dumps(payload))

    agent = ScriptwriterAgent()
    await agent.run(ctx)

    res = await test_session.execute(
        select(Character).where(Character.project_id == ctx.project.id)
    )
    chars = res.scalars().all()
    assert len(chars) == 1
    assert chars[0].name == "Keep"

    res = await test_session.execute(
        select(Shot).where(Shot.project_id == ctx.project.id)
    )
    shots = res.scalars().all()
    assert len(shots) == 1
    assert shots[0].description == "keep"


@pytest.mark.asyncio
async def test_incremental_mode_with_user_feedback(test_session, test_settings):
    """User feedback path must be exercised (payload includes user_feedback)."""
    ctx = await make_context(test_session, test_settings)
    ctx.rerun_mode = "incremental"
    ctx.user_feedback = "make the hero braver"

    payload = {
        "preserve_ids": {"characters": [], "shots": []},
        "characters": [],
        "shots": [],
    }
    ctx.llm = FakeLLM(json.dumps(payload))

    agent = ScriptwriterAgent()
    # Empty shots in incremental mode is OK (no delete-all rule)
    await agent.run(ctx)

    # Project status remains unchanged when no project_update provided
    await test_session.refresh(ctx.project)


@pytest.mark.asyncio
async def test_incremental_mode_skips_invalid_entries(test_session, test_settings):
    """Incremental mode must skip non-dict/empty-name characters and bad shots."""
    ctx = await make_context(test_session, test_settings)
    ctx.rerun_mode = "incremental"

    payload = {
        "preserve_ids": {"characters": [], "shots": []},
        "characters": [
            "not-a-dict",  # non-dict -> skip
            {"name": ""},  # empty name -> skip
            {"name": "Valid", "description": "ok"},
        ],
        "shots": [
            "not-a-dict",  # non-dict -> skip
            {"order": 1, "description": ""},  # empty description -> skip
            {"order": 2, "description": "Valid Shot"},
        ],
    }
    ctx.llm = FakeLLM(json.dumps(payload))

    agent = ScriptwriterAgent()
    await agent.run(ctx)

    res = await test_session.execute(
        select(Character).where(Character.project_id == ctx.project.id)
    )
    chars = res.scalars().all()
    assert len(chars) == 1
    assert chars[0].name == "Valid"

    res = await test_session.execute(
        select(Shot).where(Shot.project_id == ctx.project.id)
    )
    shots = res.scalars().all()
    assert len(shots) == 1
    assert shots[0].description == "Valid Shot"

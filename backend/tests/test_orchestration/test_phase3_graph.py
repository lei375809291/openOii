from __future__ import annotations

from typing import Any, cast
from types import SimpleNamespace

import pytest

from app.agents.storyboard_artist import StoryboardArtistAgent
from app.agents.video_generator import VideoGeneratorAgent
from app.orchestration.nodes import clip_approval_node, storyboard_approval_node
from app.services.approval_gate import can_enter_clip_generation
from app.services.shot_binding import resolve_shot_bound_approved_characters
from tests.factories import create_character, create_project, create_run, create_shot


@pytest.mark.asyncio
async def test_shot_binding_uses_the_frozen_approved_shot_cast(test_session):
    project = await create_project(test_session)
    assert project.id is not None
    approved = await create_character(test_session, project_id=project.id, name="Approved")
    removed = await create_character(test_session, project_id=project.id, name="Removed")
    assert approved.id is not None
    assert removed.id is not None
    approved.freeze_approval()
    removed.freeze_approval()
    test_session.add(approved)
    test_session.add(removed)
    await test_session.commit()
    await test_session.refresh(approved)
    await test_session.refresh(removed)

    shot = await create_shot(test_session, project_id=project.id)
    shot.character_ids = [approved.id, removed.id]
    shot.freeze_approval()
    shot.character_ids = [approved.id]
    test_session.add(shot)
    await test_session.commit()
    await test_session.refresh(shot)

    resolved = await resolve_shot_bound_approved_characters(test_session, shot)

    assert [character.id for character in resolved] == [approved.id, removed.id]
    assert [character.name for character in resolved] == ["Approved", "Removed"]

    storyboard_prompt = StoryboardArtistAgent()._build_image_prompt(shot, resolved, style="anime")
    video_prompt = VideoGeneratorAgent()._build_video_prompt(shot, resolved, style="anime")

    assert "Approved" in storyboard_prompt
    assert "Removed" in storyboard_prompt
    assert "Approved" in video_prompt
    assert "Removed" in video_prompt


@pytest.mark.asyncio
async def test_clip_generation_stays_blocked_until_every_storyboard_shot_is_approved(test_session):
    project = await create_project(test_session)
    assert project.id is not None
    run = await create_run(test_session, project_id=project.id)

    first_shot = await create_shot(test_session, project_id=project.id, order=1)
    second_shot = await create_shot(test_session, project_id=project.id, order=2)
    assert first_shot.id is not None
    assert second_shot.id is not None

    first_shot.freeze_approval()
    test_session.add(first_shot)
    test_session.add(second_shot)
    await test_session.commit()

    assert await can_enter_clip_generation(test_session, run) is False

    second_shot.freeze_approval()
    test_session.add(second_shot)
    await test_session.commit()

    assert await can_enter_clip_generation(test_session, run) is True


@pytest.mark.asyncio
async def test_clip_generation_is_scoped_to_the_current_shot_run(test_session):
    project = await create_project(test_session)
    assert project.id is not None
    run = await create_run(test_session, project_id=project.id)

    approved_shot = await create_shot(test_session, project_id=project.id, order=1)
    pending_shot = await create_shot(test_session, project_id=project.id, order=2)

    assert run.id is not None
    assert approved_shot.id is not None
    assert pending_shot.id is not None

    run.resource_type = "shot"
    run.resource_id = approved_shot.id
    test_session.add(run)
    await test_session.commit()

    approved_shot.freeze_approval()
    test_session.add(approved_shot)
    test_session.add(pending_shot)
    await test_session.commit()

    assert await can_enter_clip_generation(test_session, run) is True


@pytest.mark.asyncio
async def test_storyboard_approval_routes_back_to_review_when_clip_gate_blocks(
    test_session, monkeypatch
):
    project = await create_project(test_session)
    assert project.id is not None
    run = await create_run(test_session, project_id=project.id)

    runtime = cast(
        Any,
        SimpleNamespace(
            context=SimpleNamespace(
                auto_mode=False,
                agent_context=SimpleNamespace(
                    session=test_session, project=project, run=run, target_ids=None
                ),
            )
        ),
    )

    async def _blocked(*_args, **_kwargs):
        return False

    monkeypatch.setattr("app.orchestration.nodes.interrupt", lambda *_args, **_kwargs: "")
    monkeypatch.setattr("app.orchestration.nodes.can_enter_clip_generation", _blocked)

    result = await storyboard_approval_node({}, runtime)

    assert result["route_stage"] == "review"
    assert result["review_requested"] is True


@pytest.mark.asyncio
async def test_storyboard_approval_skips_to_merge_when_video_provider_invalid():
    runtime = cast(
        Any,
        SimpleNamespace(
            context=SimpleNamespace(
                auto_mode=False,
                orchestrator=SimpleNamespace(),
                agent_context=SimpleNamespace(
                    run=SimpleNamespace(
                        provider_snapshot={
                            "video": {"valid": False, "selected_key": "openai", "source": "default"}
                        },
                    ),
                    project=SimpleNamespace(id=1),
                    session=None,
                    target_ids=None,
                ),
            ),
        ),
    )

    result = await storyboard_approval_node({}, runtime)

    assert result["route_stage"] == "merge"
    assert result["review_requested"] is False


@pytest.mark.asyncio
async def test_clip_approval_skips_to_merge_when_video_provider_invalid():
    runtime = cast(
        Any,
        SimpleNamespace(
            context=SimpleNamespace(
                auto_mode=False,
                agent_context=SimpleNamespace(
                    run=SimpleNamespace(
                        provider_snapshot={
                            "video": {"valid": False, "selected_key": "openai", "source": "default"}
                        },
                    ),
                ),
            ),
        ),
    )

    result = await clip_approval_node({}, runtime)

    assert result["route_stage"] == "merge"
    assert result["review_requested"] is False

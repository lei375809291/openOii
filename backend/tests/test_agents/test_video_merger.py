from __future__ import annotations

import pytest
from sqlmodel import select

from app.agents.video_merger import VideoMergerAgent
from app.models.project import Project
from tests.agent_fixtures import FakeLLM, FakeVideoService, make_context
from tests.factories import create_project, create_run, create_shot


class TrackingVideoService(FakeVideoService):
    def __init__(self, url: str = "http://video.test/default.mp4", merged_url: str | None = None):
        super().__init__(url=url, merged_url=merged_url)
        self.merge_calls: list[list[str]] = []

    async def merge_urls(self, video_urls):
        self.merge_calls.append(list(video_urls))
        return await super().merge_urls(video_urls)


@pytest.mark.asyncio
async def test_video_merger_sets_project_video(test_session, test_settings):
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id)
    await create_shot(test_session, project_id=project.id, video_url="http://video.test/1.mp4")

    video = TrackingVideoService(merged_url="/static/videos/merged.mp4")
    ctx = await make_context(
        test_session,
        test_settings,
        project=project,
        run=run,
        llm=FakeLLM("{}"),
        video=video,
    )

    agent = VideoMergerAgent()
    await agent.run(ctx)

    await test_session.refresh(project)
    assert project.video_url == "/static/videos/merged.mp4"
    assert video.merge_calls == [["http://video.test/1.mp4"]]

    res = await test_session.execute(select(Project).where(Project.id == project.id))
    assert res.scalar_one_or_none() is not None


@pytest.mark.asyncio
@pytest.mark.parametrize("clip_state", ["missing", "generating", "failed"])
async def test_video_merger_blocks_incomplete_current_clips(
    test_session, test_settings, clip_state
):
    project = await create_project(test_session, status="ready")
    run = await create_run(test_session, project_id=project.id)
    await create_shot(
        test_session, project_id=project.id, order=1, video_url="http://video.test/1.mp4"
    )
    blocked_shot = await create_shot(
        test_session,
        project_id=project.id,
        order=2,
        video_url=None,
    )

    if clip_state != "missing":
        blocked_run = await create_run(
            test_session,
            project_id=project.id,
            status="running" if clip_state == "generating" else "failed",
        )
        blocked_run.resource_type = "shot"
        blocked_run.resource_id = blocked_shot.id
        test_session.add(blocked_run)
        await test_session.commit()

    video = TrackingVideoService(merged_url="/static/videos/merged.mp4")
    ctx = await make_context(
        test_session,
        test_settings,
        project=project,
        run=run,
        llm=FakeLLM("{}"),
        video=video,
    )

    agent = VideoMergerAgent()
    await agent.run(ctx)

    await test_session.refresh(project)
    assert project.video_url is None
    assert video.merge_calls == []


@pytest.mark.asyncio
async def test_video_merger_restores_ready_state_after_retry_merge(test_session, test_settings):
    project = await create_project(test_session, status="superseded")
    run = await create_run(test_session, project_id=project.id)
    await create_shot(
        test_session, project_id=project.id, order=1, video_url="http://video.test/1.mp4"
    )
    await create_shot(
        test_session, project_id=project.id, order=2, video_url="http://video.test/2.mp4"
    )
    project.video_url = "/static/videos/old-final.mp4"
    test_session.add(project)
    await test_session.commit()
    await test_session.refresh(project)

    video = TrackingVideoService(merged_url="/static/videos/new-final.mp4")
    ctx = await make_context(
        test_session,
        test_settings,
        project=project,
        run=run,
        llm=FakeLLM("{}"),
        video=video,
    )

    agent = VideoMergerAgent()
    await agent.run(ctx)

    await test_session.refresh(project)
    assert project.video_url == "/static/videos/new-final.mp4"
    assert project.status == "ready"
    assert video.merge_calls == [["http://video.test/1.mp4", "http://video.test/2.mp4"]]
    assert any(
        event[1]["type"] == "project_updated"
        and event[1]["data"]["project"]["video_url"] == "/static/videos/new-final.mp4"
        for event in ctx.ws.events
    )

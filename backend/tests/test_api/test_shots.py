from __future__ import annotations

import asyncio

import pytest

from app.api.v1.routes import shots as shots_routes

from tests.factories import create_project, create_shot


def _immediate_task(coro):
    loop = asyncio.get_running_loop()
    coro.close()
    fut = loop.create_future()
    fut.set_result(None)
    return fut


@pytest.mark.asyncio
async def test_list_shots(async_client, test_session):
    project = await create_project(test_session)
    await create_shot(test_session, project_id=project.id, order=1)
    await create_shot(test_session, project_id=project.id, order=2)

    res = await async_client.get(f"/api/v1/projects/{project.id}/shots")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2
    assert data[0]["order"] == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("method", ["put", "patch"])
async def test_update_shot(async_client, test_session, method):
    project = await create_project(test_session)
    shot = await create_shot(test_session, project_id=project.id, description="Old")

    res = await getattr(async_client, method)(
        f"/api/v1/shots/{shot.id}",
        json={"description": "New description", "prompt": "New prompt"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["description"] == "New description"
    assert data["prompt"] == "New prompt"


@pytest.mark.asyncio
async def test_update_shot_not_found(async_client):
    res = await async_client.patch(
        "/api/v1/shots/99999",
        json={"description": "Test"},
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_regenerate_shot(async_client, test_session, monkeypatch):
    monkeypatch.setattr(shots_routes.asyncio, "create_task", _immediate_task)

    project = await create_project(test_session)
    project.video_url = "http://test.com/project-final.mp4"
    test_session.add(project)
    await test_session.commit()
    await test_session.refresh(project)

    shot = await create_shot(
        test_session,
        project_id=project.id,
        description="Approved shot",
        prompt="Approved prompt",
        image_url="http://test.com/approved-shot.png",
        video_url="http://test.com/approved-shot.mp4",
    )

    shot.freeze_approval()
    test_session.add(shot)
    await test_session.commit()
    await test_session.refresh(shot)

    res = await async_client.post(f"/api/v1/shots/{shot.id}/regenerate", json={"type": "video"})
    assert res.status_code == 201
    body = res.json()
    assert body["resource_type"] == "shot"
    assert body["resource_id"] == shot.id

    await test_session.refresh(shot)
    await test_session.refresh(project)
    assert shot.video_url == "http://test.com/approved-shot.mp4"
    assert project.video_url == "http://test.com/project-final.mp4"
    assert project.status == "superseded"


@pytest.mark.asyncio
async def test_delete_shot(async_client, test_session):
    project = await create_project(test_session)
    shot = await create_shot(test_session, project_id=project.id, description="Delete shot")

    res = await async_client.delete(f"/api/v1/shots/{shot.id}")

    assert res.status_code == 204

    list_res = await async_client.get(f"/api/v1/projects/{project.id}/shots")
    assert list_res.status_code == 200
    assert list_res.json() == []

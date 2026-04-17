from __future__ import annotations

import pytest

from app.models.project import Project
from tests.factories import create_message, create_project, create_run


@pytest.mark.asyncio
async def test_list_projects_empty(async_client):
    res = await async_client.get("/api/v1/projects")
    assert res.status_code == 200
    data = res.json()
    assert data["items"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_list_projects_with_data(async_client, test_session):
    await create_project(test_session, title="Project 1")
    await create_project(test_session, title="Project 2")

    res = await async_client.get("/api/v1/projects")
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) == 2
    assert data["total"] == 2


@pytest.mark.asyncio
async def test_create_project_persists_bootstrap_payload(async_client, test_session):
    payload = {
        "title": "New Project",
        "story": "Once upon a time",
        "style": "cinematic",
        "text_provider_override": "openai",
        "image_provider_override": "openai",
        "video_provider_override": "doubao",
    }

    res = await async_client.post("/api/v1/projects", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "New Project"
    assert data["story"] == "Once upon a time"
    assert data["style"] == "cinematic"
    assert data["status"] == "draft"
    assert data["provider_settings"] == {
        "text": {
            "override_key": "openai",
            "effective_key": "openai",
            "source": "project",
        },
        "image": {
            "override_key": "openai",
            "effective_key": "openai",
            "source": "project",
        },
        "video": {
            "override_key": "doubao",
            "effective_key": "doubao",
            "source": "project",
        },
    }
    assert isinstance(data["id"], int)

    project = await test_session.get(Project, data["id"])
    assert project is not None
    assert project.story == payload["story"]
    assert project.style == payload["style"]
    assert project.status == "draft"
    assert project.text_provider_override == "openai"
    assert project.image_provider_override == "openai"
    assert project.video_provider_override == "doubao"


@pytest.mark.asyncio
async def test_get_project(async_client, test_session):
    project = await create_project(
        test_session,
        title="Get Test",
        text_provider_override="openai",
        image_provider_override="openai",
    )
    res = await async_client.get(f"/api/v1/projects/{project.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == project.id
    assert data["title"] == "Get Test"
    assert data["provider_settings"] == {
        "text": {
            "override_key": "openai",
            "effective_key": "openai",
            "source": "project",
        },
        "image": {
            "override_key": "openai",
            "effective_key": "openai",
            "source": "project",
        },
        "video": {
            "override_key": None,
            "effective_key": "openai",
            "source": "default",
        },
    }


@pytest.mark.asyncio
async def test_get_project_not_found(async_client):
    res = await async_client.get("/api/v1/projects/99999")
    assert res.status_code == 404


@pytest.mark.asyncio
@pytest.mark.parametrize("method", ["put", "patch"])
async def test_update_project(async_client, test_session, method):
    project = await create_project(test_session, title="Old Title")
    res = await getattr(async_client, method)(
        f"/api/v1/projects/{project.id}",
        json={
            "title": "New Title",
            "style": "noir",
            "text_provider_override": "openai",
            "video_provider_override": None,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "New Title"
    assert data["style"] == "noir"
    assert data["provider_settings"] == {
        "text": {
            "override_key": "openai",
            "effective_key": "openai",
            "source": "project",
        },
        "image": {
            "override_key": None,
            "effective_key": "openai",
            "source": "default",
        },
        "video": {
            "override_key": None,
            "effective_key": "openai",
            "source": "default",
        },
    }

    round_trip = await async_client.get(f"/api/v1/projects/{project.id}")
    assert round_trip.status_code == 200
    assert round_trip.json()["provider_settings"] == data["provider_settings"]


@pytest.mark.asyncio
async def test_create_project_rejects_unknown_provider_keys(async_client):
    res = await async_client.post(
        "/api/v1/projects",
        json={
            "title": "Bad Project",
            "text_provider_override": "claude",
        },
    )

    assert res.status_code == 422


@pytest.mark.asyncio
async def test_get_project_messages(async_client, test_session):
    project = await create_project(test_session)
    run = await create_run(test_session, project_id=project.id, status="running")
    await create_message(
        test_session,
        run_id=run.id,
        project_id=project.id,
        agent="system",
        role="assistant",
        content="hello world",
    )

    res = await async_client.get(f"/api/v1/projects/{project.id}/messages")

    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["project_id"] == project.id
    assert data[0]["content"] == "hello world"


@pytest.mark.asyncio
async def test_delete_project(async_client, test_session):
    project = await create_project(test_session)
    res = await async_client.delete(f"/api/v1/projects/{project.id}")
    assert res.status_code == 204

    res = await async_client.get(f"/api/v1/projects/{project.id}")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_get_final_video_download(async_client, test_session, monkeypatch, tmp_path):
    project = await create_project(test_session)
    final_file = tmp_path / "merged-final.mp4"
    final_file.write_bytes(b"fake video bytes")

    from app.api.v1.routes import projects as projects_routes

    monkeypatch.setattr(projects_routes, "get_local_path", lambda url: final_file)
    project.video_url = "http://cdn.example.com/static/videos/merged-final.mp4"
    test_session.add(project)
    await test_session.commit()
    await test_session.refresh(project)

    res = await async_client.get(f"/api/v1/projects/{project.id}/final-video")

    assert res.status_code == 200
    content_disposition = res.headers.get("content-disposition", "")
    assert "merged-final.mp4" in content_disposition

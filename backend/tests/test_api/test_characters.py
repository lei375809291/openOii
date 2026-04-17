from __future__ import annotations

import pytest

from tests.factories import create_character, create_project


@pytest.mark.asyncio
async def test_list_characters(async_client, test_session):
    project = await create_project(test_session)
    await create_character(test_session, project_id=project.id, name="Hero")
    await create_character(test_session, project_id=project.id, name="Villain")

    res = await async_client.get(f"/api/v1/projects/{project.id}/characters")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2
    assert data[0]["name"] == "Hero"


@pytest.mark.asyncio
@pytest.mark.parametrize("method", ["put", "patch"])
async def test_update_character(async_client, test_session, method):
    project = await create_project(test_session)
    character = await create_character(test_session, project_id=project.id, name="Old Name")

    res = await getattr(async_client, method)(
        f"/api/v1/characters/{character.id}",
        json={"name": "New Name", "description": "Updated"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "New Name"
    assert data["description"] == "Updated"


@pytest.mark.asyncio
async def test_update_character_not_found(async_client):
    res = await async_client.patch(
        "/api/v1/characters/99999",
        json={"name": "Test"},
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_delete_character(async_client, test_session):
    project = await create_project(test_session)
    character = await create_character(test_session, project_id=project.id, name="Delete Me")

    res = await async_client.delete(f"/api/v1/characters/{character.id}")

    assert res.status_code == 204

    list_res = await async_client.get(f"/api/v1/projects/{project.id}/characters")
    assert list_res.status_code == 200
    assert list_res.json() == []

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import SessionDep
from app.models.asset import Asset
from app.models.project import Character
from app.schemas.project import AssetCreate, AssetListRead, AssetRead

router = APIRouter()


@router.get("", response_model=AssetListRead)
async def list_assets(
    asset_type: str | None = None,
    session: AsyncSession = SessionDep,
):
    q = select(Asset).order_by(Asset.updated_at.desc())
    if asset_type:
        q = q.where(Asset.asset_type == asset_type)
    res = await session.execute(q)
    items = res.scalars().all()
    return AssetListRead(items=[AssetRead.model_validate(a) for a in items], total=len(items))


@router.post("", response_model=AssetRead, status_code=status.HTTP_201_CREATED)
async def create_asset(payload: AssetCreate, session: AsyncSession = SessionDep):
    asset = Asset(
        name=payload.name,
        asset_type=payload.asset_type,
        description=payload.description,
        image_url=payload.image_url,
        metadata_json=payload.metadata_json,
        source_project_id=payload.source_project_id,
        tags=payload.tags,
    )
    session.add(asset)
    await session.commit()
    await session.refresh(asset)
    return AssetRead.model_validate(asset)


@router.post("/from-character/{character_id}", response_model=AssetRead, status_code=status.HTTP_201_CREATED)
async def create_asset_from_character(character_id: int, session: AsyncSession = SessionDep):
    character = await session.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    asset = Asset(
        name=character.approved_name or character.name,
        asset_type="character",
        description=character.approved_description or character.description,
        image_url=character.approved_image_url or character.image_url,
        source_project_id=character.project_id,
    )
    session.add(asset)
    await session.commit()
    await session.refresh(asset)
    return AssetRead.model_validate(asset)


@router.get("/{asset_id}", response_model=AssetRead)
async def get_asset(asset_id: int, session: AsyncSession = SessionDep):
    asset = await session.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return AssetRead.model_validate(asset)


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(asset_id: int, session: AsyncSession = SessionDep):
    asset = await session.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    await session.delete(asset)
    await session.commit()
    return None

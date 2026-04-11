from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Character, Shot


async def resolve_shot_bound_approved_characters(
    session: AsyncSession,
    shot: Shot,
) -> list[Character]:
    character_ids: Sequence[int] = shot.approved_character_ids or shot.character_ids
    if not character_ids:
        return []

    result = await session.execute(
        select(Character).where(
            Character.project_id == shot.project_id,
            Character.id.in_(list(character_ids)),
        )
    )
    characters_by_id = {
        character.id: character for character in result.scalars().all() if character.id is not None
    }
    return [
        character
        for character_id in character_ids
        if (character := characters_by_id.get(character_id)) is not None
    ]

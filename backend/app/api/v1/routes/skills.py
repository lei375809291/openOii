"""Skill catalog HTTP API."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.skills.catalog import get_skill, list_skills

router = APIRouter(prefix="/skills", tags=["skills"])


class SkillRead(BaseModel):
    id: str
    title: str
    description: str
    badge: str | None = None
    start_stage: str
    start_agent: str
    prefer_auto_mode: bool
    default_style: str | None = None
    story_prefix: str = ""
    available: bool = True


@router.get("", response_model=list[SkillRead])
async def get_skills() -> list[SkillRead]:
    return [
        SkillRead(
            id=s.id,
            title=s.title,
            description=s.description,
            badge=s.badge,
            start_stage=s.start_stage,
            start_agent=s.start_agent,
            prefer_auto_mode=s.prefer_auto_mode,
            default_style=s.default_style,
            story_prefix=s.story_prefix,
            available=s.available,
        )
        for s in list_skills()
    ]


@router.get("/{skill_id}", response_model=SkillRead)
async def get_skill_by_id(skill_id: str) -> SkillRead:
    skill = get_skill(skill_id)
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    return SkillRead(
        id=skill.id,
        title=skill.title,
        description=skill.description,
        badge=skill.badge,
        start_stage=skill.start_stage,
        start_agent=skill.start_agent,
        prefer_auto_mode=skill.prefer_auto_mode,
        default_style=skill.default_style,
        story_prefix=skill.story_prefix,
        available=skill.available,
    )

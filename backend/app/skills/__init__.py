"""Skill registry — configurable workflow entry points (OiiOii-style)."""

from .catalog import SKILL_CATALOG, SkillDefinition, get_skill, list_skills, resolve_skill_entry

__all__ = [
    "SKILL_CATALOG",
    "SkillDefinition",
    "get_skill",
    "list_skills",
    "resolve_skill_entry",
]

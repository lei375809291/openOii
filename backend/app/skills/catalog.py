"""Declarative skill presets that map UI entries onto graph start stages."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.orchestration.state import Phase2Stage

AgentName = Literal["outline", "plan", "render", "compose", "review"]


@dataclass(frozen=True, slots=True)
class SkillDefinition:
    id: str
    title: str
    description: str
    badge: Literal["core", "new", "soon"] | None
    """LangGraph entry production stage."""
    start_stage: Phase2Stage
    """Orchestrator agent label used for run_from_agent / logging."""
    start_agent: AgentName
    """Prefer auto-approve gates (quick path)."""
    prefer_auto_mode: bool = False
    """Story prefix injected when skill is chosen and story is empty-ish."""
    story_prefix: str = ""
    """Default style hint (frontend may override)."""
    default_style: str | None = None
    available: bool = True


SKILL_CATALOG: tuple[SkillDefinition, ...] = (
    SkillDefinition(
        id="story-anime",
        title="剧情故事创作",
        description="一句话 → 大纲、角色、分镜、视频的完整漫剧链路。",
        badge="core",
        start_stage="plan_outline",
        start_agent="outline",
        default_style="anime",
    ),
    SkillDefinition(
        id="character-design",
        title="角色设计",
        description="先锁定人设与形象，再进入分镜生产。",
        badge="core",
        start_stage="plan_characters",
        start_agent="plan",
        story_prefix="【角色设计优先】\n",
        default_style="anime",
    ),
    SkillDefinition(
        id="script-breakdown",
        title="剧本智能拆分",
        description="把已有剧本拆成镜头清单与场次结构。",
        badge="core",
        start_stage="plan_outline",
        start_agent="outline",
        story_prefix="【剧本拆分】\n",
        default_style="cinematic",
    ),
    SkillDefinition(
        id="quick-short",
        title="快速成片",
        description="少打断、托管式跑通整条流水线，适合草稿验证。",
        badge="core",
        start_stage="plan_outline",
        start_agent="outline",
        prefer_auto_mode=True,
        default_style="anime",
    ),
    SkillDefinition(
        id="video-reimagine",
        title="拉片复刻",
        description="结构化拆解参考片要点 → 换元素再生成。",
        badge="soon",
        start_stage="plan_outline",
        start_agent="outline",
        story_prefix="【拉片复刻】\n",
        default_style="cinematic",
    ),
    SkillDefinition(
        id="product-ad",
        title="商品展示广告",
        description="卖点 + 产品参考 → 广告分镜短片工作流。",
        badge="soon",
        start_stage="plan_outline",
        start_agent="outline",
        story_prefix="【商品广告】\n",
        default_style="cinematic",
    ),
    SkillDefinition(
        id="scene-design",
        title="场景设计",
        description="先铺场景资产，再挂角色与镜头。",
        badge=None,
        start_stage="plan_shots",
        start_agent="plan",
        story_prefix="【场景优先】\n",
        default_style="donghua",
    ),
    SkillDefinition(
        id="comedy-pet",
        title="萌宠 / 搞笑短片",
        description="轻松题材模板：节奏更快、分镜更短。",
        badge=None,
        start_stage="plan_outline",
        start_agent="outline",
        prefer_auto_mode=True,
        default_style="pixar",
    ),
)

_BY_ID: dict[str, SkillDefinition] = {skill.id: skill for skill in SKILL_CATALOG}


def list_skills() -> list[SkillDefinition]:
    return list(SKILL_CATALOG)


def get_skill(skill_id: str | None) -> SkillDefinition | None:
    if not skill_id or not skill_id.strip():
        return None
    return _BY_ID.get(skill_id.strip())


@dataclass(frozen=True, slots=True)
class SkillEntryResolution:
    skill: SkillDefinition | None
    start_stage: Phase2Stage
    start_agent: AgentName
    auto_mode: bool
    notes_suffix: str


def resolve_skill_entry(
    skill_id: str | None,
    *,
    auto_mode: bool = False,
    outline_enabled: bool = True,
) -> SkillEntryResolution:
    """Map a skill id onto graph entry parameters.

    Falls back to full story pipeline when skill is unknown/missing.
    """
    skill = get_skill(skill_id)
    if skill is None:
        start_stage: Phase2Stage = "plan_outline" if outline_enabled else "plan_characters"
        start_agent: AgentName = "outline" if outline_enabled else "plan"
        return SkillEntryResolution(
            skill=None,
            start_stage=start_stage,
            start_agent=start_agent,
            auto_mode=auto_mode,
            notes_suffix="",
        )

    start_stage = skill.start_stage
    start_agent = skill.start_agent
    if start_agent == "outline" and not outline_enabled:
        start_stage = "plan_characters"
        start_agent = "plan"

    notes = f"[skill:{skill.id}] {skill.title}"
    return SkillEntryResolution(
        skill=skill,
        start_stage=start_stage,
        start_agent=start_agent,
        auto_mode=auto_mode or skill.prefer_auto_mode,
        notes_suffix=notes,
    )

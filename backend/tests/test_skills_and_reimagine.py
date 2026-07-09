"""Skill catalog + reimagine v0 + graph driver unit tests."""

from __future__ import annotations

import pytest

from app.orchestration.driver import gate_name_from_interrupt, drive_graph_until_idle
from app.services.reimagine import ReimagineRequest, analyze_reimagine
from app.skills.catalog import get_skill, resolve_skill_entry


def test_skill_catalog_has_core_entries():
    assert get_skill("story-anime") is not None
    assert get_skill("quick-short") is not None
    assert get_skill("video-reimagine") is not None


def test_resolve_skill_quick_prefers_auto_mode():
    res = resolve_skill_entry("quick-short", auto_mode=False, outline_enabled=True)
    assert res.auto_mode is True
    assert res.start_stage == "plan_outline"


def test_resolve_skill_outline_disabled_fallback():
    res = resolve_skill_entry("story-anime", outline_enabled=False)
    assert res.start_agent == "plan"
    assert res.start_stage == "plan_characters"


def test_resolve_unknown_skill_defaults():
    res = resolve_skill_entry(None, outline_enabled=True)
    assert res.skill is None
    assert res.start_agent == "outline"


@pytest.mark.asyncio
async def test_reimagine_heuristic_analysis():
    analysis = await analyze_reimagine(
        ReimagineRequest(
            source_brief="末日办公室，员工一拳打向老板，搞笑反转，漫画特效",
            replacements={"characters": "穿青蛙帽的实习生"},
        ),
        llm=None,
    )
    assert len(analysis.dimensions) == 18
    assert analysis.slots
    assert "拉片复刻" in analysis.reconstructed_prompt
    assert any(d.key == "characters" and "青蛙" in d.value for d in analysis.dimensions)


def test_gate_name_from_interrupt():
    class FakeInterrupt:
        value = {"gate": "outline_approval", "message": "ok"}

    assert gate_name_from_interrupt(FakeInterrupt()) == "outline_approval"


@pytest.mark.asyncio
async def test_drive_graph_until_idle_interrupt_loop():
    calls = {"n": 0}

    class FakeGraph:
        async def ainvoke(self, payload, config, context=None):
            calls["n"] += 1
            if calls["n"] == 1:
                class Interrupt:
                    value = {"gate": "characters_approval"}

                return {
                    "current_stage": "characters_approval",
                    "__interrupt__": [Interrupt()],
                }
            return {"current_stage": "compose_merge", "video_generation_skipped": False}

    async def on_interrupt(item):
        return {"action": "approve", "feedback": ""}

    result = await drive_graph_until_idle(
        FakeGraph(),
        initial_payload={"route_stage": "plan_characters"},
        graph_config={"configurable": {"thread_id": "t1"}},
        runtime_context=None,
        on_interrupt=on_interrupt,
        run_id=1,
    )
    assert result.final_stage == "compose_merge"
    assert result.interrupt_count == 1
    assert calls["n"] == 2

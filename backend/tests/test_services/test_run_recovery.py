from __future__ import annotations

from types import SimpleNamespace

from app.services.run_recovery import (
    AGENT_TO_STAGE,
    PHASE2_STAGE_ORDER,
    _infer_current_stage,
    _next_stage,
    _normalize_stage_history,
    _production_stage_for_approval,
    _resume_target_stage,
    _safe_stage_name,
    _snapshot_next_stage,
    _snapshot_values,
    _stage_from_snapshot,
    _stage_index,
    _thread_id_for_run,
)


class FakeRun:
    def __init__(self, id=None, current_agent=None):
        self.id = id
        self.current_agent = current_agent


# --- _thread_id_for_run ---

def test_thread_id_with_id():
    run = FakeRun(id=42)
    assert _thread_id_for_run(run) == "agent-run-42"


def test_thread_id_pending():
    run = FakeRun(id=None)
    assert _thread_id_for_run(run) == "agent-run-pending"


# --- _stage_index ---

def test_stage_index_valid():
    assert _stage_index("ideate") == 0
    assert _stage_index("script") == 2
    assert _stage_index("review") == 11


def test_stage_index_unknown_returns_zero():
    assert _stage_index("unknown") == 0
    assert _stage_index(None) == 0
    assert _stage_index(123) == 0


# --- _next_stage ---

def test_next_stage_valid():
    assert _next_stage("ideate") == "ideate_approval"
    assert _next_stage("script") == "script_approval"
    assert _next_stage("review") is None  # last stage


def test_next_stage_unknown_returns_first():
    assert _next_stage("unknown") == "ideate_approval"


def test_next_stage_last_stage_returns_none():
    assert _next_stage("review") is None


# --- _safe_stage_name ---

def test_safe_stage_name_valid():
    assert _safe_stage_name("ideate") == "ideate"
    assert _safe_stage_name("review") == "review"


def test_safe_stage_name_invalid():
    assert _safe_stage_name("not_a_stage") is None
    assert _safe_stage_name(None) is None
    assert _safe_stage_name(123) is None


# --- _stage_from_snapshot ---

def test_stage_from_snapshot_current_stage():
    snapshot = SimpleNamespace(values={"current_stage": "script"})
    assert _stage_from_snapshot(snapshot) == "script"


def test_stage_from_snapshot_route_stage_fallback():
    snapshot = SimpleNamespace(values={"route_stage": "character"})
    assert _stage_from_snapshot(snapshot) == "character"


def test_stage_from_snapshot_stage_history_fallback():
    snapshot = SimpleNamespace(values={"stage_history": ["ideate", "script", "character"]})
    assert _stage_from_snapshot(snapshot) == "character"


def test_stage_from_snapshot_no_values():
    snapshot = SimpleNamespace(values=None)
    assert _stage_from_snapshot(snapshot) is None


def test_stage_from_snapshot_non_dict_values():
    snapshot = SimpleNamespace(values="not a dict")
    assert _stage_from_snapshot(snapshot) is None


def test_stage_from_snapshot_empty_history():
    snapshot = SimpleNamespace(values={"stage_history": []})
    assert _stage_from_snapshot(snapshot) is None


def test_stage_from_snapshot_current_overrides_route():
    snapshot = SimpleNamespace(values={"current_stage": "script", "route_stage": "character"})
    assert _stage_from_snapshot(snapshot) == "script"


# --- _snapshot_values ---

def test_snapshot_values_returns_first_valid():
    s1 = SimpleNamespace(values={"a": 1})
    s2 = SimpleNamespace(values={"b": 2})
    assert _snapshot_values([s1, s2]) == {"a": 1}


def test_snapshot_values_skips_none():
    s1 = SimpleNamespace(values=None)
    s2 = SimpleNamespace(values={"b": 2})
    assert _snapshot_values([s1, s2]) == {"b": 2}


def test_snapshot_values_empty():
    assert _snapshot_values([]) == {}


# --- _normalize_stage_history ---

def test_normalize_stage_history_filters_valid():
    values = {"stage_history": ["ideate", "script", "bogus", "character"]}
    result = _normalize_stage_history(values)
    assert "ideate" in result
    assert "script" in result
    assert "character" in result
    assert "bogus" not in result


def test_normalize_stage_history_empty():
    assert _normalize_stage_history({}) == []


def test_normalize_stage_history_non_list():
    assert _normalize_stage_history({"stage_history": "not a list"}) == []


# --- _production_stage_for_approval ---

def test_production_stage_for_approval_valid():
    assert _production_stage_for_approval("script_approval") == "script"
    assert _production_stage_for_approval("character_approval") == "character"


def test_production_stage_for_approval_non_approval():
    assert _production_stage_for_approval("script") is None
    assert _production_stage_for_approval("ideate") is None


# --- _resume_target_stage ---

def test_resume_target_review_returns_route_stage():
    values = {"route_stage": "character"}
    assert _resume_target_stage("review", values=values, completed_stages=["ideate", "script"]) == "character"


def test_resume_target_review_fallback_to_current():
    values = {}
    assert _resume_target_stage("review", values=values, completed_stages=[]) == "review"


def test_resume_target_approval_returns_current():
    assert _resume_target_stage("script_approval", values={}, completed_stages=[]) == "script_approval"


def test_resume_target_completed_returns_next():
    assert _resume_target_stage("script", values={}, completed_stages=["ideate", "script"]) == "script_approval"


def test_resume_target_not_completed_returns_current():
    assert _resume_target_stage("script", values={}, completed_stages=["ideate"]) == "script"


# --- _infer_current_stage ---

def test_infer_from_snapshot():
    snapshot = SimpleNamespace(values={"current_stage": "character"})
    assert _infer_current_stage(FakeRun(), [snapshot]) == "character"


def test_infer_from_agent():
    assert _infer_current_stage(FakeRun(current_agent="scriptwriter"), []) == "script"


def test_infer_default_ideate():
    assert _infer_current_stage(FakeRun(), []) == "ideate"


# --- AGENT_TO_STAGE mapping ---

def test_agent_to_stage_coverage():
    assert AGENT_TO_STAGE["onboarding"] == "ideate"
    assert AGENT_TO_STAGE["director"] == "ideate"
    assert AGENT_TO_STAGE["scriptwriter"] == "script"
    assert AGENT_TO_STAGE["character_artist"] == "character"
    assert AGENT_TO_STAGE["storyboard_artist"] == "storyboard"
    assert AGENT_TO_STAGE["video_generator"] == "clip"
    assert AGENT_TO_STAGE["video_merger"] == "merge"
    assert AGENT_TO_STAGE["review"] == "review"


def test_phase2_stage_order_length():
    assert len(PHASE2_STAGE_ORDER) == 12
    assert PHASE2_STAGE_ORDER[0] == "ideate"
    assert PHASE2_STAGE_ORDER[-1] == "review"


# --- _snapshot_next_stage ---


def test_snapshot_next_stage_returns_first():
    snapshot = SimpleNamespace(next=("script", "character"))
    assert _snapshot_next_stage([snapshot]) == "script"


def test_snapshot_next_stage_skips_invalid():
    snapshot = SimpleNamespace(next=("bogus",))
    assert _snapshot_next_stage([snapshot]) is None


def test_snapshot_next_stage_empty():
    assert _snapshot_next_stage([]) is None


def test_snapshot_next_stage_none_attr():
    snapshot = SimpleNamespace(next=())
    assert _snapshot_next_stage([snapshot]) is None

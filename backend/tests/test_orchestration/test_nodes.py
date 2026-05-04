from __future__ import annotations


import pytest

from app.orchestration.nodes import (
    _approval_result,
    _auto_approval_result,
    _is_video_provider_invalid,
    _normalize_resume_value,
    _should_skip_stage,
    _stage_key,
    route_after_plan_approval,
    route_after_render_approval,
    route_after_review,
    route_from_start,
)
from app.orchestration.state import (
    PRODUCTION_STAGE_SEQUENCE,
    next_production_stage,
    workflow_progress_for_stage,
)


class TestStateHelpers:
    def test_next_production_stage_plan(self):
        assert next_production_stage("plan") == "render"

    def test_next_production_stage_render(self):
        assert next_production_stage("render") == "compose"

    def test_next_production_stage_compose(self):
        assert next_production_stage("compose") is None

    def test_next_production_stage_approval_suffix(self):
        assert next_production_stage("plan_approval") == "render"

    def test_next_production_stage_none(self):
        assert next_production_stage(None) is None

    def test_next_production_stage_invalid(self):
        assert next_production_stage("review") is None

    def test_workflow_progress_plan_start(self):
        assert workflow_progress_for_stage("plan") == 0.0

    def test_workflow_progress_plan_half(self):
        assert workflow_progress_for_stage("plan", within_stage=0.5) == pytest.approx(1 / 6)

    def test_workflow_progress_render_start(self):
        assert workflow_progress_for_stage("render") == pytest.approx(1 / 3)

    def test_workflow_progress_render_half(self):
        assert workflow_progress_for_stage("render", within_stage=0.5) == pytest.approx(0.5)

    def test_workflow_progress_compose(self):
        assert workflow_progress_for_stage("compose") == pytest.approx(2 / 3)

    def test_workflow_progress_compose_full(self):
        assert workflow_progress_for_stage("compose", within_stage=1.0) == 1.0

    def test_workflow_progress_clamps(self):
        assert workflow_progress_for_stage("plan", within_stage=2.0) == pytest.approx(1 / 3)

    def test_workflow_progress_unknown(self):
        assert workflow_progress_for_stage("unknown") == 0.0

    def test_production_stage_sequence(self):
        assert PRODUCTION_STAGE_SEQUENCE == ("plan", "render", "compose")


class TestNodeHelpers:
    def test_stage_key(self):
        assert _stage_key("plan") == "stage:plan"
        assert _stage_key("render") == "stage:render"
        assert _stage_key("compose") == "stage:compose"

    def test_should_skip_stage_no_lineage(self):
        assert _should_skip_stage({}, "plan") is False

    def test_should_skip_stage_with_lineage(self):
        assert _should_skip_stage({"artifact_lineage": ["stage:plan"]}, "plan") is True

    def test_should_skip_stage_different_stage(self):
        assert _should_skip_stage({"artifact_lineage": ["stage:plan"]}, "render") is False

    def test_is_video_provider_invalid_none(self):
        assert _is_video_provider_invalid(None) is False

    def test_is_video_provider_invalid_not_dict(self):
        assert _is_video_provider_invalid("string") is False

    def test_is_video_provider_invalid_valid(self):
        assert _is_video_provider_invalid({"video": {"valid": True}}) is False

    def test_is_video_provider_invalid_false(self):
        assert _is_video_provider_invalid({"video": {"valid": False}}) is True

    def test_is_video_provider_invalid_no_valid_key(self):
        assert _is_video_provider_invalid({"video": {}}) is False


class TestApprovalResults:
    def test_approval_result_no_feedback(self):
        result = _approval_result(
            approval_stage="plan_approval",
            history_key="plan",
            next_stage="render",
            feedback="",
        )
        assert result["review_requested"] is False
        assert result["route_stage"] == "render"

    def test_approval_result_with_feedback(self):
        result = _approval_result(
            approval_stage="plan_approval",
            history_key="plan",
            next_stage="render",
            feedback="fix the story",
        )
        assert result["review_requested"] is True
        assert result["route_stage"] == "review"
        assert result["approval_feedback"] == "fix the story"

    def test_auto_approval_result(self):
        result = _auto_approval_result(
            approval_stage="render_approval",
            history_key="render",
            next_stage="compose",
        )
        assert result["review_requested"] is False
        assert result["route_stage"] == "compose"
        assert result["approval_feedback"] == ""


class TestRouteFunctions:
    def test_route_from_start_plan(self):
        assert route_from_start({"current_stage": "plan"}) == "plan"

    def test_route_from_start_render(self):
        assert route_from_start({"current_stage": "render"}) == "render"

    def test_route_from_start_default(self):
        assert route_from_start({}) == "plan"

    def test_route_after_plan_approval_no_review(self):
        assert route_after_plan_approval({}) == "render"

    def test_route_after_plan_approval_with_review(self):
        assert route_after_plan_approval({"review_requested": True}) == "review"

    def test_route_after_plan_approval_route_stage_overrides(self):
        assert route_after_plan_approval({"route_stage": "render"}) == "render"

    def test_route_after_render_approval_no_review(self):
        assert route_after_render_approval({}) == "compose"

    def test_route_after_render_approval_with_review(self):
        assert route_after_render_approval({"review_requested": True}) == "review"

    def test_route_after_review_default(self):
        assert route_after_review({}) == "plan"

    def test_route_after_review_render(self):
        assert route_after_review({"route_stage": "render"}) == "render"

    def test_route_after_review_compose(self):
        assert route_after_review({"route_stage": "compose"}) == "compose"


class TestNormalizeResumeValue:
    def test_none(self):
        assert _normalize_resume_value(None) == ""

    def test_string(self):
        assert _normalize_resume_value("  hello  ") == "hello"

    def test_dict_with_feedback(self):
        assert _normalize_resume_value({"feedback": "fix it"}) == "fix it"

    def test_dict_with_text(self):
        assert _normalize_resume_value({"text": "ok"}) == "ok"

    def test_dict_no_known_key(self):
        result = _normalize_resume_value({"random": 42})
        assert result == str({"random": 42}).strip()

    def test_integer(self):
        assert _normalize_resume_value(42) == "42"

    def test_empty_dict(self):
        assert _normalize_resume_value({}) == "{}"

    def test_dict_feedback_over_text(self):
        assert _normalize_resume_value({"feedback": "a", "text": "b"}) == "a"

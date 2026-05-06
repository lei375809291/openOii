from __future__ import annotations

import pytest

from app.orchestration.state import workflow_progress_for_stage


def test_unknown_stage_returns_zero():
    assert workflow_progress_for_stage("nonexistent") == 0.0


def test_first_stage_zero_within():
    assert workflow_progress_for_stage("plan") == 0.0


def test_first_stage_full_within():
    total = 4
    result = workflow_progress_for_stage("plan", within_stage=1.0)
    assert result == pytest.approx(1.0 / total)


def test_last_stage_zero_within():
    total = 4
    result = workflow_progress_for_stage("compose")
    assert result == pytest.approx(3.0 / total)


def test_last_stage_full_within():
    result = workflow_progress_for_stage("compose", within_stage=1.0)
    assert result == 1.0


def test_mid_stage():
    total = 4
    result = workflow_progress_for_stage("character", within_stage=0.5)
    assert result == pytest.approx((1 + 0.5) / total)


def test_within_stage_clamped_above():
    result = workflow_progress_for_stage("plan", within_stage=2.0)
    assert result == pytest.approx(1.0 / 4)


def test_within_stage_clamped_below():
    result = workflow_progress_for_stage("plan", within_stage=-0.5)
    assert result == 0.0

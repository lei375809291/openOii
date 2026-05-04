from __future__ import annotations

import pytest

from app.orchestration.state import workflow_progress_for_stage


def test_unknown_stage_returns_zero():
    assert workflow_progress_for_stage("nonexistent") == 0.0


def test_first_stage_zero_within():
    assert workflow_progress_for_stage("ideate") == 0.0


def test_first_stage_full_within():
    total = 6
    result = workflow_progress_for_stage("ideate", within_stage=1.0)
    assert result == pytest.approx(1.0 / total)


def test_last_stage_zero_within():
    total = 6
    result = workflow_progress_for_stage("merge")
    assert result == pytest.approx(5.0 / total)


def test_last_stage_full_within():
    result = workflow_progress_for_stage("merge", within_stage=1.0)
    assert result == 1.0


def test_mid_stage():
    total = 6
    result = workflow_progress_for_stage("character", within_stage=0.5)
    assert result == pytest.approx((2 + 0.5) / total)


def test_within_stage_clamped_above():
    result = workflow_progress_for_stage("ideate", within_stage=2.0)
    assert result == pytest.approx(1.0 / 6)


def test_within_stage_clamped_below():
    result = workflow_progress_for_stage("ideate", within_stage=-0.5)
    assert result == 0.0

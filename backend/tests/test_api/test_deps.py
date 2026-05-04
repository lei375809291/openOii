from __future__ import annotations

import pytest

from app.models.agent_run import AgentRun


def test_require_run_id_returns_id():
    from app.api.deps import require_run_id

    run = AgentRun(project_id=1, id=42)
    assert require_run_id(run) == 42


def test_require_run_id_raises_on_none():
    from app.api.deps import require_run_id

    run = AgentRun(project_id=1)
    run.id = None
    with pytest.raises(RuntimeError, match="missing an id"):
        require_run_id(run)

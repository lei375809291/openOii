---
phase: 02
slug: langgraph-orchestration-durable-execution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + pytest-asyncio 0.24+ |
| **Config file** | `backend/pyproject.toml` |
| **Quick run command** | `pytest backend/tests/test_orchestration/test_phase2_graph.py -q` |
| **Full suite command** | `pytest backend/tests -q` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest backend/tests/test_orchestration/test_phase2_graph.py -q`
- **After every plan wave:** Run `pytest backend/tests -q`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-XX-01 | TBD | TBD | PIPE-01 | T-02-01 | Full LangGraph pipeline starts with a real `thread_id` and reaches merge path without duplicate side effects | integration | `pytest backend/tests/test_orchestration/test_phase2_graph.py -q` | ❌ W0 | ⬜ pending |
| 02-XX-02 | TBD | TBD | PIPE-01 | T-02-02 | API rejects a second full run while an active project run already exists | API/unit | `pytest backend/tests/test_api/test_phase2_generation.py -q` | ❌ W0 | ⬜ pending |
| 02-XX-03 | TBD | TBD | REL-01 | T-02-03 | Paused/interrupted run resumes from the last valid stage via checkpoint history | integration | `pytest backend/tests/test_orchestration/test_phase2_recovery.py -q` | ❌ W0 | ⬜ pending |
| 02-XX-04 | TBD | TBD | REL-01 | T-02-04 | Postgres checkpointer persists and restores thread state correctly | integration | `pytest backend/tests/integration/test_langgraph_postgres.py -q` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_orchestration/test_phase2_graph.py` — covers PIPE-01 happy-path graph execution.
- [ ] `backend/tests/test_orchestration/test_phase2_recovery.py` — covers REL-01 checkpoint resume/replay.
- [ ] `backend/tests/test_api/test_phase2_generation.py` — covers single-active-run conflict behavior.
- [ ] `backend/tests/integration/test_langgraph_postgres.py` — covers durable Postgres checkpoint persistence.
- [ ] `backend/tests/conftest.py` — add a Postgres-backed fixture if integration tests need real checkpoint storage.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Recovery summary shows stopped stage, preserved stages, and next stage before resume | REL-01 | UX text and staged recovery framing need human confirmation | Start a run, interrupt it at a checkpoint, reopen the project, confirm the recovery summary is shown before resume and that it is stage-oriented rather than shot-oriented |
| Character approval and storyboard approval block until user action | REL-01 | Requires human validation of interrupt-driven gate UX and wait semantics | Trigger each approval gate and verify the run does not continue until the creator chooses continue or feedback |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

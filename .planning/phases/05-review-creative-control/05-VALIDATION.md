---
phase: 05
slug: review-creative-control
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-11
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Backend: pytest 9.0.3 + pytest-asyncio 1.3.0; Frontend: Vitest 4.1.4 + Testing Library + Playwright 1.59.1 |
| **Config file** | `backend/pyproject.toml`, `frontend/package.json`, `frontend/vite.config.ts` |
| **Quick run command** | `uv run pytest backend/tests/test_api/test_review_creative_control.py backend/tests/test_api/test_shots.py -q && pnpm test -- --run frontend/app/components/canvas/ProjectOverview.test.tsx frontend/app/utils/workspaceStatus.test.ts` |
| **Full suite command** | `pnpm test && pnpm exec tsc --noEmit && uv run pytest -q` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run a focused backend rerun/acceptance slice or focused canvas creative-control slice
- **After every plan wave:** Run one backend selective-regeneration slice plus one frontend canvas/workspace slice, then `pnpm exec tsc --noEmit` if frontend changed
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-T1 | 05-01 | 1 | REVI-01 | T-05-01 | Selective regeneration only invalidates the targeted artifact and direct downstream dependents, including clip fallback through the approved shot contract | integration | `<automated>uv run pytest backend/tests/test_api/test_review_creative_control.py backend/tests/test_api/test_shots.py -q</automated>` | planned | ⬜ pending |
| 05-01-T2 | 05-01 | 2 | REVI-01 | T-05-02 | Accepted candidate becomes current and prior current becomes superseded with one-hop lineage preserved; character reruns accept description/reference-image edits | backend integration | `<automated>uv run pytest backend/tests/test_api/test_review_creative_control.py backend/tests/test_api/test_shots.py -q</automated>` | planned | ⬜ pending |
| 05-01-T3 | 05-01 | 3 | REVI-01 | T-05-03 | Clip reruns resolve through the approved shot contract and only invalidate final output | backend integration | `<automated>uv run pytest backend/tests/test_api/test_review_creative_control.py backend/tests/test_api/test_shots.py -q</automated>` | planned | ⬜ pending |
| 05-02-T1 | 05-02 | 1 | REVI-02 | T-05-04 | Workspace/editor UI exposes the allowed edit-before-rerun fields and acceptance controls without a version browser, including character edits and clip fallback | component | `<automated>pnpm test -- --run frontend/app/components/canvas/ProjectOverview.test.tsx frontend/app/utils/workspaceStatus.test.ts</automated>` | planned | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `backend/tests/test_api/test_review_creative_control.py` — covered by planned Wave 1 backend regression scaffolds
- [x] `frontend/app/components/canvas/ProjectOverview.test.tsx` — covered by planned Wave 1 frontend regression scaffolds
- [x] `frontend/app/utils/workspaceStatus.test.ts` — covered by planned Wave 1 frontend regression scaffolds
- [x] `backend/tests/test_api/test_shots.py` — covered by planned Wave 1 backend contract tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Creator can understand candidate vs current vs superseded without a version browser | REVI-01 | Whether lineage chips and acceptance affordances are actually understandable requires visual judgment | Generate a candidate rerun, compare current and candidate in the workspace, accept it, and confirm the previous artifact becomes visibly superseded with a short lineage reason |
| Selective rerun feels scoped and trustworthy in the workspace | REVI-01, REVI-02 | The creator must perceive what will change before rerunning; this is hard to prove with pure automation | Trigger a character / shot / clip rerun from the workspace and verify the UI clearly indicates the target, any stale downstream artifacts, and the fact that unrelated artifacts remain untouched |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

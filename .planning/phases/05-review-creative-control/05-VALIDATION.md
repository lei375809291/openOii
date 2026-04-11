---
phase: 05
slug: review-creative-control
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| **Quick run command** | `uv run pytest tests/test_api/test_review_creative_control.py tests/test_api/test_shots.py -q && pnpm test -- --run app/components/canvas/ProjectOverview.test.tsx app/components/canvas/InfiniteCanvas.test.tsx` |
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
| 05-XX-01 | TBD | TBD | REVI-01 | T-05-01 | Selective regeneration only invalidates the targeted artifact and direct downstream dependents | integration | `uv run pytest tests/test_api/test_review_creative_control.py -q` | ❌ W0 | ⬜ pending |
| 05-XX-02 | TBD | TBD | REVI-01 | T-05-02 | Accepted candidate becomes current and prior current becomes superseded with one-hop lineage preserved | backend + frontend integration | `uv run pytest tests/test_api/test_character_storyboard_review.py tests/test_api/test_shots.py -q && pnpm test -- --run app/utils/workspaceStatus.test.ts app/components/canvas/CharacterSectionShape.test.tsx app/components/canvas/StoryboardSectionShape.test.tsx` | partial ✅ / partial tightening needed | ⬜ pending |
| 05-XX-03 | TBD | TBD | REVI-02 | T-05-03 | Shot rerun accepts prompt and structured instruction edits before rerun starts | integration | `uv run pytest tests/test_api/test_shots.py -q` | ✅ existing file, contract needs strengthening | ⬜ pending |
| 05-XX-04 | TBD | TBD | REVI-02 | T-05-04 | Workspace/editor UI exposes the allowed edit-before-rerun fields and acceptance controls without a version browser | component | `pnpm test -- --run app/components/canvas/ProjectOverview.test.tsx app/components/canvas/InfiniteCanvas.test.tsx` | `InfiniteCanvas.test.tsx` ✅ / `ProjectOverview.test.tsx` ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_api/test_review_creative_control.py` — missing candidate/current acceptance and direct-downstream invalidation coverage
- [ ] `frontend/app/components/canvas/ProjectOverview.test.tsx` — missing edit-before-rerun payload and acceptance-flow coverage
- [ ] `frontend/app/utils/workspaceStatus.test.ts` — extend with current/superseded/lineage labels if projection changes
- [ ] `backend/tests/test_api/test_shots.py` — replace placeholder regenerate assertions with the real selective-rerun contract

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Creator can understand candidate vs current vs superseded without a version browser | REVI-01 | Whether lineage chips and acceptance affordances are actually understandable requires visual judgment | Generate a candidate rerun, compare current and candidate in the workspace, accept it, and confirm the previous artifact becomes visibly superseded with a short lineage reason |
| Selective rerun feels scoped and trustworthy in the workspace | REVI-01, REVI-02 | The creator must perceive what will change before rerunning; this is hard to prove with pure automation | Trigger a character / shot / clip rerun from the workspace and verify the UI clearly indicates the target, any stale downstream artifacts, and the fact that unrelated artifacts remain untouched |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

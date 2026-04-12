---
phase: 06
slug: final-assembly-delivery
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-11
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Backend: pytest 9.0.3 + pytest-asyncio 1.3.0; Frontend: Vitest 4.1.4 + Playwright 1.59.1 |
| **Config file** | `backend/pyproject.toml`, `backend/tests/conftest.py`, `frontend/vite.config.ts`, `frontend/playwright.config.ts` |
| **Quick run command** | `uv run pytest tests/test_agents/test_video_merger.py tests/test_api/test_projects.py tests/test_api/test_review_creative_control.py tests/test_api/test_generation.py -q && pnpm exec vitest run app/utils/workspaceStatus.test.ts app/components/canvas/VideoSectionShape.test.tsx app/components/canvas/ProjectOverview.test.tsx` |
| **Full suite command** | `pnpm test && pnpm e2e && uv run pytest -q` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run a focused backend merge/delivery slice or focused final-output UI slice
- **After every plan wave:** Run one backend merge/delivery slice plus one frontend final-output slice, then `pnpm exec tsc --noEmit` if frontend changed
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 06-01 | 1 | PIPE-03, DELIV-02 | T-06-01, T-06-03 | Final merge stays blocked until every current clip is successful; stale finals remain visible with blocking clip context; retry-merge feedback re-enters the same review/run boundary | backend unit/integration | `<automated>uv run pytest tests/test_agents/test_video_merger.py tests/test_api/test_review_creative_control.py tests/test_api/test_projects.py tests/test_api/test_generation.py -q</automated>` | partial ✅ / needs new cases | ⬜ pending |
| 06-01-02 | 06-01 | 1 | PIPE-03, DELIV-02 | T-06-01, T-06-03 | Merge-gate logic, retry routing, and controlled download delivery preserve the canonical final asset state | backend integration | `<automated>uv run pytest tests/test_agents/test_video_merger.py tests/test_api/test_generation.py tests/test_api/test_projects.py -q</automated>` | partial ✅ / implementation pending | ⬜ pending |
| 06-02-01 | 06-02 | 2 | DELIV-01, DELIV-02 | T-06-04, T-06-05 | Final-output card renders previewable current/stale states, provenance copy, download affordances, and retry-merge controls in the existing workspace | frontend component | `<automated>pnpm exec vitest run app/utils/workspaceStatus.test.ts app/components/canvas/VideoSectionShape.test.tsx app/components/canvas/ProjectOverview.test.tsx</automated>` | partial ✅ / `VideoSectionShape.test.tsx` missing | ⬜ pending |
| 06-02-02 | 06-02 | 2 | DELIV-01, DELIV-02 | T-06-05, T-06-06 | Browser smoke verifies preview/download/retry from the workspace while websocket hydration keeps stale/current state in sync | frontend component / e2e | `<automated>pnpm exec vitest run app/utils/workspaceStatus.test.ts app/components/canvas/VideoSectionShape.test.tsx app/components/canvas/ProjectOverview.test.tsx && pnpm exec playwright test tests/e2e/final-delivery.spec.ts</automated>` | partial ✅ / e2e missing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_api/test_review_creative_control.py` — add stale-final retention and blocking-clip surfacing cases
- [ ] `backend/tests/test_api/test_generation.py` — add final-output retry-merge feedback coverage through the existing review/recovery flow
- [ ] `backend/tests/test_agents/test_video_merger.py` — add blocked / stale / retry / eligibility cases for merge
- [ ] `backend/tests/test_api/test_projects.py` — add preview/download route coverage and stale-final semantics
- [ ] `frontend/app/components/canvas/shapes/VideoSectionShape.test.tsx` — add current/stale/blocked preview and download UI assertions
- [ ] `frontend/tests/e2e/final-delivery.spec.ts` — add browser-level preview/download smoke flow

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stale final is understandable and not mistaken for the current one | PIPE-03, DELIV-01 | Requires visual judgment on stale/outdated labeling and provenance copy | Trigger a clip change after a final exists, confirm the old final remains previewable but is clearly marked stale/outdated, and verify the replacement state is understandable |
| Final-output card is a sufficient delivery surface | DELIV-01, DELIV-02 | Needs browser-level UX confirmation that preview, download, blockers, and retry all feel coherent in one place | Use the workspace final-output card to preview, download, and retry a merged video, then simulate a blocking clip or failed merge and confirm the same card explains the issue and surfaces retry |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

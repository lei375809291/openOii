---
phase: 04
slug: workspace-realtime-progress
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Backend: pytest 8 + pytest-asyncio; Frontend: Vitest 4 + Testing Library + Playwright |
| **Config file** | `backend/pyproject.toml`, `frontend/package.json` |
| **Quick run command** | `pnpm test -- --run app/hooks/useWebSocket.test.ts app/components/canvas/InfiniteCanvas.test.tsx && uv run pytest tests/test_api/test_websocket.py -q` |
| **Full suite command** | `pnpm test && pnpm exec tsc --noEmit && uv run pytest -q` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test -- --run app/hooks/useWebSocket.test.ts app/components/canvas/InfiniteCanvas.test.tsx` or `uv run pytest tests/test_api/test_websocket.py -q` depending on the slice
- **After every plan wave:** Run `pnpm test && pnpm exec tsc --noEmit` plus backend websocket coverage with `uv run pytest -q`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-XX-01 | TBD | TBD | WORK-01 | T-04-01 | Canonical workspace sections render even when some artifacts are still empty placeholders | component/integration | `pnpm test -- --run app/components/layout/StageView.test.tsx app/components/canvas/InfiniteCanvas.test.tsx` | `InfiniteCanvas.test.tsx` ✅ / `StageView.test.tsx` ❌ W0 | ⬜ pending |
| 04-XX-02 | TBD | TBD | WORK-02 | T-04-02 | Artifact cards expose clear draft / generating / blocked / failed / complete / superseded state without local-only drift | component/unit | `pnpm test -- --run app/components/canvas/shapes/ScriptSectionShape.test.tsx app/components/canvas/shapes/CharacterSectionShape.test.tsx app/components/canvas/shapes/StoryboardSectionShape.test.tsx app/components/canvas/shapes/VideoSectionShape.test.tsx` | partial ✅ / partial ❌ W0 | ⬜ pending |
| 04-XX-03 | TBD | TBD | PIPE-02 | T-04-03 | WebSocket progress, progress shell, and refresh hydration stay aligned with backend-authored run state | unit/integration | `pnpm test -- --run app/hooks/useWebSocket.test.ts app/stores/editorStore.test.ts app/pages/ProjectPage.test.tsx` | `useWebSocket.test.ts` ✅ / `ProjectPage.test.tsx` ❌ W0 | ⬜ pending |
| 04-XX-04 | TBD | TBD | PIPE-02 | T-04-04 | Backend websocket payloads and artifact projection remain project-scoped and typed | backend API/unit | `uv run pytest tests/test_api/test_websocket.py -q` | existing backend websocket coverage ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/app/components/layout/StageView.test.tsx` — covers empty workspace guidance vs canvas fallback for WORK-01
- [ ] `frontend/app/components/canvas/shapes/VideoSectionShape.test.tsx` — covers final-output placeholder/status states for WORK-02
- [ ] `frontend/app/pages/ProjectPage.test.tsx` — covers refresh/hydration behavior after `projectUpdatedAt` changes for PIPE-02
- [ ] `frontend/app/components/canvas/statusProjection.ts` (or equivalent helper, if extracted) — keeps WORK-01 / WORK-02 projection logic deterministic and testable

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Creator can understand the full pipeline shape even before some artifacts exist | WORK-01, WORK-02 | Requires human judgment on whether placeholders and blocked states feel understandable rather than noisy | Open a project in an early or paused state, refresh, and confirm that script / character / storyboard / clip / final-output sections remain understandable with placeholder cards and clear status labels |
| Approval pauses are understandable in both the progress shell and the canvas | PIPE-02, WORK-02 | Needs human confirmation that “waiting for review” and downstream blocked states are simultaneously clear | Trigger a character/storyboard approval pause, confirm the progress banner says waiting for review, and verify downstream artifact cards show blocked/not started rather than disappearing |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

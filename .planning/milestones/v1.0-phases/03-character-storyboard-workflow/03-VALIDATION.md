---
phase: 03
slug: character-storyboard-workflow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + pytest-asyncio / Vitest 4.x + Playwright 1.57 |
| **Config file** | `backend/pyproject.toml`, `frontend/package.json` |
| **Quick run command** | `uv run pytest backend/tests/test_api/test_characters.py backend/tests/test_api/test_shots.py backend/tests/test_orchestration/test_phase2_graph.py -q` |
| **Full suite command** | `uv run pytest backend/tests -q && pnpm test -- --run && pnpm e2e` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the smallest backend or frontend test slice touching the edited file(s)
- **After every plan wave:** Run backend and frontend suites for the touched area, plus typecheck/build if the wave changes frontend code
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-XX-01 | TBD | TBD | CHAR-01 | T-03-01 | Character reference create/update/replace keeps approved reference frozen for downstream stages | backend API/unit | `uv run pytest backend/tests/test_api/test_characters.py -q` | ✅ existing file, coverage incomplete | ⬜ pending |
| 03-XX-02 | TBD | TBD | CHAR-02 | T-03-02 | Storyboard/video prompt construction consumes only approved shot-bound character references | backend integration | `uv run pytest backend/tests/test_orchestration/test_phase3_graph.py -q` | ❌ W0 | ⬜ pending |
| 03-XX-03 | TBD | TBD | SHOT-01 | T-03-03 | Video generation remains blocked until all required storyboard shots are approved | backend API/orchestration | `uv run pytest backend/tests/test_api/test_shots.py -q` | ✅ existing file, coverage incomplete | ⬜ pending |
| 03-XX-04 | TBD | TBD | SHOT-01 | T-03-04 | WebSocket-driven review-state transitions (mapped to 03-03 Task 1/2) hydrate the store and keep the current approved/superseded state visible in the UI | frontend unit | `pnpm test -- --run frontend/app/stores/editorStore.test.ts frontend/app/hooks/useWebSocket.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_orchestration/test_phase3_graph.py` — covers CHAR-02 and SHOT-01 approval gating
- [ ] `backend/tests/test_api/test_character_storyboard_review.py` — covers character/shot approval payloads and updated read models
- [ ] `frontend/app/components/canvas/CharacterSectionShape.test.tsx` — covers approval badge and state rendering
- [ ] `frontend/app/components/canvas/StoryboardSectionShape.test.tsx` — covers per-shot approval controls and blocking UI
- [ ] `frontend/app/stores/editorStore.test.ts` + `frontend/app/hooks/useWebSocket.test.ts` — covers websocket-driven review-state transitions and store hydration

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Creator can review each storyboard shot and understand which are approved vs superseded | SHOT-01 | Requires human validation of review clarity and UI affordance quality | Open a project with storyboard outputs, inspect per-shot review controls, approve/reject shots, and confirm the UI reflects approved/superseded state without exposing a full version browser |
| Character approval freezes the current reference used by downstream storyboard/video generation | CHAR-01, CHAR-02 | Needs human confirmation that the review flow is understandable and matches creator expectations | Approve a character, attempt a downstream storyboard/video step, and confirm the approved reference is the one being reused rather than an unapproved replacement |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

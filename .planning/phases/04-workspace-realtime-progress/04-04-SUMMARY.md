---
phase: 04-workspace-realtime-progress
plan: "04"
type: tdd
subsystem: frontend/workspace-shell
tags:
  - frontend
  - workspace
  - tdd
  - tldraw
  - vitest
depends_on:
  - 04-02
key-files:
  created:
    - frontend/app/components/layout/StageView.test.tsx
  modified:
    - frontend/app/components/layout/StageView.tsx
    - frontend/app/components/canvas/InfiniteCanvas.tsx
    - frontend/app/components/canvas/InfiniteCanvas.test.tsx
decisions:
  - Make the projected canvas the default shell for empty workspace states.
  - Treat unchanged backend projection as immutable input and skip redundant canvas rewrites.
metrics:
  duration: "~25m"
  completed_date: "2026-04-11"
---

# Phase 04 Plan 04: Workspace Shell Wiring Summary

Projected the workspace shell into the backend-authored canvas view and kept refresh-safe canvas syncing deterministic.

## Completed Tasks

1. **Task 1 — Lock the shell regression cases**
   - Commit: `013b8e8`
   - Files: `frontend/app/components/layout/StageView.test.tsx`, `frontend/app/components/canvas/InfiniteCanvas.test.tsx`

2. **Task 2 — Wire the projected workspace shell**
   - Commit: `e24feb9`
   - Files: `frontend/app/components/layout/StageView.tsx`, `frontend/app/components/canvas/InfiniteCanvas.tsx`

## Verification

- `pnpm test -- --run app/components/layout/StageView.test.tsx app/components/canvas/InfiniteCanvas.test.tsx`
- `pnpm exec tsc --noEmit`

## Deviations from Plan

None.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check

- `frontend/app/components/layout/StageView.test.tsx` exists: PASS
- `frontend/app/components/canvas/InfiniteCanvas.test.tsx` exists: PASS
- `frontend/app/components/layout/StageView.tsx` exists: PASS
- `frontend/app/components/canvas/InfiniteCanvas.tsx` exists: PASS
- Commit `013b8e8` exists: PASS
- Commit `e24feb9` exists: PASS

## Self-Check: PASSED

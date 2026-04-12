---
phase: 03-character-storyboard-workflow
plan: 03
title: Frontend review-state wiring for characters, shots, and canvas approvals
tech_stack:
  - React
  - TypeScript
  - Zustand
  - Vitest
  - WebSocket
key_files:
  - frontend/app/types/index.ts
  - frontend/app/services/api.ts
  - frontend/app/stores/editorStore.ts
  - frontend/app/hooks/useWebSocket.ts
  - frontend/app/components/canvas/canvasEvents.ts
  - frontend/app/components/canvas/shapes/types.ts
  - frontend/app/services/api.test.ts
  - frontend/app/hooks/useWebSocket.test.ts
  - frontend/app/stores/editorStore.test.ts
  - frontend/app/components/canvas/canvasEvents.test.ts
commits:
  - 936db53
  - d8246e4
  - 3428c0f
---

# Phase 03 Plan 03: Frontend review-state wiring for characters, shots, and canvas approvals

## Summary
Frontend now carries server-authored approval state for characters and shots, exposes approve mutations, hydrates websocket updates into the editor cache, and adds explicit canvas approve actions.

## Completed Work
- Added approval-state fields to shared `Character` and `Shot` types.
- Added `charactersApi.approve()` and `shotsApi.approve()` while keeping existing fetch helpers intact.
- Made the editor store upsert reviewed character/shot snapshots instead of dropping them.
- Exported a typed websocket event application helper for review hydration.
- Added `approve-character` and `approve-shot` canvas bus events plus explicit reviewed shape snapshots.
- Added regression tests for store hydration, websocket review updates, API endpoints, and canvas approve events.

## Deviations from Plan
None.

## Verification
- `pnpm test -- --run frontend/app/stores/editorStore.test.ts frontend/app/hooks/useWebSocket.test.ts frontend/app/services/api.test.ts frontend/app/components/canvas/canvasEvents.test.ts`
- `pnpm tsc --noEmit`

## Known Stubs
None.

## Threat Flags
None.

## Self-Check
PASSED

---
phase: 03-character-storyboard-workflow
plan: 04
type: execute
status: completed
subsystem: canvas review workflow
tags: [react, tldraw, approvals, testing, typescript]
depends_on: [03-03]
requires: [SHOT-01]
provides:
  - character approval badges and controls
  - storyboard approval badges, cast bindings, and structured intent
  - canvas approve-event wiring and store refresh
affects:
  - frontend/app/components/canvas/shapes/CharacterSectionShape.tsx
  - frontend/app/components/canvas/shapes/StoryboardSectionShape.tsx
  - frontend/app/components/canvas/InfiniteCanvas.tsx
  - frontend/app/components/canvas/CharacterSectionShape.test.tsx
  - frontend/app/components/canvas/StoryboardSectionShape.test.tsx
  - frontend/app/components/canvas/InfiniteCanvas.test.tsx
key-files:
  - frontend/app/components/canvas/shapes/CharacterSectionShape.tsx
  - frontend/app/components/canvas/shapes/StoryboardSectionShape.tsx
  - frontend/app/components/canvas/InfiniteCanvas.tsx
  - frontend/app/components/canvas/CharacterSectionShape.test.tsx
  - frontend/app/components/canvas/StoryboardSectionShape.test.tsx
  - frontend/app/components/canvas/InfiniteCanvas.test.tsx
decisions:
  - Keep the canvas on the current approved/superseded state only; no version browser or history switcher.
  - Use typed approve events plus API mutations so the canvas cannot fake review state locally.
commits:
  - f0610ec
  - 5731236
  - 591b052
metrics:
  completed_date: 2026-04-11
  duration: "~1 session"
---

# Phase 03 Plan 04: Canvas Approval Summary

把审批合同收口到画布层：角色和分镜卡显示当前审核状态，分镜补上绑定角色与结构化意图，画布容器把 approve 事件送到后端并立即回写 store。

## Completed Work

1. 锁定了画布审批回归测试，覆盖角色/分镜审批状态与 approve 事件路由。
2. 给角色卡和分镜卡补上当前审批状态徽标、approve/reapprove 控件、结构化意图和绑定角色展示。
3. 为 `InfiniteCanvas` 增加 approve character / approve shot 的 React Query mutations，并在成功后同步更新编辑器 store。

## Deviations from Plan

None - plan executed as written.

## Verification

- `pnpm test -- --run app/components/canvas/CharacterSectionShape.test.tsx app/components/canvas/StoryboardSectionShape.test.tsx app/components/canvas/InfiniteCanvas.test.tsx`
- `pnpm tsc --noEmit`

## Commit Map

| Task | Commit | Result |
|------|--------|--------|
| 1 | f0610ec | approval UI tests locked down |
| 2 | 5731236 | approval state rendered on cards |
| 3 | 591b052 | approve events wired through canvas |

## Self-Check

PASSED — summary file exists and all three task commits are present in git history.

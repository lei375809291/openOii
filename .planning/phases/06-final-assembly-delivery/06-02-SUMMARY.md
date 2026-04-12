---
phase: 06-final-assembly-delivery
plan: 02
subsystem: frontend/final-delivery
tags:
  - final-video
  - workspace
  - canvas
  - e2e
dependency_graph:
  requires:
    - 06-01
  provides:
    - current-vs-stale-final-output-ui
    - controlled-final-video-download-route
    - retry-merge-final-output-cta
  affects:
    - frontend/app/utils/workspaceStatus.ts
    - frontend/app/components/canvas/shapes/VideoSectionShape.tsx
    - frontend/app/components/canvas/ProjectOverview.tsx
    - frontend/app/hooks/useCanvasLayout.ts
    - frontend/app/pages/ProjectPage.tsx
metrics:
  duration: "in-session"
  completed_date: "2026-04-12"
  commits:
    - "2427b73"
    - "5caa5bb"
---

# Phase 06 Plan 02: Final Assembly & Delivery Summary

一句话：把最终成片固定为工作区里的统一交付面，明确 current/stale 来源、下载路由和重试合成入口。

## 完成内容

- `workspaceStatus.ts` 增加最终输出投影：当前/失效状态、来源文案、阻塞文案、下载地址和重试反馈。
- `VideoSectionShape` 现在显示预览、下载、重试三按钮，并携带 provenance 文案。
- `ProjectOverview` 与 canvas 端统一使用同一个 final video source 和 `/api/v1/projects/:id/final-video` 下载路由。
- `useCanvasLayout` 把 final-output 元数据传进画布卡片，保证画布和概览一致。
- `ProjectPage` 的项目切换/恢复逻辑已修正，避免 store effect 造成循环刷新。
- E2E smoke 覆盖了 workspace 内预览、下载和重试入口。

## 任务结果

| Task | 结果 | Commit |
|---|---|---|
| Task 1: final-output UI regression tests | 完成 | `2427b73` |
| Task 2: final preview/provenance/download wiring | 完成 | `5caa5bb` |

## 验证

- `pnpm exec vitest run app/utils/workspaceStatus.test.ts app/components/canvas/shapes/VideoSectionShape.test.tsx app/components/canvas/ProjectOverview.test.tsx` ✅
- `pnpm exec playwright test tests/e2e/final-delivery.spec.ts` ✅
- `pnpm exec tsc --noEmit` ✅

## 偏差

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Playwright 被占用端口阻塞**
- **发现时机：** E2E 验证阶段
- **问题：** `http://localhost:15173` 已被旧进程占用，导致 Playwright webServer 启动失败。
- **处理：** 结束残留 dev server 后重新运行 smoke test。
- **结果：** E2E 成功通过。

**2. [Post-execution review] stale final badge 与状态语义不一致**
- **发现时机：** Phase 06 code review
- **问题：** `ProjectOverview.tsx` 的最终视频 badge 固定为 success 样式，即使 `finalOutputMeta.statusLabel` 已是 stale/superseded。
- **处理：** 改为根据 `finalOutputMeta.sectionState` 复用 `getWorkspaceSectionStatusBadgeClass(...)` 生成 badge 样式。
- **结果：** stale final 的视觉语义与 canvas/workspace 其它 final-output 展示保持一致。

## 待处理

- 仓库里还有与本计划无关的既有脏改动，未纳入本次提交。

## 结论

本计划已完成：最终成片在现有工作区内可预览、可下载、可重试，且 current/stale 来源信息是明确的。

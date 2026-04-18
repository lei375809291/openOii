---
phase: 08-validation-deterministic-resolution
plan: 03
subsystem: ui
tags: [react, project-page, chat-panel, provider-proof, blocking-ui]
requires:
  - phase: 08-validation-deterministic-resolution
    provides: project provider resolution contract and generate 422 preflight gate
provides:
  - project page proof card showing selected/resolved/invalid provider state
  - disabled generate CTA driven by backend validity fields
  - frontend types aligned to phase 08 provider resolution contract
affects: [09-runtime-snapshot-semantics, 10-proof-surface, creator-proof]
tech-stack:
  added: []
  patterns: [backend-truth-only rendering, validity-driven CTA blocking, accessible disabled reason messaging]
key-files:
  created: []
  modified:
    [frontend/app/types/index.ts, frontend/app/pages/ProjectPage.tsx, frontend/app/pages/ProjectPage.test.tsx, frontend/app/components/chat/ChatPanel.tsx, frontend/app/utils/workspaceStatus.test.ts]
key-decisions:
  - "前端只消费后端返回的 selected/resolved/valid/reason，不自行猜测 provider 解析结果。"
  - "生成按钮阻断理由直接来自首个 invalid modality 的 reason_message。"
patterns-established:
  - "Project proof card doubles as start-time validation surface for creators."
  - "Disabled CTA reasons should stay visible and accessible next to the blocked action."
requirements-completed: [VAL-01, VAL-02]
duration: 17min
completed: 2026-04-18
---

# Phase 08 Plan 03: Frontend blocking surface Summary

**Project page now renders backend-resolved provider validity and blocks the generate CTA before creators start an invalid run**

## Performance

- **Duration:** 17 min
- **Started:** 2026-04-18T01:15:00Z
- **Completed:** 2026-04-18T01:32:12Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- 前端 provider 类型升级为 Phase 08 合同，支持 `resolved_key/valid/reason_*`。
- 项目页 proof card 现在同时展示 selected / resolved / invalid reason，creator 能直接看到“为什么不能启动”。
- ChatPanel 的开始生成 CTA 会在 invalid provider 时禁用，并把后端阻断原因可见且可访问地展示出来。

## Task Commits

1. **Task 1: 先锁定项目页 invalid proof 与禁用生成回归** - `1696561` (test)
2. **Task 2: 对齐前端类型与项目页 proof card，展示真实 resolved state** - `6084014` (feat)
3. **Task 3: 把 generate CTA 接到 invalid 阻断，并保持 422 提示一致** - `5525283` (fix)

## Files Created/Modified
- `frontend/app/types/index.ts` - provider entry 类型升级到 resolved/valid/reason 合同。
- `frontend/app/pages/ProjectPage.tsx` - proof card 渲染真实解析结果，并按 invalid 状态禁用 generate。
- `frontend/app/pages/ProjectPage.test.tsx` - 覆盖 invalid provider UI 与 disabled CTA。
- `frontend/app/components/chat/ChatPanel.tsx` - 在 CTA 附近展示可访问的阻断原因。
- `frontend/app/utils/workspaceStatus.test.ts` - 对齐更新后的 provider entry 类型。

## Decisions Made
- 继续复用现有 `ApiError` 处理路径，不在前端新增 provider-precheck 专用错误分支。
- proof card 在 invalid 时统一显示 `未解析`，避免前端伪造 resolved provider。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 更新 `workspaceStatus` 相关测试数据以适配新的 provider entry 类型**
- **Found during:** Task 2 (对齐前端类型与项目页 proof card，展示真实 resolved state)
- **Issue:** `ProjectProviderEntry` 结构升级后，现有 `workspaceStatus.test.ts` 仍在使用旧字段，导致 `tsc --noEmit` 失败。
- **Fix:** 把测试 fixture 改为 `selected_key/resolved_key/valid/reason_*` 结构。
- **Files modified:** `frontend/app/utils/workspaceStatus.test.ts`
- **Verification:** `pnpm --dir frontend exec vitest run app/pages/ProjectPage.test.tsx && pnpm --dir frontend exec tsc --noEmit`
- **Committed in:** `6084014`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** 仅修复类型迁移带来的编译阻塞，没有新增额外产品范围。

## Issues Encountered
- invalid proof 测试初版因为 DOM 文本重复匹配而失败；改成 `getAllByText(...).length` 后更稳定地锁定真实 UI 行为。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- creator-facing start gate 已完整落地，Phase 09 可以专注在 run snapshot 语义，不必再回头补入口阻断。
- provider validity 原因已经能稳定透传到前端，Phase 10 可在此基础上扩展 evidence/proof surface。

## Self-Check

PASSED

---
*Phase: 08-validation-deterministic-resolution*
*Completed: 2026-04-18*

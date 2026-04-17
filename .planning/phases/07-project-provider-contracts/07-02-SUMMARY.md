---
phase: 07-project-provider-contracts
plan: 02
subsystem: ui
tags: [react, typescript, projects, providers, react-query]
requires:
  - phase: 07-01
    provides: project provider_settings contract and project-level override persistence
provides:
  - creator-facing provider selection during project creation
  - project page provider proof card with source badges and inline editing
  - frontend project provider contract types and payload wiring
affects: [Phase 08, provider-resolution, creator-workflow]
tech-stack:
  added: []
  patterns: [shared provider selection radio fields, project query invalidation without editor store reset]
key-files:
  created:
    - frontend/app/components/project/ProviderSelectionFields.tsx
  modified:
    - frontend/app/pages/NewProjectPage.tsx
    - frontend/app/pages/ProjectPage.tsx
    - frontend/app/services/api.ts
    - frontend/app/types/index.ts
    - frontend/app/pages/NewProjectPage.test.tsx
    - frontend/app/pages/ProjectPage.test.tsx
    - frontend/app/pages/HomePage.tsx
    - frontend/app/utils/workspaceStatus.test.ts
key-decisions:
  - "把 text/image/video provider 选择抽成共享受控单选组件，并把 inherit-default 明确映射为 null。"
  - "项目页保存 provider 时只 invalidates ['project', projectId] 和 ['projects']，避免重置实时进度与恢复态。"
patterns-established:
  - "Project provider proof UI: effective_key 直接展示，source badge 以后端 provider_settings.source 为准。"
  - "Create/update payloads use explicit provider override fields instead of Partial<Project>."
requirements-completed: [PROV-01, PROV-02, PROV-03]
duration: 10 min
completed: 2026-04-17
---

# Phase 07 Plan 02: Creator-facing Provider UI Summary

**创作者现在可以在新建项目和项目页中分别设置 text/image/video provider，并在项目页直接看到每个 modality 的生效 provider 与来源。**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-17T16:16:00Z
- **Completed:** 2026-04-17T16:25:51Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- 为新建项目流程加入共享 provider 选择字段，并把“继承默认”稳定提交为 `null` override。
- 为项目页加入 provider proof/edit card，清楚展示 text / image / video 的 `effective_key` 与来源 badge。
- 为前端补齐 provider 合同类型、API payload 形状与页面回归测试，锁定刷新回显和非破坏性更新行为。

## Task Commits

Each task was committed atomically:

1. **Task 1: 先锁定前端 provider 提交与展示回归测试** - `963acf3` (test)
2. **Task 2: 在项目创建流里加入 provider 选择字段并提交 override** - `84cb16b` (feat)
3. **Task 3: 在项目页展示并编辑 provider proof card** - `89b5d3a` (feat)

**Plan metadata:** 未提交（按本次执行要求跳过 STATE/ROADMAP/REQUIREMENTS 更新）

## Files Created/Modified
- `frontend/app/components/project/ProviderSelectionFields.tsx` - 共享 text/image/video provider 受控单选字段。
- `frontend/app/pages/NewProjectPage.tsx` - 新建项目时选择并提交 provider override，同时在确认页展示当前选择。
- `frontend/app/pages/ProjectPage.tsx` - 项目页 provider proof/edit card、来源 badge 与非破坏性保存逻辑。
- `frontend/app/services/api.ts` - 为项目 create/update 切换到显式 provider payload 类型。
- `frontend/app/types/index.ts` - 增加 `provider_settings`、override 字段与 create/update payload 合同。
- `frontend/app/pages/NewProjectPage.test.tsx` - 锁定创建 payload 中的 provider override/null 语义。
- `frontend/app/pages/ProjectPage.test.tsx` - 锁定 provider proof 渲染与保存后不清空运行态的行为。
- `frontend/app/pages/HomePage.tsx` - 对齐新的项目创建合同，默认提交全继承 override。
- `frontend/app/utils/workspaceStatus.test.ts` - 为 `Project` fixture 补齐 provider 合同字段，保持类型校验通过。

## Decisions Made
- 使用共享 `ProviderSelectionFields` 组件覆盖创建与编辑两个入口，避免 provider 选项和 null 映射逻辑在多个页面漂移。
- 项目页 proof surface 直接展示后端返回的 `effective_key`/`source`，前端不自行推断来源真假。
- 旧入口 `HomePage` 保持可用，但显式发送三个 `null` override，确保所有项目创建路径都符合新合同。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 补齐类型合同扩散到旧创建入口与 Project fixture**
- **Found during:** Task 3（在项目页展示并编辑 provider proof card）
- **Issue:** 将前端 `Project` 与 create payload 切到显式 provider 合同后，`HomePage` 仍在发送旧 create payload，`workspaceStatus.test.ts` 的 `Project` fixture 也缺失新字段，导致 `pnpm --dir frontend exec tsc --noEmit` 无法通过。
- **Fix:** 给 `HomePage` 默认补齐三个 `null` override，并为 `workspaceStatus` 的基础项目 fixture 增加 `provider_settings` 与 override 字段。
- **Files modified:** `frontend/app/pages/HomePage.tsx`, `frontend/app/utils/workspaceStatus.test.ts`
- **Verification:** `pnpm --dir frontend exec vitest run app/pages/NewProjectPage.test.tsx app/pages/ProjectPage.test.tsx && pnpm --dir frontend exec tsc --noEmit`
- **Committed in:** `89b5d3a`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** 仅修正了本次 provider 合同引起的直接阻塞，保证创建入口和类型校验与新 UI 一致，没有额外扩 scope。

## Issues Encountered
- `ProviderSelectionFields` 让多个 modality 复用了相同文本标签，测试初版用全局 `getByRole` 会出现多匹配；后续把断言收窄到对应 fieldset，保证测试锁定的是具体 modality 行为。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 08 可以直接消费前端已持久化的项目级 provider 选择，在启动前做 deterministic validation 和无 silent fallback 的阻断提示。
- 创作者侧 proof surface 已具备，后续只需要把运行前校验和实际执行证据继续接到当前项目页语义上。

## Self-Check: PASSED
- Verified `.planning/phases/07-project-provider-contracts/07-02-SUMMARY.md` exists.
- Verified task commits `963acf3`, `84cb16b`, and `89b5d3a` exist in git history.

---
*Phase: 07-project-provider-contracts*
*Completed: 2026-04-17*

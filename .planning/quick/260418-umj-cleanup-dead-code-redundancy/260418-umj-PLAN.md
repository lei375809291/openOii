---
mode: quick-full
plan_id: 260418-umj
title: 清理已脱离主链路的死代码与零引用冗余前端辅助层
autonomous: true
files_modified:
  - backend/app/agents/character.py
  - backend/app/agents/storyboard.py
  - backend/app/agents/prompts/character.py
  - backend/app/agents/prompts/storyboard.py
  - backend/app/agents/prompts/__init__.py
  - backend/app/services/project_service.py
  - frontend/app/components/ui/LazyImage.tsx
  - frontend/app/hooks/useIntersectionObserver.ts
  - frontend/app/components/ui/WorkflowStepper.tsx
  - frontend/app/components/ui/SimulatedProgress.tsx
  - frontend/app/components/ui/EmptyState.tsx
  - frontend/app/utils/debounce.ts
  - frontend/app/utils/memoize.ts
must_haves:
  truths:
    - 当前实际生成链路只保留仍被主流程使用的 backend agent / prompt / service 模块，不再同时保留零引用的旧版 CharacterAgent、StoryboardAgent 与 ProjectService 残留实现。
    - frontend/app 下已确认零引用的 UI/helper 层会被彻底删除，而不是继续以“以后可能会用到”的名义留在仓库里。
    - 清理后仓库仍能通过针对主链路的后端测试、前端测试与前端类型检查，证明这次是减重而不是破坏功能。
    - 本 quick task 只处理“已确认零引用的源代码冗余”，不混入 `.env.local`、`.coverage`、`__pycache__` 这类本地/运行时产物治理。
  artifacts:
    - path: backend/app/agents/prompts/__init__.py
      provides: prompt 导出面与存活模块对齐
    - path: backend/app/agents/character.py
      provides: 旧 CharacterAgent 删除
    - path: backend/app/agents/storyboard.py
      provides: 旧 StoryboardAgent 删除
    - path: backend/app/services/project_service.py
      provides: 未接入路由/工作流的旧 ProjectService 删除
    - path: frontend/app/components/ui/LazyImage.tsx
      provides: 零引用懒加载图片组件删除
    - path: frontend/app/hooks/useIntersectionObserver.ts
      provides: 仅被 LazyImage 使用的 hook 删除
    - path: frontend/app/components/ui/WorkflowStepper.tsx
      provides: 零引用工作流步进器删除
    - path: frontend/app/components/ui/SimulatedProgress.tsx
      provides: 零引用模拟进度条删除
    - path: frontend/app/components/ui/EmptyState.tsx
      provides: 零引用空状态组件删除
    - path: frontend/app/utils/debounce.ts
      provides: 零引用 debounce/throttle 工具删除
    - path: frontend/app/utils/memoize.ts
      provides: 零引用 memoize 工具删除
  key_links:
    - from: backend/app/agents/orchestrator.py
      to: backend/tests/test_agents/test_character_artist.py
      via: 当前角色生成链路只走 CharacterArtistAgent
    - from: backend/app/api/v1/routes/shots.py
      to: backend/tests/test_agents/test_storyboard_artist.py
      via: 当前分镜生成链路只走 StoryboardArtistAgent
    - from: frontend/app/pages/ProjectPage.tsx
      to: frontend/app/components/canvas/ProjectOverview.test.tsx
      via: 主界面仍靠现有 canvas/workspace 组件运行，不依赖待删零引用 UI helper
---

<objective>
删除仓库里已确认脱离主链路、且当前没有任何有效引用的后端旧模块与前端辅助组件/工具，收缩维护面。

Purpose: 让仓库代码面与实际 shipped workflow 对齐，减少误导性入口、重复实现和“看起来可用但其实无人使用”的维护噪音。
Output: 一次仅针对零引用源代码的清理提交面，覆盖 backend 旧 agent/service/prompt 残留与 frontend 零引用 helper 层。
</objective>

<context>
@.planning/STATE.md
@backend/app/agents/orchestrator.py
@backend/app/api/v1/routes/characters.py
@backend/app/api/v1/routes/shots.py
@backend/app/agents/character.py
@backend/app/agents/storyboard.py
@backend/app/agents/prompts/__init__.py
@backend/app/services/project_service.py
@frontend/app/pages/ProjectPage.tsx
@frontend/app/components/canvas/ProjectOverview.tsx
@frontend/app/components/ui/LazyImage.tsx
@frontend/app/components/ui/WorkflowStepper.tsx
@frontend/app/components/ui/SimulatedProgress.tsx
@frontend/app/components/ui/EmptyState.tsx
@frontend/app/hooks/useIntersectionObserver.ts
@frontend/app/utils/debounce.ts
@frontend/app/utils/memoize.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: 删除 backend 已脱离主流程的旧 agent / prompt / service 残留</name>
  <files>backend/app/agents/character.py, backend/app/agents/storyboard.py, backend/app/agents/prompts/character.py, backend/app/agents/prompts/storyboard.py, backend/app/agents/prompts/__init__.py, backend/app/services/project_service.py</files>
  <action>基于当前引用面收缩 backend 残留实现：删除仅剩自引用/零引用的 `CharacterAgent`、`StoryboardAgent`、其对应 prompt 文件，以及未被任何路由/工作流使用的 `ProjectService`。同步更新 `backend/app/agents/prompts/__init__.py`，让导出面只保留仍真实存在且仍被使用的 prompt 常量。不要碰 `CharacterArtistAgent`、`StoryboardArtistAgent`、`ReviewAgent`、provider portability 相关实现；这次不是重构生成链路，只是去掉已被现有链路替代的旧入口。</action>
  <verify>
    <automated>uv run --project backend pytest backend/tests/test_agents/test_character_artist.py backend/tests/test_agents/test_storyboard_artist.py backend/tests/test_api/test_projects.py -q && ! rg -n "CharacterAgent|StoryboardAgent|ProjectService|CHARACTER_SYSTEM_PROMPT|STORYBOARD_SYSTEM_PROMPT" backend/app backend/tests</automated>
  </verify>
  <done>backend 不再保留零引用旧 agent/service/prompt 模块，prompt 导出面与存活实现一致，且现有角色/分镜主链路回归仍通过。</done>
</task>

<task type="auto">
  <name>Task 2: 删除 frontend 零引用 UI helper 与通用工具文件</name>
  <files>frontend/app/components/ui/LazyImage.tsx, frontend/app/hooks/useIntersectionObserver.ts, frontend/app/components/ui/WorkflowStepper.tsx, frontend/app/components/ui/SimulatedProgress.tsx, frontend/app/components/ui/EmptyState.tsx, frontend/app/utils/debounce.ts, frontend/app/utils/memoize.ts</files>
  <action>删除当前 `frontend/app` 内已确认零引用的 helper 层：`LazyImage` 与其唯一依赖 `useIntersectionObserver`，以及未接入任何页面/组件的 `WorkflowStepper`、`SimulatedProgress`、`EmptyState`、`debounce`、`memoize`。先复核引用面，确保没有 barrel/export、懒加载入口或测试夹带使用；确认仍是零引用后直接删除，不保留占位文件。不要顺手清理仍有引用的 `TypewriterText`、`LoadingOverlay`、`ErrorBoundary` 等有效组件，也不要把任务扩展成 UI 重构。</action>
  <verify>
    <automated>pnpm --dir frontend exec tsc --noEmit && pnpm --dir frontend exec vitest run app/pages/ProjectPage.test.tsx app/components/canvas/ProjectOverview.test.tsx app/components/chat/ChatPanel.test.tsx && ! rg -n "LazyImage|useIntersectionObserver|WorkflowStepper|SimulatedProgress|EmptyState|memoizeWithTTL|memoize\(|debounce\(|throttle\(" frontend/app</automated>
  </verify>
  <done>frontend 零引用 helper 文件全部删除，主页面/画布/聊天相关回归与类型检查仍通过，且剩余代码里不再存在这些废弃符号引用。</done>
</task>

</tasks>

<verification>
- 先完成 backend 清理并跑 targeted pytest，确认实际生成链路未误删。
- 再完成 frontend 清理并跑 `tsc --noEmit` + targeted vitest，确认删除的是零引用层而非隐式依赖。
- 两侧都用 `rg` 做残留符号扫描，确保没有“文件删了但名字还散落在仓库里”的半清理状态。
</verification>

<success_criteria>
- backend 旧 Character/Storyboard 路线与未使用 ProjectService 从仓库中移除，且现有 CharacterArtist/StoryboardArtist 主链路测试仍为绿色。
- frontend 已确认零引用的 helper 组件与工具文件从仓库中移除，且主页面/画布/聊天测试与类型检查仍为绿色。
- 本 quick task 结果聚焦源代码死代码与冗余，不混入本地环境文件、coverage 产物或其他非源码清理动作。
</success_criteria>

<output>
完成后直接产出清理后的代码状态；不额外生成审计文档。
</output>

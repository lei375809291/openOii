---
phase: 07-project-provider-contracts
reviewed: 2026-04-17T17:09:25Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - frontend/app/pages/ProjectPage.tsx
  - frontend/app/pages/ProjectPage.test.tsx
  - frontend/app/types/index.ts
  - frontend/app/utils/workspaceStatus.test.ts
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-04-17T17:09:25Z  
**Depth:** standard  
**Files Reviewed:** 4  
**Status:** issues_found

## Summary

本次按 Phase 07-03 的落点复查了项目页 provider hydration、对应前端读模型，以及两组回归测试。

结论：本轮修复已经把读模型与真实 `ProjectRead` 合同对齐，目标测试也能通过；但仍有一处真实交互问题——保存 provider 后，本地草稿会先被旧 query 数据回写，用户在 refetch 完成前重新进入编辑态时，仍可能看到旧值。另有一处测试覆盖缺口：当前 `useMutation` mock 不会执行生命周期回调，导致“保存后状态不被破坏”的断言实际上没有覆盖真实成功路径。

已执行验证：`pnpm vitest run app/pages/ProjectPage.test.tsx app/utils/workspaceStatus.test.ts`（通过）。

## Warnings

### WR-01: 保存成功后会先用旧 project 数据回填草稿，快速重进编辑态可见旧值

**File:** `frontend/app/pages/ProjectPage.tsx:135-143`, `frontend/app/pages/ProjectPage.tsx:333-341`

**Issue:**
`updateProvidersMutation.onSuccess` 里先 `setIsEditingProviders(false)`，再仅做 `invalidateQueries()`。由于 React Query 的 refetch 是异步的，这一瞬间组件里的 `project` 仍是旧数据；而 `useEffect` 在 `isEditingProviders` 变回 `false` 时会立刻执行，把 `providerDraft` 重置为旧的 `provider_settings`。如果用户在 refetch 完成前立刻再次点“编辑 Provider”，表单会短暂回到旧选择，造成“刚保存又像没保存”的错觉。

**Fix:**
优先用 mutation 返回值同步本地缓存和草稿，再做失效刷新。例如：

```tsx
const updateProvidersMutation = useMutation({
  mutationFn: (payload: ProjectProviderOverridesPayload) =>
    projectsApi.update(projectId, payload),
  onSuccess: (updatedProject) => {
    queryClient.setQueryData(["project", projectId], updatedProject);
    setProviderDraft(deriveProviderOverridesFromProject(updatedProject));
    setIsEditingProviders(false);
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  },
});
```

## Info

### IN-01: ProjectPage 测试没有执行 mutation 生命周期，真实保存成功路径未被覆盖

**File:** `frontend/app/pages/ProjectPage.test.tsx:90-119`, `frontend/app/pages/ProjectPage.test.tsx:236-264`

**Issue:**
测试把 `useMutation` 统一 mock 成只暴露 `mutate: mutateSpy`，不会调用组件里传入的 `onSuccess` / `onError`。因此最后一条用例虽然名字写的是“保存 provider overrides without resetting recovery and live progress state”，实际只验证了提交 payload，完全没有覆盖真实保存成功后的状态变化，也捕不到上面的回写竞态问题。

**Fix:**
让 `useMutation` mock 至少在 `mutate` 时触发传入的 `onSuccess`，或直接 mock `projectsApi.update` + 使用更接近真实行为的 React Query 测试包装。最少补一条断言：点击保存后立即再次进入编辑态，应看到新保存的 provider 选项。

---

_Reviewed: 2026-04-17T17:09:25Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: standard_

---
phase: 02-langgraph-orchestration-durable-execution
reviewed: 2026-04-11T10:25:09Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - backend/app/agents/orchestrator.py
  - backend/app/api/v1/routes/generation.py
  - backend/app/services/run_recovery.py
  - backend/app/schemas/project.py
  - backend/app/schemas/ws.py
  - backend/app/ws/manager.py
  - frontend/app/hooks/useWebSocket.ts
  - frontend/app/pages/ProjectPage.tsx
  - frontend/app/services/api.ts
  - frontend/app/stores/editorStore.ts
  - frontend/app/types/index.ts
findings:
  critical: 0
  warning: 4
  info: 0
  total: 4
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-11T10:25:09Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

本轮复查覆盖了 Phase 02 的编排、恢复、WebSocket 和前端恢复 UI 变更。未发现关键安全问题，但有 1 个会卡死后续创作流程的高优先级逻辑问题，以及 3 个会误清状态或泄漏旧连接的前端恢复问题。

## Critical Issues

（无）

## Warnings

### WR-01: 历史失败/取消运行会永久阻塞新的生成

**File:** `backend/app/api/v1/routes/generation.py:83-94`
**Issue:** 这里直接查询“最近的 failed/cancelled run”并返回 409，但没有先看是否已经有更晚的新 run。只要项目历史上存在一个失败/取消运行，后续即使已经有成功运行，`/generate` 仍可能一直被旧记录挡住。
**Fix:** 只基于“最新的整体 run”决定是否进入恢复分支；如果最新 run 不是 active/recoverable，就允许重新生成，或增加单独的 dismiss/start-over 状态。

```python
latest = await _latest_run_for_project(
    session,
    project_id,
    ("queued", "running", "succeeded", "failed", "cancelled"),
)

if latest and latest.status in ("queued", "running"):
    ...
elif latest and latest.status in ("failed", "cancelled"):
    ...
```

### WR-02: 点击“生成”前过早清空消息，409 时会丢失当前对话历史

**File:** `frontend/app/pages/ProjectPage.tsx:280-284`
**Issue:** `handleGenerate()` 先 `clearMessages()` 再发请求。如果后端返回 409（已有 active/recoverable run）或网络失败，旧消息不会恢复，用户会看到一个空聊天窗口。
**Fix:** 只在后端确认真正开始新 run 后再清空消息，或在失败分支恢复上一次消息快照。

```ts
const handleGenerate = () => {
  generateMutation.mutate();
};

// 在 onSuccess / run_started 里再清空旧消息
```

### WR-03: 取消请求失败时也会把恢复态清空

**File:** `frontend/app/pages/ProjectPage.tsx:223-241`
**Issue:** `onSettled` 会在成功和失败时都执行。这样即使取消接口失败或返回 `no_active_run`，前端也会把 recovery banner、summary 和 run 状态一起清掉，并显示“生成已停止”。
**Fix:** 把状态重置移到 `onSuccess`，失败时保留恢复态并提示错误；如果“取消”其实是“放弃恢复”，应让后端返回明确的 dismiss 结果。

```ts
onSuccess: () => {
  store.setGenerating(false);
  store.setRecoveryControl(null);
  ...
},
onError: () => {
  toast.error(...);
}
```

### WR-04: WebSocket 在卸载/切页时没有真正断开，旧项目事件可能继续写入当前 store

**File:** `frontend/app/hooks/useWebSocket.ts:157-166`
**Issue:** effect cleanup 只清了定时器，没有关闭 `globalConnections` 里的 socket。切换项目后，旧连接仍可能保留事件处理器，继续把旧项目的消息写进当前页面状态。
**Fix:** 在 cleanup 中断开并移除当前项目的 socket；如果要兼容 StrictMode，就加引用计数，而不是永远不关闭。

```ts
return () => {
  clearReconnectTimer();
  disconnect();
};
```

---

_Reviewed: 2026-04-11T10:25:09Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_

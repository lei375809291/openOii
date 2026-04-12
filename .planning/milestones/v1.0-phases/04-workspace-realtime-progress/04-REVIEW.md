---
phase: 04-workspace-realtime-progress
reviewed: 2026-04-11T13:23:31Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - /home/xeron/Coding/openOii/AGENTS.md
  - /home/xeron/Coding/openOii/.planning/phases/04-workspace-realtime-progress/04-01-SUMMARY.md
  - /home/xeron/Coding/openOii/.planning/phases/04-workspace-realtime-progress/04-02-SUMMARY.md
  - /home/xeron/Coding/openOii/.planning/phases/04-workspace-realtime-progress/04-03-SUMMARY.md
  - /home/xeron/Coding/openOii/.planning/phases/04-workspace-realtime-progress/04-04-SUMMARY.md
  - /home/xeron/Coding/openOii/frontend/app/utils/workspaceStatus.ts
  - /home/xeron/Coding/openOii/frontend/app/hooks/useCanvasLayout.ts
  - /home/xeron/Coding/openOii/frontend/app/components/canvas/InfiniteCanvas.tsx
  - /home/xeron/Coding/openOii/frontend/app/hooks/useWebSocket.ts
  - /home/xeron/Coding/openOii/frontend/app/pages/ProjectPage.tsx
  - /home/xeron/Coding/openOii/frontend/app/types/index.ts
  - /home/xeron/Coding/openOii/frontend/app/stores/editorStore.ts
  - /home/xeron/Coding/openOii/frontend/app/components/canvas/shapes/ScriptSectionShape.tsx
  - /home/xeron/Coding/openOii/frontend/app/components/canvas/shapes/CharacterSectionShape.tsx
  - /home/xeron/Coding/openOii/frontend/app/components/canvas/shapes/StoryboardSectionShape.tsx
  - /home/xeron/Coding/openOii/frontend/app/components/canvas/shapes/VideoSectionShape.tsx
  - /home/xeron/Coding/openOii/frontend/app/hooks/useWebSocket.test.ts
  - /home/xeron/Coding/openOii/frontend/app/pages/ProjectPage.test.tsx
  - /home/xeron/Coding/openOii/frontend/app/components/canvas/InfiniteCanvas.test.tsx
  - /home/xeron/Coding/openOii/frontend/app/components/canvas/VideoSectionShape.test.tsx
  - /home/xeron/Coding/openOii/backend/app/schemas/ws.py
  - /home/xeron/Coding/openOii/backend/app/ws/manager.py
  - /home/xeron/Coding/openOii/backend/app/orchestration/nodes.py
  - /home/xeron/Coding/openOii/backend/tests/test_api/test_websocket.py
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-04-11T13:23:31Z
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Phase 04 is mostly solid, but there are a few correctness gaps in live progress hydration and project-switch state reset. The new websocket/project refresh flow works in the happy path, yet several edge cases can leave the UI stale or out of sync.

## Warnings

### WR-01: Websocket stage hydration drops actual backend stages

**File:** `frontend/app/hooks/useWebSocket.ts:194-201`
**Issue:** `resolveEventStage()` only accepts `ideate | visualize | animate | deploy`, but the backend emits finer-grained stages like `script`, `character`, `storyboard`, `clip`, and `merge` (`backend/app/orchestration/nodes.py`). Most progress events therefore resolve to `undefined`, so the UI never advances for the real backend stages.
**Fix:** Normalize backend stage names into the frontend buckets before calling `setCurrentStage()`.
```ts
const stageMap: Record<string, WorkflowStage> = {
  ideate: "ideate",
  script: "visualize",
  character: "visualize",
  storyboard: "animate",
  clip: "animate",
  merge: "deploy",
};

return stageMap[data.stage ?? data.current_stage];
```

### WR-02: Project switch reset never runs after route changes

**File:** `frontend/app/pages/ProjectPage.tsx:105-133, 334-342`
**Issue:** The "clear state on project change" effect depends only on `store`, so it runs once on mount instead of when `projectId` changes. Stale messages, recovery state, and `currentRunId` leak into the next project, and the refresh flag can also carry over.
**Fix:** Depend on `projectId`, and clear the refresh marker in the reset block.
```ts
useEffect(() => {
  ...
  store.setProjectUpdatedAt(null);
}, [projectId, store]);
```

### WR-03: `project_updated` with `video_url: null` leaves stale video in the shell

**File:** `frontend/app/hooks/useWebSocket.ts:432-441`
**Issue:** The handler only calls `setProjectVideoUrl()` when `video_url` is truthy. Backend `project_updated` events can carry `video_url: null` when the final video is cleared or rebuilt, so the old video stays visible until a later refetch.
**Fix:** Clear the cached URL when the payload explicitly includes `video_url`.
```ts
if (projectData && "video_url" in projectData) {
  store.setProjectVideoUrl(projectData.video_url ?? null);
}
```

## Info

### IN-01: Reconnect success toast is unreachable

**File:** `frontend/app/hooks/useWebSocket.ts:52-64`
**Issue:** `reconnectAttempts.current` is reset to 0 before the `> 0` check, so the "重新连接成功" toast never appears.
**Fix:** Cache the previous value before resetting, or check before zeroing.

### IN-02: Video download fallback can save error pages as `.mp4`

**File:** `frontend/app/components/canvas/shapes/VideoSectionShape.tsx:78-95`
**Issue:** `fetch(videoUrl)` does not verify `response.ok`. A 404/500 response will still be blobbed and downloaded as if it were a valid video.
**Fix:** Throw on non-2xx responses before creating the blob, then fall back to `window.open()`.

---

_Reviewed: 2026-04-11T13:23:31Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_

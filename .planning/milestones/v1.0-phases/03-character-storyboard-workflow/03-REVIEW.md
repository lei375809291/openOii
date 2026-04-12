---
phase: 03-character-storyboard-workflow
reviewed: 2026-04-11T11:49:07Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - backend/app/models/project.py
  - backend/app/schemas/project.py
  - backend/app/schemas/ws.py
  - backend/app/api/v1/routes/characters.py
  - backend/app/api/v1/routes/shots.py
  - backend/app/services/approval_gate.py
  - backend/app/services/shot_binding.py
  - backend/app/orchestration/nodes.py
  - backend/app/agents/storyboard_artist.py
  - backend/app/agents/video_generator.py
  - backend/alembic/versions/0002_phase3_approval_workflow.py
  - frontend/app/types/index.ts
  - frontend/app/services/api.ts
  - frontend/app/stores/editorStore.ts
  - frontend/app/hooks/useWebSocket.ts
  - frontend/app/components/canvas/canvasEvents.ts
  - frontend/app/components/canvas/shapes/types.ts
  - frontend/app/components/canvas/shapes/CharacterSectionShape.tsx
  - frontend/app/components/canvas/shapes/StoryboardSectionShape.tsx
  - frontend/app/components/canvas/InfiniteCanvas.tsx
findings:
  critical: 0
  warning: 4
  info: 0
  total: 4
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-11T11:49:07Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

本轮主要检查了角色/分镜审批模型、审批路由、WebSocket 载荷、故事板门禁，以及前端 review-state 与画布审批 UI。整体实现方向一致，但有 4 个会影响可用性或正确性的点。

## Warnings

### WR-01: 剪辑门禁按整个项目而不是当前 run 判定

**File:** `backend/app/services/approval_gate.py:10-21`
**Issue:** `can_enter_clip_generation()` 直接扫描项目下所有 `Shot`，只要任一镜头未批准就阻止进入 clip 阶段。这个逻辑会把同一项目里与当前 run 无关的草稿镜头也算进去，导致视频生成被意外卡死。
**Fix:** 只检查当前 run 需要的 storyboard shot 集合（例如 run 关联的 shot ids / target_ids），不要用整项目作为门禁范围。

### WR-02: 分镜批准前没有重新校验当前绑定角色是否仍有效

**File:** `backend/app/api/v1/routes/shots.py:253-274`
**Issue:** `approve_shot()` 只检查结构化字段是否齐全，然后直接 freeze。若镜头更新后绑定角色被删除或换出，仍然可以批准并冻结一份失效 cast。
**Fix:** 在 `freeze_approval()` 前再次调用角色 ID 校验，确保当前 `character_ids` 仍属于该 project。
```py
await _validate_shot_character_ids(session, shot.project_id, shot.character_ids)
shot.freeze_approval()
```

### WR-03: 画布分镜编辑器没有暴露审批门禁所需的结构化字段

**File:** `frontend/app/components/canvas/InfiniteCanvas.tsx:482-509`
**Issue:** 当前分镜编辑弹窗只允许改 `description` / `prompt` / `image_prompt`，但后端批准分镜要求 `duration`、`camera`、`motion_note`、`character_ids` 都已补全。结果是很多镜头在 UI 上无法被修到可批准状态。
**Fix:** 给分镜编辑弹窗补齐这些字段，或单独提供一个 storyboard metadata editor。
```ts
fields={[
  { name: "description", label: "分镜描述", type: "textarea" },
  { name: "prompt", label: "视频提示词", type: "textarea" },
  { name: "image_prompt", label: "图片提示词", type: "textarea" },
  { name: "duration", label: "时长", type: "number" },
  { name: "camera", label: "镜头", type: "text" },
  { name: "motion_note", label: "动作", type: "textarea" },
]}
```

### WR-04: 分镜卡片会把未填写时长渲染成 `null 秒`

**File:** `frontend/app/components/canvas/shapes/StoryboardSectionShape.tsx:113-116`
**Issue:** `shot.duration` 为空时，当前模板字符串会直接显示 `null 秒`，这会让草稿镜头的结构化意图看起来像坏数据。
**Fix:** 对空值做显式兜底。
```ts
{ label: "时长", value: shot.duration != null ? `${shot.duration} 秒` : "未填写" }
```

---

_Reviewed: 2026-04-11T11:49:07Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_

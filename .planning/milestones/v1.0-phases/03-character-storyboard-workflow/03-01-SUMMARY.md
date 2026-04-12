---
phase: 03-character-storyboard-workflow
plan: 01
type: execute
status: completed
subsystem: backend review contract
tags: [fastapi, sqlmodel, alembic, websocket, approvals]
depends_on: []
requires: [CHAR-01, SHOT-01]
provides:
  - approval-aware character and shot models
  - shot character binding table
  - approval endpoints and websocket snapshot payloads
key-files:
  - backend/app/models/project.py
  - backend/app/schemas/project.py
  - backend/app/schemas/ws.py
  - backend/app/ws/manager.py
  - backend/app/api/v1/routes/characters.py
  - backend/app/api/v1/routes/shots.py
  - backend/alembic/versions/0002_phase3_approval_workflow.py
  - backend/tests/test_api/test_character_storyboard_review.py
commits:
  - 4e4bf2b
  - 61aaf2d
  - 489bbce
metrics:
  completed_date: 2026-04-11
  duration: "~1 session"
---

# Phase 03 Plan 01: Character Storyboard Review Summary

对字符与分镜评审合同做了后端落地：角色可编辑并冻结批准快照，分镜可绑定角色并冻结结构化意图，WebSocket 只广播当前审批状态。

## Completed Work

1. 写入了先失败的契约测试，覆盖角色/分镜审批冻结、分镜审批门禁、WebSocket 当前态输出。
2. 扩展模型与 schema：角色/分镜审批快照字段、审批版本、分镜绑定角色 IDs、分镜 camera/motion_note。
3. 新增审批 API 与 websocket 事件载荷，保持事件名不变但输出当前 approved/superseded 状态。
4. 加入 Alembic 迁移，创建审批字段与 shot-character binding 表。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] 测试环境缺少 pytest_asyncio**
- **Found during:** Task 1
- **Issue:** `uv run pytest` 无法加载 `pytest_asyncio`
- **Fix:** 运行 `uv sync --group dev` 恢复后端测试依赖
- **Files modified:** 无
- **Commit:** 无

**2. [Rule 2 - Missing critical functionality] 分镜审批需要显式结构化门禁**
- **Found during:** Task 3
- **Issue:** 分镜审批必须拒绝未补全的 structured intent / duration / camera / motion note / bound cast
- **Fix:** 在 `POST /shots/{id}/approve` 中加入服务端校验并返回 400
- **Files modified:** `backend/app/api/v1/routes/shots.py`
- **Commit:** 489bbce

**3. [Post-execution verification] SQLModel typing cleanup for Phase 3 review contract**
- **Found during:** Phase 03 aggregate static verification
- **Issue:** `project.py` / `characters.py` / `shots.py` introduced basedpyright errors around `UTC`, `__tablename__`, SQLModel query expressions, and optional `run.id` propagation.
- **Fix:** Switched to type-safe datetime/table declarations, explicit persisted `run_id` binding, and typed SQLAlchemy attribute usage without changing runtime behavior.
- **Files modified:** `backend/app/models/project.py`, `backend/app/api/v1/routes/characters.py`, `backend/app/api/v1/routes/shots.py`
- **Commit:** pending phase-level follow-up commit

## Verification

- `uv run pytest tests/test_api/test_character_storyboard_review.py -q`
- `uv run ruff check app/api/v1/routes/characters.py app/api/v1/routes/shots.py app/schemas/ws.py app/ws/manager.py`

## Commit Map

| Task | Commit | Result |
|------|--------|--------|
| 1 | 4e4bf2b | 契约测试冻结 |
| 2 | 61aaf2d | 审批模型与迁移落地 |
| 3 | 489bbce | API / WS 审批输出落地 |

## Self-Check

PASSED — summary file exists and all three task commits are present in git history.

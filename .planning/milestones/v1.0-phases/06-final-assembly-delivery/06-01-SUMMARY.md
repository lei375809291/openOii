---
phase: 06-final-assembly-delivery
plan: 01
subsystem: api
tags: [fastapi, pytest, file-response, video, review-flow, final-assembly]

# Dependency graph
requires:
  - phase: 05-review-creative-control
    provides: review/recovery semantics and downstream rerun invalidation behavior
  - phase: 02-langgraph-orchestration-durable-execution
    provides: durable run/thread recovery boundaries for retry flows
provides:
  - Preserve stale final-video state while downstream clips rerun
  - Block final merge until every required current clip is successful
  - Serve a safe, controlled final-video download route
affects: [review flow, merge gate, project delivery, final asset download, websocket progress]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - canonical final asset pointer preserved across reruns
    - merge eligibility gated by blocking-clip inspection
    - safe server-side FileResponse download resolution

key-files:
  created:
    - .planning/phases/06-final-assembly-delivery/06-01-SUMMARY.md
  modified:
    - backend/app/services/creative_control.py
    - backend/app/services/approval_gate.py
    - backend/app/orchestration/nodes.py
    - backend/app/agents/review.py
    - backend/app/agents/prompts/review.py
    - backend/app/agents/orchestrator.py
    - backend/app/agents/video_merger.py
    - backend/app/api/v1/routes/characters.py
    - backend/app/api/v1/routes/shots.py
    - backend/app/api/v1/routes/projects.py
    - backend/tests/test_api/test_review_creative_control.py
    - backend/tests/test_api/test_projects.py

key-decisions:
  - "保留 project.video_url 作为唯一最终资产指针，rerun 时不再清空。"
  - "最终合并只在所有当前必需 clip 成功时启动，并返回 blocking clips 供前端解释。"
  - "最终视频通过服务器侧受控路由下载，路径解析仍走现有安全 helper。"

patterns-established:
  - "Pattern 1: stale final stays visible but project.status flips to superseded until replacement merge succeeds"
  - "Pattern 2: retry-merge text continues through existing review/run recovery boundary instead of creating a second delivery flow"

requirements-completed: [PIPE-03, DELIV-02]

# Metrics
duration: 17min
completed: 2026-04-11
---

# Phase 06: Final Assembly & Delivery Summary

**最终合并现在会被当前 clip 状态严格拦住，旧 final 会在重跑期间继续可见，并且可通过受控产品路由安全下载。**

## Performance

- **Duration:** 17min
- **Started:** 2026-04-11T16:18:00Z
- **Completed:** 2026-04-11T16:34:36Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- 给 final merge 加了阻塞判断：任何 required clip 处于 failed/generating/missing 都会阻止拼接。
- downstream rerun 不再清空最终视频指针，旧 final 会保持可见并标记为 superseded。
- 增加了受控的 `/api/v1/projects/{project_id}/final-video` 下载路由，走安全本地路径解析。
- 将 retry-merge 反馈继续路由回现有 review/run recovery 边界，而不是分裂出第二条交付流。

## Task Commits

Each task was committed atomically:

1. **Task 1: Write backend merge-gate and delivery regressions** - `bdd75ce` (test)
2. **Task 2: Implement merge gating, stale retention, and controlled download delivery** - `8e665f5` (fix)
3. **Task 3: Create phase summary** - pending

## Files Created/Modified

- `backend/app/services/creative_control.py` - 收集 blocking clips 并输出给项目更新事件
- `backend/app/services/approval_gate.py` - 合并前置门禁，阻止不完整 final merge
- `backend/app/orchestration/nodes.py` - merge node gating
- `backend/app/agents/review.py` / `backend/app/agents/prompts/review.py` - retry-merge 语义路由
- `backend/app/agents/orchestrator.py` - rerun cleanup 不再清理 final video
- `backend/app/agents/video_merger.py` - merge 成功后恢复 canonical final state
- `backend/app/api/v1/routes/characters.py` / `backend/app/api/v1/routes/shots.py` - rerun 后继续广播 project 状态与 blocking 信息
- `backend/app/api/v1/routes/projects.py` - 增加 final-video 下载路由
- `backend/tests/test_api/test_review_creative_control.py` - stale-final 回归测试
- `backend/tests/test_api/test_projects.py` - 下载路由覆盖

## Decisions Made

- 继续把 `project.video_url` 当作唯一 final asset pointer，而不是为 rerun 再引入第二个输出字段。
- final-video 下载只允许服务器从项目记录推导出的安全本地路径，避免客户端路径注入。
- retry-merge 复用现有 review/run/thread 恢复边界，保持交付流单一。

## Deviations from Plan

None - plan executed as written.

## Post-Execution Fixes

- Aggregate static verification surfaced basedpyright errors in `backend/app/agents/video_merger.py` and `backend/app/api/v1/routes/projects.py` around SQLModel query expressions, `UTC`, and optional project IDs.
- Fixed them with type-safe SQLAlchemy attribute bindings, `timezone.utc`, and explicit persisted project-id narrowing only; runtime behavior and delivery semantics stayed unchanged.
- Post-completion code review also surfaced delivery-semantics issues in `backend/app/agents/review.py` and `backend/app/agents/video_merger.py`; fixed by aligning retry-merge keywords with the user-facing CTA and preventing blocked first-time merges from being mislabeled as stale finals.
- A second review pass surfaced a merge-node short-circuit mismatch with the stale-final contract; fixed by routing merge blocking through `VideoMergerAgent` so blocked/current/stale semantics persist through the canonical backend path.

## Issues Encountered

- `pytest_asyncio` 在仓库根目录的运行环境里未被解析；切到 `backend/` 目录并同步 dev 依赖后，目标测试恢复为绿色。
- 单测里对 `get_local_path` 的 monkeypatch 需要打到 route 模块导入点，已调整覆盖。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- final assembly/delivery contract 已锁定，可继续接 UI 展示或更高层的导出体验。
- 如果后续要支持云存储下载，再把同一路由扩展到对象存储签名 URL 即可。

---
*Phase: 06-final-assembly-delivery*
*Completed: 2026-04-11*

## Self-Check: PASSED

- Summary file exists.
- Task commits `bdd75ce` and `8e665f5` exist in git history.

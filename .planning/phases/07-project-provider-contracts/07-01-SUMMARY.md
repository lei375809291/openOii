---
phase: 07-project-provider-contracts
plan: 01
subsystem: api
tags: [projects, providers, fastapi, sqlmodel, alembic]
requires: []
provides:
  - project-level text/image/video provider override persistence
  - project CRUD provider_settings contract with override/effective/source fields
  - alembic migration for project provider override columns
affects: [Phase 07, Phase 08, provider-resolution, runtime-snapshots]
tech-stack:
  added: [alembic migration 0003_phase7_project_provider_contracts]
  patterns: [project CRUD response builder for provider source visibility, modality-scoped provider key validation]
key-files:
  created: [backend/alembic/versions/0003_phase7_project_provider_contracts.py]
  modified:
    - backend/app/models/project.py
    - backend/app/schemas/project.py
    - backend/app/api/v1/routes/projects.py
    - backend/tests/factories.py
    - backend/tests/test_api/test_projects.py
    - backend/tests/test_migrations.py
key-decisions:
  - "把 provider override 限定在当前已支持 key，防止任意字符串写入项目表。"
  - "ProjectRead 通过 provider_settings 显式返回 override_key、effective_key、source，而不是让前端自行推断。"
patterns-established:
  - "Project provider contract: text/image/video 都返回统一的 ProjectProviderEntry 结构。"
  - "Project CRUD serialization uses a dedicated builder so default inheritance stays explicit and stable."
requirements-completed: [PROV-01, PROV-02, PROV-03]
duration: 1 min
completed: 2026-04-17
---

# Phase 07 Plan 01: Project Provider Contracts Summary

**项目级 text/image/video provider override 已可持久化，并通过统一 provider_settings 合同回显 override、effective provider 与来源。**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-18T00:13:16+08:00
- **Completed:** 2026-04-17T16:14:33Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- 为 `Project` 增加 text / image / video provider override 持久化字段与 Alembic 迁移。
- 为项目 CRUD 建立 `provider_settings` 返回合同，明确区分项目覆盖与默认继承。
- 用 API 回归测试和 migration 测试锁定 save/reload/source 行为与 schema 预期。

## Task Commits

Each task was committed atomically:

1. **Task 1: 锁定项目 provider CRUD 与迁移回归测试** - `8947ac5` (test)
2. **Task 2: 实现 Project provider 合同、序列化与数据库迁移** - `1d22542` (feat)

**Plan metadata:** 未提交（按本次执行要求跳过 STATE/ROADMAP/REQUIREMENTS 更新）

## Files Created/Modified
- `backend/app/models/project.py` - 给项目模型增加三个 provider override 持久化字段。
- `backend/app/schemas/project.py` - 定义 provider 输入限制、默认 provider 常量与 `provider_settings` 读模型。
- `backend/app/api/v1/routes/projects.py` - 在 create/get/list/update 响应中统一构造 provider source/effective 合同。
- `backend/alembic/versions/0003_phase7_project_provider_contracts.py` - 新增项目 provider override 列迁移。
- `backend/tests/factories.py` - 项目工厂支持创建带 override 的 fixture。
- `backend/tests/test_api/test_projects.py` - 锁定 POST/GET/PUT/PATCH provider round-trip 与非法 key 拒绝行为。
- `backend/tests/test_migrations.py` - 锁定 Alembic 路径配置与 project override 列存在性。

## Decisions Made
- 使用 schema 层 `Literal` 限制 provider key：text 仅 `anthropic|openai`，image 仅 `openai`，video 仅 `openai|doubao`。
- 默认继承值直接复用当前系统 truth：text=`anthropic`、image=`openai`、video=`openai`。
- list/get/create/update 都复用同一序列化 helper，避免来源判定在不同接口漂移。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 修正 migration 测试的 Alembic 脚本定位与 head 预期**
- **Found during:** Task 1（锁定项目 provider CRUD 与迁移回归测试）
- **Issue:** migration 测试最初依赖相对 `script_location`，在仓库根目录执行时无法找到 `backend/alembic`；同时旧断言遗漏了 Phase 03 已存在的 `shot_character_binding` 表，导致红灯噪音掩盖本计划真正失败点。
- **Fix:** 在测试 helper 中显式设置绝对 `script_location`，并同步 head table 断言到当前真实 schema。
- **Files modified:** `backend/tests/test_migrations.py`
- **Verification:** `uv run --project backend pytest backend/tests/test_api/test_projects.py backend/tests/test_migrations.py -q` 先只剩 provider 合同相关失败，最终全部通过。
- **Committed in:** `8947ac5`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** 该修正只清理测试噪音，确保本计划真正锁定的是 provider contract 与 migration 结果，没有引入额外范围。

## Issues Encountered
- 现有 migration 回归测试对执行目录和当前 head schema 有隐含假设，先修正后才能得到干净的 RED 阶段信号。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 07-02 可以直接消费 `provider_settings` 合同，把项目页/新建项目 provider UI 接到真实后端字段。
- Phase 08 可以在当前 override 持久化基础上继续实现 deterministic resolution 与启动前校验。

## Self-Check: PASSED
- Verified `.planning/phases/07-project-provider-contracts/07-01-SUMMARY.md` exists.
- Verified task commits `8947ac5` and `1d22542` exist in git history.

---
*Phase: 07-project-provider-contracts*
*Completed: 2026-04-17*

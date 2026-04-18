---
phase: 08-validation-deterministic-resolution
plan: 01
subsystem: api
tags: [provider-resolution, fastapi, runtime-settings, frontend, validation]
requires:
  - phase: 07-project-provider-contracts
    provides: project-level provider override persistence and project proof surface entrypoint
provides:
  - deterministic provider resolver shared by project reads and later generate preflight
  - project provider settings contract with validity and reason fields
  - explicit text/video factory failures instead of silent fallback
affects: [08-02, 08-03, provider-proof, generate-preflight]
tech-stack:
  added: []
  patterns: [single resolver truth source, runtime-backed default resolution, explicit unsupported-provider failure]
key-files:
  created: [backend/app/services/provider_resolution.py]
  modified:
    [backend/app/api/v1/routes/projects.py, backend/app/schemas/project.py, backend/app/services/text_factory.py, backend/app/services/video_factory.py, backend/tests/test_services/test_provider_resolution.py, backend/tests/test_api/test_projects.py, frontend/app/components/project/ProviderSelectionFields.tsx, frontend/app/components/settings/SettingsModal.tsx]
key-decisions:
  - "项目 provider proof 改为直接读取 resolver，而不是继续拼 schema 常量默认值。"
  - "text/video factory 对未知 provider 直接抛错，禁止 silent fallback。"
patterns-established:
  - "Provider resolution first: project/default/source/validity 统一由 resolver 输出。"
  - "Frontend default labels may accept runtime-backed defaults instead of hardcoded provider names."
requirements-completed: [VAL-01, VAL-02]
duration: 22min
completed: 2026-04-18
---

# Phase 08 Plan 01: Resolver truth and fallback removal Summary

**Runtime-backed provider resolution for text/image/video with creator-visible validity fields and no silent text/video fallback**

## Performance

- **Duration:** 22 min
- **Started:** 2026-04-18T01:00:00Z
- **Completed:** 2026-04-18T01:22:11Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- 新增统一 provider resolver，按 runtime settings + project override 产出确定性的 `selected_key/source/resolved_key/valid/reason_*`。
- 项目读取接口现在返回真实解析结果，默认值不再来自 schema 常量。
- text/video factory 去掉未知 provider 的静默回退，同时前端 provider 默认文案入口支持 runtime 对齐。

## Task Commits

Each task was committed atomically:

1. **Task 1: 先锁定 resolver 与 project proof contract 回归** - `4a3fac0` (test)
2. **Task 2: 实现统一 resolver，并让 projects route 改读真实解析结果** - `7437b88` (feat)
3. **Task 3: 去掉 text/video factory silent fallback，并统一前端默认文案来源** - `70bcd0d` (fix)

## Files Created/Modified
- `backend/app/services/provider_resolution.py` - 统一解析 project/default provider、capability 和凭据有效性。
- `backend/app/schemas/project.py` - 项目 provider read contract 扩展为 resolved/valid/reason 字段。
- `backend/app/api/v1/routes/projects.py` - 项目读接口改为依赖注入 settings 并复用 resolver。
- `backend/tests/test_services/test_provider_resolution.py` - 覆盖 runtime 默认、invalid 凭据、determinism。
- `backend/tests/test_api/test_projects.py` - 覆盖项目 proof surface 与 runtime defaults 对齐。
- `backend/app/services/text_factory.py` - 未知文本 provider 显式失败。
- `backend/app/services/video_factory.py` - 未知视频 provider 显式失败。
- `frontend/app/components/project/ProviderSelectionFields.tsx` - provider 默认文案支持从父层传入当前默认值。
- `frontend/app/components/settings/SettingsModal.tsx` - 视频默认回退改成 `openai`。

## Decisions Made
- 使用 `SettingsDep` 注入到 project routes，确保测试和运行时都读取同一份 live settings。
- resolver 聚合结果额外保留整体 `valid`，为 08-02 的 generate preflight 直接复用做准备。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 修正 project route 直接调用全局 `get_settings()` 导致测试与真实 settings override 脱节**
- **Found during:** Task 2 (实现统一 resolver，并让 projects route 改读真实解析结果)
- **Issue:** route helper 直接读全局缓存 settings，无法复用 FastAPI dependency override，project proof 在测试中不会反映当前 runtime settings。
- **Fix:** 将 project routes 改为注入 `SettingsDep`，并把 settings 显式传入 read-model builder。
- **Files modified:** `backend/app/api/v1/routes/projects.py`, `backend/tests/test_api/test_projects.py`
- **Verification:** `uv run --project backend pytest backend/tests/test_services/test_provider_resolution.py backend/tests/test_api/test_projects.py -q`
- **Committed in:** `7437b88`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** 修复是 resolver 合同成立的前提，没有扩大 Phase 08-01 的范围。

## Issues Encountered
- 初版 resolver 测试把 session-scope `test_settings` 当作独立实例使用，导致跨测试默认 provider 串扰；后续改为每个用例显式设置所需 runtime defaults。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `resolve_project_provider_settings()` 已可直接接入 generate preflight。
- 项目页类型仍是旧 contract；08-03 需要把真实 resolved state 渲染到 creator-facing proof surface。

## Self-Check

PASSED

---
*Phase: 08-validation-deterministic-resolution*
*Completed: 2026-04-18*

---
phase: 08-validation-deterministic-resolution
plan: 02
subsystem: api
tags: [generate, preflight, fastapi, business-error, provider-resolution]
requires:
  - phase: 08-validation-deterministic-resolution
    provides: deterministic provider resolver and project validity contract from 08-01
provides:
  - generate preflight that runs after 409 conflict checks and before AgentRun creation
  - structured provider invalid 422 payload with per-modality details
  - no-run guarantee for invalid provider starts
affects: [08-03, 09-runtime-snapshot-semantics, acceptance-evidence]
tech-stack:
  added: []
  patterns: [409-before-422 start gate, business error details payload, resolver reuse at run boundary]
key-files:
  created: []
  modified:
    [backend/app/api/v1/routes/generation.py, backend/app/exceptions.py, backend/app/schemas/project.py, backend/app/services/provider_resolution.py, backend/tests/test_api/test_generation.py, backend/tests/test_api/test_phase2_generation.py]
key-decisions:
  - "generate preflight 复用 08-01 resolver，而不是再造一套 start-time 校验逻辑。"
  - "422 payload 直接挂 `details.provider_resolution`，保持后端与前端阻断语义一致。"
patterns-established:
  - "Start gate order is fixed: active 409 -> recoverable 409 -> provider 422 -> create run."
requirements-completed: [VAL-01, VAL-02]
duration: 11min
completed: 2026-04-18
---

# Phase 08 Plan 02: Generate preflight Summary

**Generate start path now performs resolver-backed provider preflight and returns structured 422 failures before any AgentRun is created**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-18T01:15:00Z
- **Completed:** 2026-04-18T01:26:14Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- 为 generate 路由补上 provider preflight，invalid provider 会在创建 run 前被阻断。
- 保留 active / recoverable 冲突优先级，确保旧的恢复语义没有被 provider 校验覆盖。
- 422 错误细节携带完整 `provider_resolution`，可供前端直接消费。

## Task Commits

1. **Task 1: 先锁定 generate preflight 的 409/422 优先级与 no-run 语义** - `3dd12d5` (test)
2. **Task 2: 在 generate 路由中接入 preflight，并用结构化 422 阻断 invalid provider** - `ec48786` (feat)

## Files Created/Modified
- `backend/app/api/v1/routes/generation.py` - 在 run 创建前接入 resolver preflight 与 422 阻断。
- `backend/app/exceptions.py` - `BusinessError` 支持携带结构化 details。
- `backend/app/schemas/project.py` - 导出共享的 `ProviderResolution` DTO 与错误详情序列化方法。
- `backend/app/services/provider_resolution.py` - 复用 schema 层的 resolution DTO。
- `backend/tests/test_api/test_generation.py` - 覆盖 invalid provider 422 与 no-run 语义。
- `backend/tests/test_api/test_phase2_generation.py` - 覆盖 active/recoverable 仍然优先返回 409。

## Decisions Made
- 让 `ProviderResolution` 进入 schema 层，避免 generation 测试和 route 依赖 service 私有类型。
- `PROVIDER_PRECHECK_FAILED` 固定 message 设为“项目 Provider 配置无效，无法启动生成”，便于前端统一提示。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 把 `ProviderResolution` 提升到 schema 层以解开测试与路由的共享类型阻塞**
- **Found during:** Task 2 (在 generate 路由中接入 preflight，并用结构化 422 阻断 invalid provider)
- **Issue:** red test 需要从公共位置导入 `ProviderResolution`，但它最初只存在于 service 模块，导致测试收集失败。
- **Fix:** 将 `ProviderResolution` 迁到 `backend/app/schemas/project.py`，service 和 route 共同复用。
- **Files modified:** `backend/app/schemas/project.py`, `backend/app/services/provider_resolution.py`
- **Verification:** `uv run --project backend pytest backend/tests/test_api/test_generation.py backend/tests/test_api/test_phase2_generation.py -q`
- **Committed in:** `ec48786`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** 仅做共享类型归位，没有改变 Phase 08-02 的接口目标。

## Issues Encountered
- 初版 red test 因共享 DTO 位置不对而在收集阶段报错，修复后即恢复正常 TDD 流程。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 项目页现在可以依赖后端的 `provider_resolution` 与 `reason_message` 做 creator-facing 阻断。
- 08-03 只需把前端类型、proof card 和 generate CTA 接到现有后端合同。

## Self-Check

PASSED

---
*Phase: 08-validation-deterministic-resolution*
*Completed: 2026-04-18*

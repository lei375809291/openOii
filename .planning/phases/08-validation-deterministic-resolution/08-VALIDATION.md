---
phase: 08
slug: validation-deterministic-resolution
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-18
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + vitest + tsc |
| **Config file** | `backend/pyproject.toml`, `frontend/package.json` |
| **Quick run command** | `uv run --project backend pytest backend/tests/test_services/test_provider_resolution.py backend/tests/test_api/test_projects.py backend/tests/test_api/test_generation.py backend/tests/test_api/test_phase2_generation.py -q && pnpm --dir frontend exec vitest run app/pages/ProjectPage.test.tsx && pnpm --dir frontend exec tsc --noEmit` |
| **Full suite command** | `uv run --project backend pytest backend/tests/test_services/test_provider_resolution.py backend/tests/test_api/test_projects.py backend/tests/test_api/test_generation.py backend/tests/test_api/test_phase2_generation.py -q && pnpm --dir frontend exec vitest run app/pages/ProjectPage.test.tsx && pnpm --dir frontend exec tsc --noEmit` |
| **Estimated runtime** | ~35 seconds |

---

## Sampling Rate

- **After every task commit:** Run `uv run --project backend pytest backend/tests/test_services/test_provider_resolution.py backend/tests/test_api/test_projects.py backend/tests/test_api/test_generation.py backend/tests/test_api/test_phase2_generation.py -q && pnpm --dir frontend exec vitest run app/pages/ProjectPage.test.tsx && pnpm --dir frontend exec tsc --noEmit`
- **After every plan wave:** Run `uv run --project backend pytest backend/tests/test_services/test_provider_resolution.py backend/tests/test_api/test_projects.py backend/tests/test_api/test_generation.py backend/tests/test_api/test_phase2_generation.py -q && pnpm --dir frontend exec vitest run app/pages/ProjectPage.test.tsx && pnpm --dir frontend exec tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | VAL-02 | T-08-01 / T-08-02 | resolver 对相同输入给出相同输出，invalid 时不 fallback 且 `resolved_key = null` | unit | `uv run --project backend pytest backend/tests/test_services/test_provider_resolution.py -q` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | VAL-02 | T-08-03 / T-08-04 | projects route proof surface 使用 resolver 真相而不是 schema/front-end 常量 | api | `uv run --project backend pytest backend/tests/test_api/test_projects.py -q` | ✅ | ⬜ pending |
| 08-02-01 | 02 | 2 | VAL-01 | T-08-05 / T-08-06 | `POST /generate` 保持 409 active/recoverable 优先，其次 invalid -> 422，且 invalid 不创建 run | api | `uv run --project backend pytest backend/tests/test_api/test_generation.py backend/tests/test_api/test_phase2_generation.py -q` | ✅ | ⬜ pending |
| 08-03-01 | 03 | 3 | VAL-01, VAL-02 | T-08-07 / T-08-08 | 项目页显示后端返回的解析结果；invalid 时禁用生成并暴露 reason | frontend | `pnpm --dir frontend exec vitest run app/pages/ProjectPage.test.tsx && pnpm --dir frontend exec tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `backend/tests/test_services/test_provider_resolution.py` — 新增 resolver 单测文件以覆盖 default sourcing / invalid / determinism
- [x] `backend/tests/test_api/test_projects.py` — 复用现有项目 API 合同测试文件
- [x] `backend/tests/test_api/test_generation.py` — 复用现有 generate API 测试文件
- [x] `backend/tests/test_api/test_phase2_generation.py` — 复用现有 409 优先级测试文件
- [x] `frontend/app/pages/ProjectPage.test.tsx` — 复用现有项目页 proof surface 测试文件

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-18

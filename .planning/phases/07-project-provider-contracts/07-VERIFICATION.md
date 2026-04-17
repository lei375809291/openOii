---
phase: 07-project-provider-contracts
verified: 2026-04-18T01:20:00Z
status: passed
score: 3/3 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/3
  gaps_closed:
    - "创作者保存项目设置后，刷新页面或重新进入项目时，看到的 provider 选择与保存时一致。"
  gaps_remaining: []
  regressions: []
---

# Phase 07: Project Provider Contracts Verification Report

**Phase Goal:** 创作者可以在单个项目上设置、保存并重新看到 text / image / video provider 选择，而且能明确区分项目 override 与默认继承。
**Verified:** 2026-04-18T01:20:00Z
**Status:** passed
**Re-verification:** 是 — gap closure 后复验

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | 创作者可以在同一个项目里分别查看和设置 text、image、video 的 provider 选择。 | ✓ VERIFIED | `frontend/app/components/project/ProviderSelectionFields.tsx:20-130` 提供三组 provider 单选与“继承默认”；`frontend/app/pages/NewProjectPage.tsx:24-31,168-185,222-239` 在创建流提交三类 override；`frontend/app/pages/ProjectPage.tsx:527-605` 提供项目页 proof/edit card；后端 `backend/app/api/v1/routes/projects.py:124-188` 持久化并回读。 |
| 2 | 创作者保存项目设置后，刷新页面或重新进入项目时，看到的 provider 选择与保存时一致。 | ✓ VERIFIED | 缺口已关闭：`frontend/app/pages/ProjectPage.tsx:37-45,135-143,398-405` 现在从 `provider_settings.*.override_key` 派生编辑态 draft；`frontend/app/pages/ProjectPage.test.tsx:192-218` 用真实 `ProjectRead` 形状验证刷新后进入编辑态仍选中 OpenAI / 继承默认 / Doubao；后端 `backend/app/api/v1/routes/projects.py:53-73,150-188` 稳定返回同一份 `provider_settings`。 |
| 3 | 创作者可以明确看出某个 modality 当前是项目级 override，还是仍在继承默认 provider。 | ✓ VERIFIED | 后端 `_provider_entry` 在 `backend/app/api/v1/routes/projects.py:39-58` 生成 `override_key/effective_key/source`；项目页在 `frontend/app/pages/ProjectPage.tsx:565-597` 渲染“项目覆盖/默认继承” badge 与 effective provider。 |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `backend/app/models/project.py` | Project 级 provider override 字段 | ✓ VERIFIED | `Project` 持久化 `text_provider_override` / `image_provider_override` / `video_provider_override`，见 `backend/app/models/project.py:23-25`。 |
| `backend/app/schemas/project.py` | 项目 provider 读写 DTO 与 source/effective contract | ✓ VERIFIED | `ProjectCreate/Update` 限制合法 provider key；`ProjectProviderSettingsRead` 与 `ProjectRead` 明确读合同，见 `backend/app/schemas/project.py:9-62`。 |
| `backend/app/api/v1/routes/projects.py` | create/get/update project provider persistence and reload surface | ✓ VERIFIED | create/get/list/update 都通过 `_project_provider_settings` / `_project_read_model` 返回 provider 合同，见 `backend/app/api/v1/routes/projects.py:53-73,124-188`。 |
| `backend/alembic/versions/0003_phase7_project_provider_contracts.py` | project provider override schema migration | ✓ VERIFIED | 迁移新增/回滚三列 override 字段，见 `backend/alembic/versions/0003_phase7_project_provider_contracts.py:22-31`。 |
| `frontend/app/components/project/ProviderSelectionFields.tsx` | 共享的 provider 选择字段 | ✓ VERIFIED | text/image/video 三组受控单选与 null 映射逻辑完整，见 `frontend/app/components/project/ProviderSelectionFields.tsx:32-130`。 |
| `frontend/app/pages/NewProjectPage.tsx` | 项目创建时的 provider 选择提交 | ✓ VERIFIED | 新建页持有三类 override 状态并提交给 `projectsApi.create`，见 `frontend/app/pages/NewProjectPage.tsx:24-31,59-62,168-185,222-239`。 |
| `frontend/app/pages/ProjectPage.tsx` | 项目页 provider proof/edit card | ✓ VERIFIED | proof card 与编辑表单共享 `provider_settings` 来源；保存后只刷新项目查询缓存，见 `frontend/app/pages/ProjectPage.tsx:37-45,135-143,330-341,398-410,527-605`。 |
| `frontend/app/types/index.ts` | Project provider contract TS types | ✓ VERIFIED | `Project` 读模型只保留真实返回的 `provider_settings`，写 payload 单独保留 override/null 字段，见 `frontend/app/types/index.ts:3-43`。 |
| `frontend/app/pages/ProjectPage.test.tsx` | 真实 GET 合同下的刷新后编辑态回归测试 | ✓ VERIFIED | 真实 `ProjectRead` fixture 不再伪造 raw override 字段，并断言刷新后编辑态预填与保存 payload，见 `frontend/app/pages/ProjectPage.test.tsx:10-37,192-218,236-264`。 |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `backend/app/api/v1/routes/projects.py` | `backend/app/models/project.py` | POST/GET/PUT/PATCH payload mapping | ✓ WIRED | gsd-tools `verify key-links` 通过；create/update 写入模型字段，get/list/read 从模型字段构造 provider_settings。 |
| `backend/app/schemas/project.py` | `backend/app/api/v1/routes/projects.py` | `ProjectRead` model serialization | ✓ WIRED | gsd-tools `verify key-links` 通过；routes 直接实例化 `ProjectProviderEntry` / `ProjectProviderSettingsRead` / `ProjectRead`。 |
| `frontend/app/services/api.ts` | `backend/app/api/v1/routes/projects.py` | `projectsApi.create/update/get` | ✓ WIRED | `projectsApi.get/create/update` 连接 `/api/v1/projects`，见 `frontend/app/services/api.ts:128-147`。 |
| `frontend/app/pages/ProjectPage.tsx` | `frontend/app/types/index.ts` | `Project.provider_settings` rendering | ✓ WIRED | 页面 proof card 与 edit draft 都读取 `project.provider_settings`，见 `frontend/app/pages/ProjectPage.tsx:37-45,475-605`。 |
| `backend/app/api/v1/routes/projects.py` | `frontend/app/pages/ProjectPage.tsx` | `projectsApi.get(projectId) -> provider_settings.*.override_key` | ✓ WIRED | 原 gap 已修复；`deriveProviderOverridesFromProject()` 直接消费后端 `provider_settings.*.override_key`，见 `frontend/app/pages/ProjectPage.tsx:37-45`。 |
| `frontend/app/pages/ProjectPage.tsx` | `frontend/app/components/project/ProviderSelectionFields.tsx` | derived provider draft value | ✓ WIRED | `ProviderSelectionFields` 收到派生后的 `providerDraft`，并在取消编辑时回灌同一来源，见 `frontend/app/pages/ProjectPage.tsx:57-62,398-405,599-604`。 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `frontend/app/pages/ProjectPage.tsx` | `providerRows[].entry` | `projectsApi.get(projectId)` → `backend/app/api/v1/routes/projects.py:_project_provider_settings()` → `Project.*_provider_override` | Yes | ✓ FLOWING |
| `frontend/app/pages/ProjectPage.tsx` | `providerDraft.text/image/video_provider_override` | `project.provider_settings.*.override_key` → `deriveProviderOverridesFromProject()` | Yes | ✓ FLOWING |
| `frontend/app/pages/NewProjectPage.tsx` | `formData.*_provider_override` | 本地受控状态 → `projectsApi.create` → `create_project()` 持久化 → `ProjectRead.provider_settings` 回读 | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| 后端 provider persistence/source 合同回归 | `uv run --project backend pytest backend/tests/test_api/test_projects.py backend/tests/test_migrations.py -q` | `13 passed in 0.61s` | ✓ PASS |
| 前端 provider 创建/刷新/编辑回归 | `pnpm --dir frontend exec vitest run app/pages/NewProjectPage.test.tsx app/pages/ProjectPage.test.tsx app/utils/workspaceStatus.test.ts` | `3 files, 22 tests passed` | ✓ PASS |
| 前端类型检查 | `pnpm --dir frontend exec tsc --noEmit` | 退出 0 | ✓ PASS |
| `ProjectRead` 是否携带可用于刷新后编辑态的 override 来源 | `uv run python -c "from app.models.project import Project; from app.api.v1.routes.projects import _project_read_model; ..."`（`backend/` 目录） | 输出 `openai None doubao`，说明 `provider_settings.*.override_key` 正常流入读模型 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| PROV-01 | `07-01`, `07-02` | 创作者可以为单个项目分别选择 text / image / video provider。 | ✓ SATISFIED | 后端 CRUD 可存三类 override；新建页与项目页都暴露三类选择控件。 |
| PROV-02 | `07-01`, `07-02`, `07-03` | 创作者保存项目后，再次打开或刷新时仍能看到相同的 provider 选择。 | ✓ SATISFIED | `ProjectPage` 已改为从 `provider_settings` 派生编辑态；真实合同测试覆盖刷新后编辑态默认值。 |
| PROV-03 | `07-01`, `07-02` | 创作者可以明确区分某个项目是在使用项目级 provider，还是继承默认 provider。 | ✓ SATISFIED | 后端返回 `source` / `effective_key`，项目页渲染 badge 与 effective provider。 |

所有 PLAN frontmatter 声明的 requirement IDs（PROV-01, PROV-02, PROV-03）均已在 `REQUIREMENTS.md` 中找到并完成核对；`REQUIREMENTS.md` 对 Phase 07 没有额外 orphaned requirement。

### Anti-Patterns Found

未在 Phase 07 相关实现文件中发现阻断目标达成的 TODO/FIXME、placeholder UI、空实现或断开的空数据回退。此前的 mock-only 合同漂移已由 `07-03` 修复。

### Gaps Summary

无。上一版唯一缺口（刷新后编辑态错误回到“继承默认”）已关闭；当前代码、类型、测试与真实后端读合同一致。

---

_Verified: 2026-04-18T01:20:00Z_
_Verifier: the agent (gsd-verifier)_

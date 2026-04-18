# Phase 08: Validation & Deterministic Resolution — Research

**Date:** 2026-04-18  
**Phase:** 08  
**Requirements:** VAL-01, VAL-02

## Research Question

为了把项目级 provider 选择变成“启动前可校验、解析结果确定、无 silent fallback”的执行前合同，当前仓库已经有什么、缺什么、最安全的落点在哪里？

## Current Ground Truth

### 1. 项目级 provider 选择已经能持久化，但只是 Phase 07 的“read/write contract”

- `backend/app/models/project.py`：项目表已持久化 `text_provider_override` / `image_provider_override` / `video_provider_override`
- `backend/app/schemas/project.py`：项目 API 读模型返回 `provider_settings.{text,image,video}.{override_key,effective_key,source}`
- `backend/app/api/v1/routes/projects.py`：`_provider_entry()` / `_project_provider_settings()` 目前直接用 schema 常量 `DEFAULT_*_PROVIDER` 计算 `effective_key`
- `frontend/app/pages/ProjectPage.tsx`：项目页 proof card 与编辑态都以 `project.provider_settings` 为唯一读来源

结论：Phase 07 只证明“项目覆盖值被保存并展示了”，**没有证明这个展示值真的是 runtime 将使用的 provider**。

### 2. 当前默认值语义分叉：项目 API 用 schema 常量，runtime 用 settings

- `backend/app/schemas/project.py`
  - `DEFAULT_TEXT_PROVIDER = "anthropic"`
  - `DEFAULT_IMAGE_PROVIDER = "openai"`
  - `DEFAULT_VIDEO_PROVIDER = "openai"`
- `backend/app/config.py`
  - `Settings.text_provider` 默认 `anthropic`
  - `Settings.video_provider` 默认 `openai`
- `frontend/app/components/project/ProviderSelectionFields.tsx`
  - 继承默认文案写死为 `text=anthropic,image=openai,video=openai`
- `frontend/app/components/settings/SettingsModal.tsx`
  - `getVideoProvider()` 在表单 state 缺值时回退到 `'doubao'`

结论：**已存在至少一个明确分叉点**：系统设置模态框的视频默认回退为 `doubao`，而 backend runtime 默认是 `openai`。如果不先统一“默认从哪里来”，任何项目页 proof 都可能是假的。

### 3. generate 前只有 run-state 冲突检查，没有 provider preflight

- `backend/app/api/v1/routes/generation.py`
  - 先检查 active run → `409`
  - 再检查 recoverable run → `409`
  - 之后直接创建 `AgentRun(status="running")`
  - 然后异步启动 `GenerationOrchestrator`

缺口：
- 没有 provider validity 检查
- 没有 deterministic resolution 输出
- invalid provider 时仍会创建 run

这与 VAL-01 冲突，也违背“invalid 不创建 run”的用户确认约束。

### 4. 当前真实执行路径只消费 runtime settings，不消费项目 override

- `backend/app/agents/orchestrator.py:_build_agent_context()`
  - `create_text_service(self.settings)`
  - `ImageService(self.settings)`
  - `create_video_service(self.settings)`
- `backend/app/services/text_factory.py`
  - `settings.text_provider == "openai"` 时返回 `TextService`
  - 否则默认返回 `LLMService`（Anthropic）
- `backend/app/services/video_factory.py`
  - `settings.video_provider.lower() == "doubao"` 时返回 `DoubaoVideoService`
  - 否则默认返回 `VideoService`（OpenAI compatible）

结论：
- 项目 override 还没进 runtime 路径，这与用户判断一致
- text/video factory 都存在 `else -> 默认 provider` 行为，属于 silent fallback 风险源

### 5. image 路径目前没有 provider 工厂，但 capability 只有 OpenAI

- `backend/app/agents/orchestrator.py` 直接构造 `ImageService(self.settings)`
- `backend/app/services/media_service.py` / `backend/app/services/image.py` 本质都只使用 OpenAI-compatible image settings

结论：
- image modality 当前天然只有一个 provider，可纳入统一 resolver 输出，但无需像 text/video 一样先消除 factory fallback

### 6. 现有错误通路足以承载结构化 422，但 generate 路由还没接入

- `backend/app/exceptions.py` 已有 `BusinessError(status_code=422)`
- `frontend/app/services/api.ts` 已能解析结构化错误：`error.code` / `error.message` / `error.details`
- `frontend/app/pages/ProjectPage.tsx` 的 generate error toast 已能展示 `ApiError.message` 与 dev details

结论：
- Phase 08 可以复用现有错误协议，不必发明全新前端错误基础设施
- 但为了让前端最小阻断面可渲染，最好让 generate/preflight 422 返回稳定的 `reason_code` / `reason_message` / per-modality 结果

## Recommended Architecture

### Single Source of Truth: Provider Resolution Service

新增统一 resolver，职责只做两件事：

1. **解析每个 modality 的 selected/effective provider**
2. **给出是否可启动、为什么不可启动**

建议落点：`backend/app/services/provider_resolution.py`（或同等语义路径）

### Inputs

- project overrides
  - `Project.text_provider_override`
  - `Project.image_provider_override`
  - `Project.video_provider_override`
- runtime settings
  - `settings.text_provider`
  - `settings.video_provider`
  - image 默认来自当前 image runtime config（当前唯一 provider 为 `openai`）
- capability matrix
  - text: `anthropic`, `openai`
  - image: `openai`
  - video: `openai`, `doubao`
  - merge 不参与解析

### Output Shape

每个 modality 输出：

- `selected_key`：项目最终选择值；有 override 用 override，没有则用当前 runtime 默认
- `source`：`project` / `default`
- `resolved_key`：可用于真实执行的 provider key；解析失败时必须为 `null`
- `valid`：布尔值
- `reason_code`：稳定枚举，给后端断言与前端阻断用
- `reason_message`：创作者可读说明

另外建议聚合输出：

- `modalities: { text, image, video }`
- `valid: bool`（全量）

### Deterministic Rules

1. 默认值永远来自 runtime settings / live config，不来自 schema/front-end 常量
2. resolver 是唯一解析入口，projects route / preflight / front-end proof 都复用它
3. 同样输入必须产出同样输出（same input -> same output）
4. invalid 时 `resolved_key = null`
5. 不允许 silent fallback 到其他 provider

## Provider Validity Rules To Encode

最小可执行规则：

### Text

| selected_key | valid 条件 | invalid reason_code 候选 |
|---|---|---|
| `anthropic` | `anthropic_api_key` 或 `anthropic_auth_token` 存在 | `provider_missing_credentials` |
| `openai` | `text_api_key` 存在 | `provider_missing_credentials` |

### Image

| selected_key | valid 条件 | invalid reason_code 候选 |
|---|---|---|
| `openai` | `image_api_key` 存在 | `provider_missing_credentials` |

### Video

| selected_key | valid 条件 | invalid reason_code 候选 |
|---|---|---|
| `openai` | `video_api_key` 存在 | `provider_missing_credentials` |
| `doubao` | `doubao_api_key` 存在 | `provider_missing_credentials` |

### Common invalids

- key 不在 capability matrix → `provider_unsupported`
- provider key 为 `None`/空串且默认值本身不可解析 → `provider_default_unavailable`
- settings 指向未知 provider → `provider_unknown`

## Safe Integration Order

### Plan 08-01 — 先收敛“解析真相”

需要同时修三类地方：

1. `backend/app/api/v1/routes/projects.py`
   - 不再直接用 `DEFAULT_*_PROVIDER`
   - 改为调用 resolver，返回真实 default / selected / validity 结果
2. `backend/app/services/text_factory.py` 与 `backend/app/services/video_factory.py`
   - 把“未知 provider 时默认 fallback”改为显式失败
   - 或引入只能接收已解析 provider key 的工厂入口
3. 前端默认语义
   - `frontend/app/components/project/ProviderSelectionFields.tsx`
   - `frontend/app/components/settings/SettingsModal.tsx`
   - 至少要去掉与 runtime 默认相矛盾的硬编码来源

### Plan 08-02 — 在 generate 前加 preflight

必须保持当前优先级：

1. active run → `409`
2. recoverable run → `409`
3. provider invalid → 结构化 `422`
4. 只有通过 preflight 才创建 `AgentRun`

### Plan 08-03 — 前端最小阻断面

项目页需要能直接消费后端返回的解析结果：

- 显示真实 `resolved_key` / `source`
- invalid 时给出 reason
- 禁用生成按钮
- generate 422 时不把它伪装成普通失败 toast，而是保持与页面 proof surface 一致

## Key Risks / Pitfalls

### 1. 只修 projects route，不修 factory，会继续出现“UI 显示 A，运行默认切到 B”

因为当前 runtime 仍直接读 `settings`，而 text/video factory 自带 fallback。Phase 08 至少要把 fallback 改成显式失败，哪怕真正把项目选择接入 runtime 在 Phase 09。

### 2. 只在 save-time 校验会卡住默认继承语义

用户明确要求校验发生在 start-time。原因是 runtime settings、keys、enabled state 都可能在保存后改变。save-time 校验会把“当时有效”误当成“未来启动时仍有效”。

### 3. 前端继续写死默认值会污染 proof surface

`ProviderSelectionFields.tsx` 当前把 inherit 文案写成固定 provider；若 runtime 默认被系统设置改掉，文案会立刻失真。项目页的最终 proof 不能继续依赖这些常量。

### 4. 422 结构若不稳定，前端最小阻断面会变成 toast-only

应尽量让 project read / preflight / generate invalid 使用同一套 reason 枚举和 per-modality shape，避免前端为不同来源分叉处理。

## Suggested File Targets For Planning

### Backend core
- `backend/app/services/provider_resolution.py`（新增）
- `backend/app/api/v1/routes/projects.py`
- `backend/app/api/v1/routes/generation.py`
- `backend/app/services/text_factory.py`
- `backend/app/services/video_factory.py`
- `backend/app/schemas/project.py`（扩展 read model / preflight DTO）

### Backend tests
- `backend/tests/test_api/test_projects.py`
- `backend/tests/test_api/test_generation.py`
- `backend/tests/test_api/test_phase2_generation.py`
- `backend/tests/test_services/` 下新增 resolver tests

### Frontend
- `frontend/app/types/index.ts`
- `frontend/app/pages/ProjectPage.tsx`
- `frontend/app/pages/ProjectPage.test.tsx`
- `frontend/app/components/project/ProviderSelectionFields.tsx`
- `frontend/app/components/settings/SettingsModal.tsx`

## Validation Architecture

### Test stack already available

- Backend: `pytest` (`backend/pyproject.toml`)
- Frontend: `vitest` + `tsc` (`frontend/package.json`)

### Recommended verification slices

1. **Resolver unit tests**
   - same input -> same output
   - runtime default sourcing
   - unsupported / missing credentials -> invalid + `resolved_key=null`
2. **Projects API contract tests**
   - provider proof surface derives from resolver, not schema constants
3. **Generate API tests**
   - active/recoverable still return `409`
   - invalid provider returns structured `422`
   - invalid path does not create run
4. **Frontend ProjectPage tests**
   - renders backend-returned resolved state
   - invalid disables generate
   - invalid reason visible

### Fast commands

- Backend targeted:
  - `uv run --project backend pytest backend/tests/test_api/test_projects.py backend/tests/test_api/test_generation.py backend/tests/test_api/test_phase2_generation.py -q`
- Frontend targeted:
  - `pnpm --dir frontend exec vitest run app/pages/ProjectPage.test.tsx`
- Type safety:
  - `pnpm --dir frontend exec tsc --noEmit`

## Planning Guidance

Phase 08 最稳妥的拆法就是用户建议的 3 计划：

1. **08-01**：统一 resolver + 去掉 factory silent fallback + projects/default truth 对齐
2. **08-02**：generate preflight + structured `422` + invalid 不创建 run
3. **08-03**：项目页最小 proof/阻断面，展示真实解析结果并禁用生成

这样分的好处：

- 先把 truth contract 固化，再让 API consume
- 让 409/422 交互优先级单独被测试锁定
- 前端只消费已经稳定的后端 contract，不反向推动后端 shape

---

## Research Complete

- 当前仓库的真实风险点已经明确：**projects route 用 schema 常量、runtime 用 settings、factory 有 silent fallback、generate 没有 preflight**
- Phase 08 应先建立统一 resolver，并让 projects route / generate preflight / UI proof 共用它
- Phase 09 再把该 resolver 的结果真正冻结进 runtime snapshot

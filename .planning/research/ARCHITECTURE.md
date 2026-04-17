# Architecture Research: v1.1 Provider Portability Proof

**Milestone:** v1.1 Provider Portability Proof  
**Scope:** 只覆盖“项目级 provider 选择如何穿过现有 FastAPI + React + LangGraph 主链路”的集成架构  
**Researched:** 2026-04-17  
**Confidence:** HIGH（现有仓库结构证据充分；LangGraph 持久化 / interrupt 约束有官方文档支撑）

## Integration Points

这次不要做“新配置系统重写”。最小风险做法是：

- **全局配置继续负责凭证、base URL、模型、默认 provider**
- **项目配置只负责选择 text / image / video 用哪个 provider key**
- **运行时在启动 run 时解析一次，并冻结成 run snapshot**
- **LangGraph 与下游 provider 调用只消费 snapshot，不直接读项目实时配置**
- **UI 展示“项目选择 + 本次运行实际解析结果 + 产物/阶段证据”**

### 1. Project settings → persistence

**目标：** 把 provider 选择变成项目的一部分，而不是 admin/global config 的隐含副作用。

**推荐结构：**

- 在 `Project` 上新增**显式、可空**的 provider override 字段，而不是先上泛化 JSON 配置平台。
  - `text_provider_override: str | None`
  - `image_provider_override: str | None`
  - `video_provider_override: str | None`
- 可空表示“继承全局默认”。这对已有项目兼容性最好。

**具体集成点：**

- `backend/app/models/project.py`
- `backend/app/schemas/project.py`
- `backend/app/api/v1/routes/projects.py`
- 前端 `frontend/app/types/index.ts`
- 前端 `frontend/app/services/api.ts`

**为什么这样做：**

- 当前项目模型非常直接，新增 3 个明确字段比引入通用 project config 表/JSON 更低风险。
- v1.1 的证明目标是 portability proof，不是 provider policy engine。
- 显式字段让 API、迁移、测试、查询、回退逻辑都更清楚。

### 2. Persistence → validation

**目标：** 项目可以保存“我想用哪个 provider”，但保存和运行前都必须校验“这个选择在当前系统里是否合法、可运行”。

**新增一个专用验证边界：** `ProjectProviderValidationService` / `ProviderRegistry`

它负责：

- 列出当前系统支持的 provider key（不是直接散落在前后端字符串里）
- 校验项目选择是否合法
- 校验所选 provider 所需的全局凭证/endpoint 是否齐全
- 给前端返回 creator 可理解的错误：
  - 未配置凭证
  - provider key 不受支持
  - 当前 provider 已被管理员移除或禁用

**具体集成点：**

- 新增 `backend/app/services/provider_registry.py`
- 新增 `backend/app/services/provider_validation.py`
- 复用 `backend/app/config.py`
- 复用 `backend/app/services/config_service.py`
- 修改 `backend/app/api/v1/routes/projects.py`（保存时轻校验）
- 修改 `backend/app/api/v1/routes/generation.py`（运行前强校验）

**关键约束：**

- **项目保存时可以允许“配置存在但当前不可运行”吗？** 这里建议：
  - 保存时做**结构校验 + provider existence 校验**
  - 运行前做**可执行性强校验**
- 这样能避免管理员临时改全局配置时，项目表单被完全卡死。

### 3. Validation → runtime resolution

**目标：** 在 run 启动时把“项目 override + 全局默认 + provider-specific config”解析成一份**不可变运行快照**。

**新增核心组件：** `ProviderResolutionService`

输入：

- `Project` 上的 provider override
- `Settings` / 全局配置
- 可选：将来支持的 capability flags

输出：

- `ResolvedProviderSelection`
  - `text.provider_key`
  - `image.provider_key`
  - `video.provider_key`
  - `source`（`project_override` / `global_default`）
  - `model` / `base_url` / capability summary（用于 trace，不回显敏感值）

**具体集成点：**

- 新增 `backend/app/services/provider_resolution.py`
- 修改 `backend/app/api/v1/routes/generation.py`
- 修改 `backend/app/agents/orchestrator.py`
- 修改 `backend/app/agents/base.py`

**为什么必须有这一层：**

- 当前 orchestrator 和工厂基本直接吃 `Settings`，这会让“项目级选择”变成隐式分支，后面很难追踪。
- provider resolution 应该是**一次性、可审计、可序列化**的结果，不应该在节点里反复推导。

### 4. Runtime resolution → durable run snapshot

**目标：** 保证同一个 run / resume 过程中的 provider 选择不漂移。

**必须新增 run snapshot 持久化。** 这是这次 milestone 最关键的架构点。

**推荐最小实现：** 在 `AgentRun` 增加 JSON/TEXT 元数据字段，而不是新开复杂关联表。

建议新增：

- `provider_snapshot_json`
- `provider_trace_json`（可选，先留给阶段级追加）

`provider_snapshot_json` 至少包含：

- run 启动时 text/image/video 的 resolved provider key
- 每个 modality 的来源（project/global）
- 非敏感模型标识
- 解析时间

**具体集成点：**

- `backend/app/models/agent_run.py`
- 新增 Alembic migration（当前仓库未见迁移体系，这本身就是一次集成前置）
- `backend/app/schemas/project.py`（`AgentRunRead` 可增加 provider snapshot 概览）
- `backend/app/api/v1/routes/generation.py`
- `backend/app/agents/orchestrator.py`

**强约束：**

- **resume 继续使用旧 snapshot**，绝不能在恢复时重新按当前项目设置解析。
- **新的 rerun / feedback run** 才重新生成新 snapshot。

### 5. Run snapshot → LangGraph execution

**目标：** LangGraph 节点消费的是“本次运行的 provider 决议”，而不是可变全局配置。

**推荐改法：**

- 在 `Phase2State` 或 `Phase2RuntimeContext` 中加入只读 `provider_snapshot`
- graph compile 不需要变；runtime context 需要变
- agent context 也需要带上 `provider_snapshot`

**具体集成点：**

- `backend/app/orchestration/state.py`
- `backend/app/orchestration/runtime.py`
- `backend/app/orchestration/nodes.py`（如果节点内要发 trace/progress）
- `backend/app/agents/base.py`
- `backend/app/agents/orchestrator.py`

**为什么放在 runtime context：**

- 这是执行上下文，不是 creator 可编辑的业务状态。
- 让节点和 agent 能明确知道“当前 run 冻结后的 provider 选择”。

### 6. LangGraph execution → provider instantiation

**目标：** text / image / video 工厂不要再直接从 `Settings` 猜当前 provider，而是优先看 `provider_snapshot`。

**当前问题：**

- `create_text_service(settings)` 只看 `settings.text_provider`
- `create_video_service(settings)` 只看 `settings.video_provider`
- image 目前没有正式的 provider registry，只有一个通用 OpenAI-compatible `ImageService`

**推荐改法：**

- 引入统一工厂签名，例如：
  - `create_text_service(settings, resolved.text)`
  - `create_image_service(settings, resolved.image)`
  - `create_video_service(settings, resolved.video)`
- image 虽然现阶段可能只有一个兼容实现，也应该先补 `image_factory.py`，把架构口子开对。

**具体集成点：**

- 修改 `backend/app/services/text_factory.py`
- 新增 `backend/app/services/image_factory.py`
- 修改 `backend/app/services/video_factory.py`
- 复用 `backend/app/services/llm.py`
- 复用 `backend/app/services/text.py`
- 复用 `backend/app/services/image.py`
- 复用 `backend/app/services/video.py`
- 复用 `backend/app/services/doubao_video.py`

### 7. Execution → creator-visible proof / traceability

**目标：** creator 能看到“项目选了什么”以及“这次真的用了什么”。

最低要做到三层证据：

1. **项目层**：当前项目设置的 provider 选择
2. **运行层**：本次 run 冻结后的 resolved snapshot
3. **阶段/产物层**：关键节点实际使用的 provider trace

**推荐 UI 证据面：**

- 项目页增加 **Provider Settings / Proof 卡片**
- run 开始时通过 API 或 WS 带回 `provider_snapshot`
- 在 script / character / storyboard / clip / final 区块显示轻量 trace：
  - `Text: anthropic`
  - `Image: openai-compatible`
  - `Video: doubao`
- 对 resume 场景显示：`Resumed with original provider snapshot`

**具体集成点：**

- `backend/app/schemas/ws.py`
- `backend/app/ws/manager.py`
- `frontend/app/types/index.ts`
- `frontend/app/stores/editorStore.ts`
- `frontend/app/hooks/useWebSocket.ts`
- `frontend/app/pages/NewProjectPage.tsx`
- `frontend/app/pages/ProjectPage.tsx`
- 可能新增 `frontend/app/components/project/ProviderProofCard.tsx`

**推荐事件策略：**

- `run_started` 携带 `provider_snapshot`
- `run_progress` 可选携带当前 stage 的 `provider_trace`
- `project_updated` 可返回最新项目 provider setting 摘要

### 8. Traceability → artifact lineage / auditability

**目标：** 最后不仅知道 run 选了什么，还知道关键产物是被哪个 provider 产出的。

**推荐最小实现：**

- 不先做完整“每次外部调用明细表”
- 先在关键产物或 stage trace 上记：
  - `modality`
  - `provider_key`
  - `model`
  - `run_id`
  - `thread_id` / checkpoint lineage reference（如有）

**建议存放位置：**

- v1.1 最小可行：`AgentRun.provider_trace_json`
- 如果已有 `Artifact` 真正参与主链路，可逐步把 provider metadata 下沉到 artifact 记录

这样能先证明 portability，不必在本 milestone 把全量 lineage 模型重构完。

## New vs Modified Components

### New Components

| Component | Type | Responsibility | Why New |
|-----------|------|----------------|---------|
| `provider_registry.py` | Backend service | 统一声明支持的 provider key、modality、所需配置 | 现在 provider key 分散在 settings / factory / 前端字符串里 |
| `provider_validation.py` | Backend service | 校验项目选择是否合法、是否可运行 | 避免路由/工厂各自校验 |
| `provider_resolution.py` | Backend service | 将 project override + global defaults 解析成 immutable snapshot | 这是 portability proof 的核心边界 |
| `image_factory.py` | Backend service | 给 image modality 补统一工厂入口 | text/video 已有工厂，image 缺位 |
| Provider snapshot schema | Backend schema/value object | 表达 resolved provider selection | 需要序列化到 run / WS / UI |
| Provider proof card / panel | Frontend component | 展示项目设置、本次 run snapshot、traceability | 当前 UI 没有 creator-visible provider evidence |

### Modified Components

| Component | Layer | Required Change |
|-----------|-------|-----------------|
| `backend/app/models/project.py` | Persistence | 新增项目级 provider override 字段 |
| `backend/app/schemas/project.py` | API contract | 新增 project provider DTO；必要时给 `ProjectRead` / `ProjectUpdate` 扩展字段 |
| `backend/app/api/v1/routes/projects.py` | API | 支持创建/更新/读取项目 provider 选择 |
| `backend/app/api/v1/routes/generation.py` | API | run 启动前强校验；创建并冻结 provider snapshot |
| `backend/app/models/agent_run.py` | Persistence | 增加 provider snapshot / trace 字段 |
| `backend/app/agents/orchestrator.py` | Runtime | 从 run snapshot 构造 agent context；resume 复用旧 snapshot |
| `backend/app/agents/base.py` | Runtime | `AgentContext` 带入 resolved provider data |
| `backend/app/orchestration/state.py` | LangGraph | runtime context 增加 provider snapshot |
| `backend/app/orchestration/runtime.py` | LangGraph | build runtime context 时注入 resolved providers |
| `backend/app/services/text_factory.py` | Provider integration | 不再只看 `settings.text_provider` |
| `backend/app/services/video_factory.py` | Provider integration | 不再只看 `settings.video_provider` |
| `backend/app/schemas/ws.py` | WS contract | `run_started` / `run_progress` / `project_updated` 增加 provider proof payload |
| `frontend/app/types/index.ts` | Frontend contract | 新增 project provider selection / run snapshot / trace 类型 |
| `frontend/app/services/api.ts` | Frontend API | create/update/get project provider 字段 |
| `frontend/app/pages/NewProjectPage.tsx` | Frontend UX | 在新建项目时允许选择 provider |
| `frontend/app/pages/ProjectPage.tsx` | Frontend UX | 展示 provider proof；支持编辑项目 provider |
| `frontend/app/hooks/useWebSocket.ts` | Frontend runtime | 接收 run snapshot / provider trace |
| `frontend/app/stores/editorStore.ts` | Frontend state | 保存项目 provider 设置、本次运行 snapshot、trace |

## Data Flow

### Recommended flow

```text
[Creator edits project provider settings]
    ↓
[Project API]
    ↓ validates provider keys against registry
[Project persistence]
    ↓ stores override or null (= inherit global)

[Creator clicks Generate / Resume / Rerun]
    ↓
[Generation API]
    ↓ loads project + global settings
[ProviderResolutionService]
    ↓ resolves effective text/image/video providers
[Strong validation]
    ↓ if invalid, fail before run starts
[AgentRun created with frozen provider_snapshot]
    ↓
[LangGraph runtime context / AgentContext]
    ↓
[text/image/video factories instantiate using snapshot]
    ↓
[Nodes execute and append provider trace]
    ↓
[WS + project page expose proof to creator]
```

### Resolution precedence

```text
run snapshot (for resume only)
    ↑
project override
    ↑
global default from Settings
```

### Important lifecycle split

#### Fresh run

```text
Project settings at T0
  → resolve providers
  → freeze snapshot on AgentRun
  → graph executes with snapshot
```

#### Resume existing run

```text
Existing AgentRun.provider_snapshot
  → reuse exactly
  → do NOT reread current project settings
  → resume graph/checkpoint with original provider context
```

#### New rerun / feedback run

```text
Current project settings
  → resolve again
  → create new AgentRun + new snapshot
  → preserve old artifacts' old provider trace
```

### Creator-visible proof flow

```text
Project GET
  → returns current provider overrides + effective summary

Run started
  → WS/API returns frozen provider_snapshot

Stage progress / output produced
  → append provider_trace summary

Project page / workspace
  → shows selected provider vs actual resolved provider vs output evidence
```

## Build Order

目标是**先把数据契约立住，再把运行时切过去，最后再把 UI 证据补上**，这样最不容易打断已上线主链路。

### 1. Persistence contract first

先做：

- `Project` provider override 字段
- `AgentRun` provider snapshot / trace 字段
- API / TS 类型扩展

**风险最低**，因为此时不改执行逻辑，只增加可空字段和读写能力。

### 2. Registry + validation in shadow mode

先加：

- `ProviderRegistry`
- `ProjectProviderValidationService`

先让生成接口在后台记录和验证，但暂时仍按旧工厂路径执行，便于先打通测试。

### 3. Runtime resolution + snapshot freeze

把 `Generation API -> ResolutionService -> AgentRun.snapshot` 接起来。

这个阶段开始，**fresh run** 已经具备真实 portability 证明能力，但 UI 还可以先不展示。

### 4. Factory wiring

修改：

- `text_factory`
- `image_factory`
- `video_factory`
- `AgentContext`
- orchestrator 注入方式

这一步才真正改变 provider 使用路径。

### 5. Resume semantics hardening

补强：

- resume 必须复用旧 snapshot
- feedback/rerun 必须新建 snapshot
- 增加回归测试，确保 mid-run 项目设置变化不会污染进行中的 run

### 6. Creator-visible proof / traceability

最后再上：

- 项目页 provider proof 卡片
- `run_started` / `run_progress` provider payload
- workspace 轻量 trace 展示

这样即使 UI 部分出现问题，也不会影响后端 portability 链路本身。

## Backward Compatibility

### Existing projects

- 旧项目的 provider override 字段默认为 `NULL`
- `NULL` 解释为“继承全局默认”
- 不需要强制数据回填脚本

### Existing runs

- 旧 `AgentRun` 没有 snapshot 时，UI 应显示：
  - `Provider proof unavailable (pre-v1.1 run)`
  - 或 `Global/default path (not snapshotted)`
- 不要伪造旧 run 的 provider trace

### Existing global config admin flow

- `SettingsModal` 继续存在，仍负责 admin/global 配置
- v1.1 不要把密钥/base_url 下放到项目层
- 项目层只选 provider key，避免把 secrets 复制到 `Project`

### Existing generation loop

- 如果项目没有 override，运行行为应与 v1.0 保持一致
- 如果 validation 失败，要在 run 启动前报错，不要在 graph 中途失败

### Resume / recovery compatibility

- v1.1 后创建的 run：resume 走 frozen snapshot
- v1.0 老 run：允许继续按旧行为恢复，但 UI 标注“legacy/untracked provider context”

### Migration concerns

| Concern | Risk | Mitigation |
|---------|------|------------|
| 项目中途改 provider 影响正在运行的任务 | 高 | 运行时一律使用 `AgentRun.provider_snapshot` |
| 管理员删除/改坏全局 provider 配置，导致旧项目失效 | 高 | 运行前强校验，并返回“项目选择存在但当前不可运行”的错误 |
| 前后端 provider key 字符串漂移 | 中 | 把可选 key 收敛到 `ProviderRegistry`，前端读取后端枚举/summary |
| image modality 目前没有真正多 provider 工厂 | 中 | 先补 `image_factory.py`，哪怕第一版只有一个实现 |
| 旧 run 没有 trace 数据 | 低 | UI 明确标 legacy，不做伪回填 |

## Recommendation

对 v1.1，最稳的架构决策是：

1. **项目只保存 provider override，不保存 secrets**
2. **run 启动时解析一次并冻结 snapshot**
3. **LangGraph / factories / resume 全部只认 snapshot**
4. **creator 看到的是“项目选择 + 本次运行实际解析结果 + 阶段证据”**

这样既能证明 project-scoped portability 真正贯穿全链路，又不会破坏 v1.0 已经交付的 idea-to-final-video 主流程。

## Sources

- 本地代码证据：
  - `backend/app/models/project.py`
  - `backend/app/schemas/project.py`
  - `backend/app/api/v1/routes/projects.py`
  - `backend/app/api/v1/routes/generation.py`
  - `backend/app/agents/orchestrator.py`
  - `backend/app/agents/base.py`
  - `backend/app/orchestration/state.py`
  - `backend/app/orchestration/runtime.py`
  - `backend/app/services/text_factory.py`
  - `backend/app/services/video_factory.py`
  - `frontend/app/pages/NewProjectPage.tsx`
  - `frontend/app/pages/ProjectPage.tsx`
  - `frontend/app/hooks/useWebSocket.ts`
  - `frontend/app/stores/editorStore.ts`
- LangGraph 官方资料：
  - `interrupt` reference：使用 `interrupt()` 必须启用 checkpointer，resume 通过 `Command(resume=...)`
  - LangGraph checkpoint README / persistence docs：`thread_id` 是持久化线程边界，checkpoint 可按 thread 恢复
- FastAPI 官方资料：dependency override/testing docs（用于后续 provider resolver / validation / run snapshot 注入测试策略）

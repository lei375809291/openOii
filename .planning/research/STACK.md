# Stack Research — v1.1 Provider Portability Proof

**Project:** openOii  
**Milestone:** v1.1 Provider Portability Proof  
**Researched:** 2026-04-17  
**Scope:** 只覆盖为“项目级 provider portability 端到端证明”新增或调整的栈，不重做已成立的 v1.0 主闭环。

## Summary

这次 milestone 不需要换框架。**FastAPI + React + LangGraph + Redis + Postgres 继续保留**，因为真正缺的不是基础设施，而是“provider 选择”在数据模型、解析链路、测试桩、可观测性上的闭环证据。

当前仓库的 provider 能力仍以**全局配置**为主：`backend/app/config.py` 里的 `text_provider` / `video_provider` 和 `frontend/app/components/settings/SettingsModal.tsx` 都是全局单例思路；`Project` 模型里没有项目级 provider 选择；LangGraph 运行时虽然有 `thread_id` 和 durable execution，但没有把“本次 run 究竟解析到了哪个 provider/profile”稳定落库并暴露出来。这正是 `PROJ-02` 只做到 partial 的根因。

对这个 milestone，最小且正确的方向是：

1. **保留现有全局配置作为默认值/兼容层**；
2. **新增“命名 provider profile + 项目级选择 + run 级快照”三层结构**；
3. **把工厂函数从直接读全局 `Settings`，演进为先 resolve 再实例化 provider client**；
4. **增加 deterministic mock provider 适配器 + HTTP mock 测试工具 + Playwright 证明链路**；
5. **补最小可观测性**：日志、trace、run snapshot 都要带 resolved provider 信息。

结论：**推荐演进，不推荐重写。**

---

## Recommended Changes

### 1) Backend application layer

| Area | Keep / Add / Change | Recommendation | Why |
|------|----------------------|----------------|-----|
| FastAPI | Keep | 继续作为 API shell | 现有项目/生成/配置路由已完整，provider portability 不需要换框架 |
| LangGraph | Keep | 继续作为执行与恢复主干 | 官方文档仍明确要求 durable execution 依赖 checkpointer + `thread_id`；这正适合 provider 解析后的 run 级快照与恢复 |
| Provider resolution layer | **Add** | 新增 `ProviderResolver` / `ProviderRegistry` / `ResolvedProviderSet` | 现在 `text_factory.py`、`video_factory.py` 直接读全局 `Settings`，无法证明“项目级选择 → 实际执行” |
| Mock providers | **Add** | 内置 `mock_text` / `mock_image` / `mock_video` provider 适配器 | 端到端 proof 不能依赖真实厂商网络；需要稳定、低成本、可断言的测试 provider |

**推荐实现方式：**

- 新增一个后端内部抽象层，而不是重写所有 service：
  - `ProviderProfile`：命名配置档案
  - `ProjectProviderSelection`：项目选择了哪个 profile
  - `ResolvedProviderSet`：某次 run 真正解析后的结果
- `GenerationOrchestrator` 在 run 开始前一次性 resolve，之后把 resolved set 注入 `AgentContext` / graph state。
- `text_factory.py`、`video_factory.py`、后续 image service 只接收 resolved provider，而不是自己直接读 `Settings`。

**为什么这是最小改法：**

- 不推翻现有 service；
- 不推翻 LangGraph；
- 只是把“provider 决策”从散落在 config/settings 中，提到一个可测试、可观测的边界层。

### 2) Storage changes

#### 2.1 Provider profiles：新增独立表，不复用 `config_item`

| Recommendation | Why |
|----------------|-----|
| **新增 `provider_profile` 表** | 现有 `config_item` 是全局平铺 key/value，适合单例配置，不适合“多个命名 profile 并存并被项目引用” |
| 字段建议：`id`, `slug`, `label`, `modality(text/image/video)`, `provider_kind`, `config_json`, `is_enabled`, `is_default`, `created_at`, `updated_at` | 命名 profile 是 provider swap 的基础；`config_json` 足够承载 OpenAI-compatible / Anthropic / Doubao 的差异参数 |
| 敏感值继续仅存后端数据库，不下发前端明文 | 当前仓库已有敏感值 mask/reveal 模式，可沿用 |

**建议不要**把项目级 provider 继续塞进 `config_item`，否则会得到：

- 单条 key 覆盖单条 key；
- 无法同时保存多组 profile；
- 无法做“项目 A 选 profile X，项目 B 选 profile Y”；
- 测试和审计都很难追。

#### 2.2 Project 级选择：加到 `project`，不要单独再造复杂关系层

| Recommendation | Why |
|----------------|-----|
| 在 `project` 上新增 `text_provider_profile_id` / `image_provider_profile_id` / `video_provider_profile_id` | 当前只有 3 个 modality，直接放到 `Project` 最简单，查询也最直接 |
| 可选补 `provider_selection_source` 或 `provider_selection_version` | 便于审计“显式项目选择”还是“继承默认值” |

这是比单独 `project_provider_selection` 表更合适的 v1.1 方案：字段少、读路径短、前后端都简单。

#### 2.3 Run 级快照：必须新增

| Recommendation | Why |
|----------------|-----|
| 在 `Run` 或现用的 `AgentRun` 上新增 `provider_snapshot_json` | 这是“证明链路”的核心证据：run 启动时到底解析到哪组 provider/profile/model |
| 快照中至少记录：`profile_id`, `provider_kind`, `model`, `base_url`, `selection_source(project/default)`, `resolved_at` | 仅记录 provider name 不够；要能解释为什么这次 run 用的是它 |
| 恢复/重跑默认复用原快照，而不是偷偷跟随最新项目配置 | 这样 resume 才 deterministic，符合 LangGraph durable execution 语义 |

**关键判断：**

- **项目配置**描述“未来新 run 应该默认选谁”；
- **run snapshot**描述“这次 run 实际用了谁”。

两者不能混用。

#### 2.4 类型选择

推荐：

- 继续用 SQLModel / SQLAlchemy 2.0；
- JSON 字段用 `JSON`，必要时给 PostgreSQL 配 `JSONB` variant；
- 迁移继续用现有 Alembic。

原因：SQLite 测试库仍需跑通，直接全量 PostgreSQL 专属类型会增加测试分叉成本。

### 3) Library changes

| Library | Keep / Add / Change | Recommendation | Why |
|--------|----------------------|----------------|-----|
| `fastapi`, `sqlmodel`, `sqlalchemy`, `langgraph`, `langgraph-checkpoint-postgres`, `redis` | Keep | 保持 | 不是这次问题根源 |
| `httpx` | Keep | 保持为 provider HTTP 客户端基座 | 当前仓库已在用，适合 OpenAI-compatible / provider profile 模式 |
| `pytest-httpx` | **Add** | 后端 provider 解析与出站请求 mocking 首选 | 官方文档直接针对 HTTPX，支持 async、请求匹配、回调、异常模拟，适合当前后端形态 |
| `structlog` | **Add** | 用于结构化 provider 选择日志 | milestone 需要“证明”，结构化日志比普通字符串日志更可查询 |
| `opentelemetry-instrumentation-fastapi` | **Add** | API trace 自动打点 | 官方文档支持直接 `FastAPIInstrumentor.instrument_app(app)` |
| `opentelemetry-instrumentation-httpx` | **Add** | provider 出站 HTTP trace | 官方文档支持 instrument all clients 或 single client，正好覆盖 provider 调用 |

**不建议新增**：

- Celery / Kafka / Temporal：这次不是任务系统问题；
- Vault / KMS：长期可做，但不是这次 portability proof 的最小闭环；
- 新 ORM / 新前端状态库：收益极低。

### 4) Frontend additions

| Area | Keep / Add / Change | Recommendation | Why |
|------|----------------------|----------------|-----|
| React + TanStack Query + Zustand | Keep | 保持 | 足够支撑项目级 provider selector |
| Global settings modal | Keep | 保留为 admin/default/provider profile 管理入口 | 不要删除已有全局配置能力 |
| Project create/edit form | **Add** | 增加 text/image/video provider profile 选择器 | 用户需要在项目层做 provider swap proof |
| Project workspace/run details | **Add** | 显示当前项目选择和本次 run resolved provider snapshot | 没有 UI 证据就很难证明 E2E portability |

**前端重点不是换栈，而是补两个界面能力：**

1. 项目级选择；
2. run 级显示“本次实际解析结果”。

### 5) Backend API changes

建议新增/调整的 API 面：

| API | Recommendation | Why |
|-----|----------------|-----|
| `GET/POST/PATCH /provider-profiles` | 新增 | 管理命名 provider profile |
| `POST /provider-profiles/{id}/test` | 新增 | 对 profile 做连接测试，不影响项目运行 |
| `POST /projects` / `PATCH /projects/{id}` | 扩展 payload | 持久化项目级 provider 选择 |
| `GET /projects/{id}` | 扩展返回 | 返回项目当前 provider profile 选择 |
| `POST /projects/{id}/generate` | 内部改造 | run 创建后立即 resolve + snapshot |
| `GET /projects/{id}/runs/{run_id}` 或复用现有 run surface | 扩展返回 | 暴露 provider snapshot 给前端和审计 |

### 6) Testing additions

这是本 milestone 最关键的新增栈。

#### 6.1 Backend

| Test layer | Tool | Recommendation |
|-----------|------|----------------|
| Unit | `pytest` | 测 `ProviderResolver` precedence：project explicit > project default > global default |
| Integration | `pytest` + `pytest-httpx` | 测 resolved profile 是否驱动正确的出站 URL / model / auth header |
| DB/API | 现有 async test stack | 测项目保存选择、run snapshot 落库、resume 复用 snapshot |

**必须补的断言：**

- 项目 A 和项目 B 同时存在时，各自 run 不串 provider；
- 项目改了 provider 后，**新 run** 用新配置，**旧 run/resume** 仍用旧 snapshot；
- 前端看到的 run snapshot 与后端实际出站请求一致；
- 未配置 profile / profile disabled / modality mismatch 会被明确阻止。

#### 6.2 Frontend

| Test layer | Tool | Recommendation |
|-----------|------|----------------|
| Component | Vitest + Testing Library + MSW | 测项目表单 provider selector、默认值、保存回显、run snapshot 展示 |
| Browser E2E | Playwright | 跑完整 proof：创建 profile → 创建项目 → 选 provider → 触发生成 → 查看 run/provider 证据 |

#### 6.3 End-to-end proof strategy

**推荐必须加入“mock provider profiles”作为正式验证路径。**

原因：

- 真厂商网络不稳定；
- 成本高；
- 速率限制会让 CI 偶发失败；
- portability 要证明的是“选择链路成立”，不是第三方平台 SLA。

所以最小正确方案是：

- `mock-text-a`, `mock-text-b`
- `mock-image-a`, `mock-image-b`
- `mock-video-a`, `mock-video-b`

它们返回带 provider identity 的 deterministic 响应/产物标记，让 Playwright 能直接断言页面里显示的 script/image/clip/final run metadata 来自预期 provider。

### 7) Observability additions

这次需要的不是“大而全监控平台”，而是**能证明选择链路的观测点**。

#### 必加

| Addition | Why |
|----------|-----|
| `structlog` 结构化日志 | 记录 `project_id`, `run_id`, `thread_id`, `modality`, `provider_profile_id`, `provider_kind`, `model`, `selection_source` |
| FastAPI OTEL | 看到 API 入口与 run 创建路径 |
| HTTPX OTEL | 看到真实 provider 出站调用走向 |
| Run snapshot API/UI 暴露 | 这是产品内可见证据，不是仅供开发排错 |

#### 推荐 trace/span attributes

- `openoii.project_id`
- `openoii.run_id`
- `openoii.thread_id`
- `openoii.provider.modality`
- `openoii.provider.profile_id`
- `openoii.provider.kind`
- `openoii.provider.model`
- `openoii.provider.selection_source`

#### 暂不需要

- Prometheus/Grafana 仪表盘扩容
- vendor cost analytics
- 多租户 billing metrics

这些都不影响 v1.1 portability proof。

---

## Keep As-Is

| Area | Keep | Reason |
|------|------|--------|
| FastAPI API shell | Yes | 路由层已稳定，问题不在框架 |
| React SPA | Yes | 只需加项目级 selector 和 run snapshot 展示 |
| LangGraph durable execution | Yes | 官方文档仍强调 checkpointer + `thread_id` 的 durable execution；与“run snapshot 固定化”天然契合 |
| PostgreSQL | Yes | 继续做 provider profiles / project selections / run snapshots 主存储 |
| Redis | Yes | 不需要为 portability 改消息基础设施 |
| WebSocket progress | Yes | 继续用于实时进度；只需补 provider resolution 相关 event 字段 |
| Alembic | Yes | 用现有迁移链路增加表/列即可 |
| Global config service | Yes, but reposition | 继续做“默认值/遗留兼容/敏感值管理”，不要再承担项目级切换 |

---

## Avoid

| Avoid | Why |
|------|-----|
| 继续用全局 `Settings` 直接决定每次 run provider | 这正是当前无法证明项目级 portability 的根因 |
| 把项目级 provider 选择继续塞进 `config_item` 平铺键值 | 无法表达多 profile 并存，也难做项目引用和审计 |
| 为这次 milestone 引入 Celery/Kafka/Temporal | 复杂度远超问题本身 |
| 为“安全正确”一次性引入 Vault/KMS | 长期可做，但会拖慢 proof milestone；当前仓库也未建立这一前提 |
| 前端本地缓存 provider secrets/profile config | 不安全，且会让 server-side proof 失真 |
| resume 时重新解析最新项目 provider 选择 | 会破坏 deterministic recovery，和 LangGraph durable execution 目标相冲突 |
| 为 image/video 再引入全新前端框架或状态管理 | 没有收益 |

---

## Validation Impact

### 这次新增栈如何直接支撑“proof”

1. **Provider profile table** 让系统能同时保存多组 provider，而不是单例覆盖。  
2. **Project-level selection fields** 让 creator 确实能在项目维度选择 provider。  
3. **Resolver + run snapshot** 让“选择结果”在 run 开始时被冻结并可审计。  
4. **Mock providers** 让 proof 可稳定、低成本、可重复。  
5. **pytest-httpx + Playwright** 让后端链路和真实 UI 链路都能被验证。  
6. **structlog + OTEL** 让日志/trace 与产品内展示互相印证。

### 最低可接受验收证据

#### Backend

- 项目创建/编辑可以持久化 text/image/video provider profile 选择；
- `generate` 时生成 run snapshot；
- provider factory 实际使用 snapshot 里的 resolved provider；
- `resume` 不漂移到新 provider；
- API 可返回 run snapshot。

#### Frontend

- 用户能在项目维度看到并修改 provider 选择；
- 运行后能看到“本次 run 实际解析到的 provider/profile/model”；
- 切换 provider 后重新运行，UI 可见差异。

#### Automated proof

- **Backend tests**：resolver precedence、snapshot immutability、HTTP outbound matching；
- **Frontend tests**：selector/save/render；
- **Playwright E2E**：同一项目切换 provider，第二次 run 的 artifact/run metadata 明确改变；
- **Observability**：日志或 trace 中可查到与 UI 一致的 provider 选择链路。

### Milestone recommendation

**v1.1 只做“provider portability proof 所需最小闭环”：**

- 新增命名 provider profiles；
- 新增项目级选择；
- 新增 run 级 snapshot；
- 新增 mock providers；
- 新增后端/前端/E2E 证明链路；
- 新增最小结构化观测。

**不要在 v1.1 顺手做：**

- provider marketplace
- 自动 fallback / routing optimizer
- 成本治理平台
- 多租户密钥管理系统

这些都属于后续里程碑，不属于“proof portability end-to-end”。

---

## Source Notes

- 本地代码证据：
  - `backend/app/config.py`：当前 provider 以全局 `Settings` 为主
  - `backend/app/services/text_factory.py` / `backend/app/services/video_factory.py`：当前工厂直接读全局 provider
  - `backend/app/models/project.py`：当前 `Project` 无 provider 选择字段
  - `backend/app/api/v1/routes/generation.py`：run 创建时未冻结 provider snapshot
  - `backend/app/orchestration/runtime.py`：已有 `thread_id` durable execution 基座
  - `frontend/app/components/settings/SettingsModal.tsx`：当前是全局配置 UI，不是项目级选择 UI
- 官方/当前资料：
  - LangGraph persistence / durable execution 官方文档：持久化依赖 checkpointer 与 `thread_id`，适合 run 级 deterministic snapshot
  - OpenTelemetry FastAPI instrumentation 官方文档：支持 `FastAPIInstrumentor.instrument_app(app)`
  - OpenTelemetry HTTPX instrumentation 官方文档：支持对所有或单个 `httpx` client 做 tracing
  - `pytest-httpx` 官方文档：支持 async HTTPX mocking、请求匹配、回调与异常模拟

**Confidence:** HIGH（主要结论来自本地代码结构 + 官方文档；LangGraph 官方页面通过搜索摘录验证，未直接依赖训练记忆）

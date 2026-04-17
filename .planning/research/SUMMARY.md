# Project Research Summary

**Project:** openOii
**Domain:** 独立创作者导向的 AI comic-drama 视频工作流；本次聚焦项目级 provider portability proof
**Researched:** 2026-04-17
**Confidence:** HIGH

## Executive Summary

v1.1 不是一次框架迁移，而是一次“证据链补齐”。现有 FastAPI + React + LangGraph + Redis + Postgres 主干已经足够，`PROJ-02` 没关掉的根因也不是基础设施不足，而是 provider 选择仍停留在全局配置思路：项目级选择没有成为一等数据，运行时没有冻结 snapshot，执行与 UI 之间缺少可审计证据。因此这次 milestone 的正确方向是**演进现有链路，而不是重写系统**。

最小可行闭环很明确：新增命名 provider profile、让 `Project` 保存 text/image/video 项目级选择、在 run 启动时解析并冻结 `provider_snapshot`、让 LangGraph/runtime/factory 只消费 snapshot、再把结果通过 API/UI/日志展示出来。这样才能证明“项目里选了谁，运行时就真用谁；resume 不漂移；rerun 才吃新配置”。

最大风险也同样清晰：如果只是补一个设置 UI，执行仍直接读全局 `Settings`，那会得到一个“看起来支持切换、实际上没证明 portability”的伪完成版本。规避方式不是加更多平台能力，而是守住三条硬约束：**project 选择是一等数据、run snapshot 不可变、无 silent fallback**。

## Key Findings

### Recommended Stack

本 milestone 不需要换主栈，只需要补 provider portability 所需的边界层、测试桩和最小观测。

**Core technologies / additions:**
- **FastAPI + React + LangGraph + Postgres + Redis**：继续保留主干 —— 问题不在框架，在 provider 决策边界没立住。
- **ProviderRegistry / ProviderResolver / ProviderValidationService**：新增 —— 把“选择谁、是否合法、实际解析成谁”从全局配置里抽出来。
- **Run snapshot (`provider_snapshot_json`)**：新增 —— 这是 PROJ-02 的核心证据，不可缺。
- **命名 `provider_profile` 表**：新增 —— 支撑多 profile 并存、项目引用、审计。
- **`pytest-httpx` + deterministic mock providers**：新增 —— 稳定证明后端选择链路与出站调用一致。
- **Playwright**：已有但这次必须用 —— 证明 creator 路径不是只在单元测试里成立。
- **structlog + OTEL FastAPI/HTTPX**：新增最小观测 —— 让 UI、日志、trace 三方互相印证。

**Critical stack decisions:**
- 保留全局配置，但降级为**默认值/凭证管理/兼容层**。
- 项目层只保存 provider 选择，不下放 secrets。
- resume 复用旧 snapshot；只有新 run / rerun 才重新 resolve。

### Expected Features

这次只做能关闭 `PROJ-02` 的 table stakes，不做 provider 平台化。

**Must have (table stakes):**
- 项目级 text / image / video provider 选择。
- 项目设置可持久化，刷新、重进、重跑后仍存在。
- 真实执行使用项目所选 provider，而不是全局默认。
- rerun 也遵守项目级选择；resume 遵守原 run snapshot。
- 不支持/未配置 provider 时明确阻断，不能 silent fallback。
- creator 或 operator 能看到本次 run 实际使用的 provider 证据。

**Should have (useful but not required to close PROJ-02):**
- provider bundle preset。
- provider capability hint。
- workspace 上更细的 provider lineage 展示。

**Defer (v2+):**
- 自动 fallback / cascading failover。
- per-shot / per-asset provider switching。
- cost/speed dashboard、provider comparison、bulk migration。
- BYOK/密钥体系重做、多租户权限模型。

### Architecture Approach

推荐架构是**global default → project override → immutable run snapshot** 三层链路。`Project` 保存显式 override；`Generation API` 在 fresh run 时 resolve 一次并冻结到 `AgentRun.provider_snapshot_json`；LangGraph runtime、AgentContext、text/image/video factory 只读 snapshot，不再直接把 `Settings` 当最终 truth；UI 同时展示项目当前选择与本次 run 实际解析结果。

**Major components:**
1. **Project provider persistence** —— 在 `Project` 上保存 text/image/video provider 选择，`NULL` 表示继承全局默认。
2. **Provider resolution boundary** —— `ProviderRegistry` / validation / resolution 负责合法性、能力校验、effective selection 解析。
3. **Run snapshot + runtime wiring** —— `AgentRun` 冻结 snapshot，LangGraph/runtime/factories 统一消费它。
4. **Provider proof surface** —— API、WebSocket、ProjectPage/ProviderProofCard 暴露项目设置、run snapshot、轻量 trace。

### Critical Pitfalls

1. **项目级 provider 只是全局 settings 的壳** —— 必须禁止执行层直接把全局 `Settings` 当最终 provider truth。
2. **resume 读取最新项目配置导致漂移** —— run 创建时冻结 snapshot；resume 只认旧 snapshot。
3. **没有 artifact/run lineage，导致无法证明** —— 至少 run 和关键阶段要带 provider metadata。
4. **silent fallback 掩盖错误** —— invalid / unsupported provider 组合要在 run 前明确失败。
5. **provider 变更后旧资产误复用** —— 需要最小 invalidation 规则，至少区分可复用与必须失效资产。

## Implications for Roadmap

基于研究，建议按“先立数据契约，再切执行路径，最后补 proof UI/E2E”的顺序做。这样最不容易破坏 v1.0 已交付的主闭环。

### Phase 1: Persistence & Contracts
**Rationale:** 先把 provider portability 变成一等数据，后续执行链路才有稳定输入。  
**Delivers:**
- `provider_profile` 表
- `Project` provider 选择字段
- `AgentRun.provider_snapshot_json` / trace 字段
- API / TS types 扩展
**Addresses:** 项目级选择、持久化、项目刷新后仍保留。  
**Avoids:** “只有 UI 设置，没有真实数据契约”的伪完成。

### Phase 2: Validation & Resolution
**Rationale:** 在改变执行路径前，先把 provider registry、capability preflight、resolution precedence 固定下来。  
**Delivers:**
- `ProviderRegistry`
- `ProjectProviderValidationService`
- `ProviderResolutionService`
- 保存时轻校验、运行前强校验
**Addresses:** unsupported/unavailable provider clear failure。  
**Avoids:** silent fallback、字段存在但不可运行、前后端 provider key 漂移。

### Phase 3: Runtime Snapshot Wiring
**Rationale:** 这是关闭 PROJ-02 的核心；必须让 fresh run、resume、rerun 的行为边界明确。  
**Delivers:**
- generate 时 resolve + freeze snapshot
- LangGraph runtime / AgentContext 注入 snapshot
- text/image/video factory 改为消费 resolved provider
- resume 复用旧 snapshot，新 rerun 生成新 snapshot
**Addresses:** 真正执行用项目所选 provider、rerun/resume 语义正确。  
**Avoids:** 同一 run provider 漂移、并发项目串线、恢复语义失真。

### Phase 4: Proof Surface, Mocking, and E2E Acceptance
**Rationale:** 没有 creator-visible 证据和自动化 proof，`PROJ-02` 仍然只能算 partial。  
**Delivers:**
- 项目页 provider proof 卡片
- run_started / run_progress provider payload
- mock text/image/video providers
- backend tests + Playwright proof chain
- structlog / OTEL 最小观测
**Addresses:** creator/operator 可验证、真实工作流 E2E 证明。  
**Avoids:** “代码看起来对，但没有审计证据”的里程碑失败。

### Phase Ordering Rationale

- **先 contract，后 runtime**：没有 `Project`/`AgentRun` 字段，后面无法稳定注入 LangGraph。
- **先 validation，后 factory 改造**：先锁定 resolution precedence 和 capability gating，避免执行层反复返工。
- **proof UI/E2E 放最后**：后端语义先稳定，前端证据面和验收链路才能一次到位。

### Research Flags

**Likely needs deeper planning/research:**
- **Phase 3:** resume / rerun / recovery 语义最敏感，需要逐条核对当前 LangGraph 同线程恢复路径。
- **Phase 4:** invalidation matrix 与 artifact lineage 粒度要定边界，否则容易扩 scope。

**Standard patterns / can plan directly:**
- **Phase 1:** SQLModel/SQLAlchemy 字段扩展、Alembic migration、API/TS contract 扩展都很标准。
- **Phase 2:** registry / validation / resolver 属于清晰的应用层边界，不依赖新框架。

## Minimum Proof Needed to Close PROJ-02

必须至少交出下面这条闭环证据：

1. 创建或打开一个真实项目。
2. 为 text / image / video 选择项目级 provider。
3. 保存并刷新，确认选择仍存在。
4. 触发真实生成，run 启动时生成并暴露 `provider_snapshot`。
5. 文本、图片、视频阶段都能证明实际调用了项目所选 provider。
6. 中途修改项目 provider：
   - **resume 旧 run** 仍使用旧 snapshot；
   - **新 rerun/new run** 使用新选择。
7. 至少证明一个 failure path：所选 provider 未配置、被禁用或 modality 不匹配时，系统明确阻断并提示原因，且不 silent fallback。
8. Playwright 或同等级 E2E 证据覆盖上述链路；日志/trace 与 UI 证据一致。

如果缺少其中任一项，`PROJ-02` 仍应视为 partial，而不是 complete。

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 结论主要来自现有仓库证据 + 官方文档；方向很收敛 |
| Features | HIGH | `PROJ-02` 目标明确，table stakes 边界清晰 |
| Architecture | HIGH | 当前代码集成点明确，build order 与依赖关系清楚 |
| Pitfalls | HIGH | 多数风险都能在现有 repo 结构里直接定位到成因 |

**Overall confidence:** HIGH

### Gaps to Address

- **Project 字段 vs 独立 selection 表**：研究更偏向直接挂 `Project`；若后续很快扩到更多 modality/多 profile 策略，再评估抽表。
- **Artifact lineage 最小粒度**：本 milestone 至少要 run snapshot + 关键阶段 trace；是否下沉到每类 artifact 记录需在 phase planning 明确定界。
- **invalidation matrix 范围**：建议只做最小可解释规则，不要把所有 provider 差异建成通用规则引擎。
- **mock provider 产物设计**：需要提前约定 deterministic 标记格式，保证 UI 与 E2E 易断言。

## Sources

### Primary
- `.planning/research/STACK.md`
- `.planning/research/FEATURES.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/PITFALLS.md`
- `.planning/PROJECT.md`
- `.planning/STATE.md`

### Supporting repo/official evidence referenced by the research docs
- `backend/app/config.py`
- `backend/app/models/project.py`
- `backend/app/models/agent_run.py`
- `backend/app/api/v1/routes/projects.py`
- `backend/app/api/v1/routes/generation.py`
- `backend/app/services/text_factory.py`
- `backend/app/services/video_factory.py`
- `backend/app/orchestration/runtime.py`
- LangGraph persistence / durable execution docs
- OpenTelemetry FastAPI / HTTPX instrumentation docs
- `pytest-httpx` docs

---
*Research completed: 2026-04-17*  
*Ready for milestone roadmap/scoping: yes*

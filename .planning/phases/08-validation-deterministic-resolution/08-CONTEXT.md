# Phase 08: Validation & Deterministic Resolution - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning
**Source:** User-provided discuss conclusions captured during `/gsd-plan-phase`

<domain>
## Phase Boundary

Phase 08 的核心不是补更多 UI 文案，而是先建立唯一、可复用、无 silent fallback 的 provider 解析合同，作为后续 runtime snapshot 与 proof/evidence phase 的前置基础。

本 phase 解决三类问题：
- 启动前 provider preflight 校验
- 确定性 provider resolution 规则
- 前端最小阻断面，确保 creator 在启动前就知道当前项目选择是否合法、将如何被解析

明确不在本 phase 解决：
- run snapshot 持久化
- run evidence / lineage UI
- 自动 fallback / 多级路由
- 真正接入 runtime 执行链路（该能力在后续 phase 落地，但本 phase 必须先把解析规则钉死）

</domain>

<decisions>
## Implementation Decisions

### Core Goal
- D-01: Phase 08 核心不是加 UI 提示，而是建立唯一且可复用的 provider 解析合同。

### Current Problems To Fix Around
- D-02: 当前项目页默认 provider 是写死值，不是运行时真实默认。
- D-03: generate 前没有 provider preflight。
- D-04: text/video factory 存在 silent fallback。
- D-05: 项目级 provider override 还没进入真实执行路径；这一点最终在后续 phase 落地，但 Phase 08 必须先把解析规则定死。

### Scope Boundary
- D-06: In scope 仅包括：启动前校验、确定性解析规则、前端最小阻断面。
- D-07: Out of scope 包括：run snapshot 持久化、run evidence/lineage UI、自动 fallback/多级路由、真正接入 runtime 执行链路。

### Resolution Contract
- D-08: 新增统一 provider resolution 服务。
- D-09: resolution 服务输入必须包括项目 override、runtime settings、capability matrix。
- D-10: resolution 服务输出必须按 modality 返回 `selected_key`、`source`、`resolved_key`、`valid`、`reason_code`、`reason_message`。

### Resolution Principles
- D-11: 不允许 silent fallback。
- D-12: 解析失败时 `resolved_key = null`。
- D-13: 默认值必须来自当前真实配置，不是 schema/front-end 常量。
- D-14: 校验发生在 start-time，不是 save-time。

### Capability Matrix
- D-15: capability matrix 建议固定为：`text: anthropic, openai`。
- D-16: capability matrix 建议固定为：`image: openai`。
- D-17: capability matrix 建议固定为：`video: openai, doubao`。
- D-18: merge 不进入 provider 解析。

### Planning Shape
- D-19: 推荐拆分为 3 个计划：
  1. `08-01`：收敛 provider 解析真相（resolver + factory 行为 + projects route/default 语义）
  2. `08-02`：在 generate 前接入 preflight（保留 409 active/recoverable 优先，provider invalid 返回结构化 422）
  3. `08-03`：前端最小阻断面（项目页显示真实解析结果，invalid 时禁用生成）

### Known Mismatch
- D-20: 已知默认值不一致点必须纳入规划和修复范围：`frontend/app/components/settings/SettingsModal.tsx` 与 `backend/app/config.py` 的视频默认语义需要统一。

### Test Priorities
- D-21: 测试必须覆盖 resolver 默认值来自 runtime settings。
- D-22: 测试必须覆盖 invalid provider / 缺失关键 key 时 invalid。
- D-23: 测试必须覆盖 same input -> same output 的确定性。
- D-24: 测试必须覆盖 `POST generate` invalid -> `422`；active/recoverable 优先 `409`；invalid 不创建 run。
- D-25: 测试必须覆盖前端 invalid 时禁用按钮，且展示值来自后端返回。

### the agent's Discretion
- resolver 的具体模块位置、命名、内部 helper 拆分方式
- structured `reason_code` 的枚举粒度，只要能稳定支撑前端阻断与测试断言
- preflight 响应结构中除 D-10 指定字段之外的辅助字段

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning / milestone docs
- `.planning/ROADMAP.md` — Phase 08 goal, dependencies, success criteria, requirement mapping
- `.planning/REQUIREMENTS.md` — `VAL-01`, `VAL-02` exact requirement wording and out-of-scope guardrails
- `.planning/STATE.md` — current blockers and carry-forward concerns (`silent fallback risk`, `snapshot drift risk`, scope guardrails)

### Prior phase outputs
- `.planning/phases/07-project-provider-contracts/07-03-SUMMARY.md` — provider_settings 已成为项目页 proof surface 与编辑态共享读来源；Phase 08 需在此合同上继续收敛真实解析结果

### Known code references called out by user
- `frontend/app/components/settings/SettingsModal.tsx` — 前端视频默认语义已知不一致点
- `backend/app/config.py` — 后端 runtime 默认 provider 语义来源

</canonical_refs>

<specifics>
## Specific Ideas

- resolver 是本 phase 的中心，不是附属工具。
- projects route / defaults 语义必须与 resolver 对齐，避免项目页展示与真实默认值分叉。
- generate preflight 需保持当前 active/recoverable 检查优先级：若已有 409 路径，provider invalid 不能抢占它。
- 前端只做最小阻断面：展示后端解析结果、invalid 时禁用生成，不扩展到 lineage/proof UI。

</specifics>

<deferred>
## Deferred Ideas

- run snapshot 持久化
- run evidence / lineage UI
- 自动 fallback / 多级路由
- 真正接入 runtime 执行链路

</deferred>

---

*Phase: 08-validation-deterministic-resolution*
*Context gathered: 2026-04-18 via inline user decisions during plan-phase*

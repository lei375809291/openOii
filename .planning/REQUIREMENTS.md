# Requirements: v1.1 Provider Portability Proof

## Milestone Goal

Close `PROJ-02` by proving that project-scoped provider selection survives persistence, drives real execution, preserves resume semantics, updates rerun/new-run semantics correctly, and is backed by creator-visible plus automated evidence.

## v1.1 Requirements

### Project Provider Configuration

- [ ] **PROV-01**: 创作者可以为单个项目分别选择 text / image / video provider。
- [ ] **PROV-02**: 创作者保存项目后，再次打开或刷新时仍能看到相同的 provider 选择。
- [ ] **PROV-03**: 创作者可以明确区分某个项目是在使用项目级 provider，还是继承默认 provider。

### Validation & Resolution

- [x] **VAL-01**: 创作者在启动生成前，如果所选 provider 未配置、被禁用或不支持对应 modality / stage，会收到明确阻断与原因说明。
- [x] **VAL-02**: 系统对项目级 provider 选择采用确定性的解析规则，不会静默退回别的 provider。

### Runtime Snapshot Semantics

- [ ] **RUN-01**: 创作者启动新 run 时，系统实际使用该项目保存的 provider 选择，并把解析结果冻结到该 run。
- [ ] **RUN-02**: 创作者恢复已有 run 时，即使项目 provider 之后被修改，恢复流程仍使用原 run 的 provider snapshot。
- [ ] **RUN-03**: 创作者在修改项目 provider 后发起新的 rerun / new run 时，新执行使用更新后的 provider 选择。
- [ ] **RUN-04**: 创作者不会遇到“UI 选了 A、运行却偷偷用了 B”的 silent fallback 行为。

### Proof Surface & Acceptance

- [ ] **PROOF-01**: 创作者在启动 run 前，可以在项目界面看到当前项目将使用的 provider 选择。
- [ ] **PROOF-02**: 创作者或 operator 可以看到某次 run 实际解析并使用了哪些 provider。
- [ ] **PROOF-03**: 团队有自动化验证覆盖 save/reload、fresh run、resume、rerun、invalid selection failure 这条闭环。
- [ ] **PROOF-04**: 团队可以用 deterministic mock provider 或同等级稳定证据证明 text / image / video 路由按项目选择生效。

## Future Requirements

- Provider bundle presets（如 fast / quality）
- Provider capability hints / guidance
- 更细粒度的 workspace artifact provider lineage
- cost / speed comparison and analytics

## Out of Scope

- 自动 fallback / cascading failover
- per-shot / per-asset provider switching
- BYOK / 密钥体系重做
- 多用户 provider 权限模型
- 跨项目批量迁移工具
- 通用 provider routing 规则引擎

## Traceability

| Requirement | Phase |
|-------------|-------|
| PROV-01 | Phase 07 |
| PROV-02 | Phase 07 |
| PROV-03 | Phase 07 |
| VAL-01 | Phase 08 |
| VAL-02 | Phase 08 |
| RUN-01 | Phase 09 |
| RUN-02 | Phase 09 |
| RUN-03 | Phase 09 |
| RUN-04 | Phase 09 |
| PROOF-01 | Phase 10 |
| PROOF-02 | Phase 10 |
| PROOF-03 | Phase 10 |
| PROOF-04 | Phase 10 |

---
*Created: 2026-04-17 for milestone v1.1*

# Roadmap: openOii

## Milestones

- [x] **v1.0** — Guided, resumable, creator-controlled “idea → final video” loop shipped with one deferred portability warning (`PROJ-02`). See `.planning/milestones/v1.0-ROADMAP.md`.
- [ ] **v1.1** — Provider Portability Proof.

## Current Milestone

**Milestone:** v1.1  
**Goal:** 补齐项目级 provider portability proof，证明项目保存的 text / image / video provider 选择会被真实执行消费，并在 fresh run、resume、rerun/new run 中保持正确语义，同时补齐直接相关的 proof surface 与自动化证据。
**Granularity:** standard
**Coverage:** 13/13 requirements mapped

## Phases

- [ ] **Phase 07: Project Provider Contracts** - 让项目级 provider 选择成为可保存、可刷新、可区分来源的一等数据。
- [ ] **Phase 08: Validation & Deterministic Resolution** - 在运行前明确校验 provider 可用性，并锁定无 silent fallback 的解析规则。
- [ ] **Phase 09: Runtime Snapshot Semantics** - 让 fresh run、resume、rerun/new run 都按明确的 provider snapshot 语义执行。
- [ ] **Phase 10: Proof Surface & Acceptance Evidence** - 提供 creator/operator 可见证据与自动化闭环，证明项目级 provider 路由真实生效。

## Phase Details

### Phase 07: Project Provider Contracts
**Goal**: 创作者可以在单个项目上设置、保存并重新看到 text / image / video provider 选择，而且能明确区分项目 override 与默认继承。
**Depends on**: Nothing
**Requirements**: PROV-01, PROV-02, PROV-03
**Success Criteria** (what must be TRUE):
  1. 创作者可以在同一个项目里分别查看和设置 text、image、video 的 provider 选择。
  2. 创作者保存项目设置后，刷新页面或重新进入项目时，看到的 provider 选择与保存时一致。
  3. 创作者可以明确看出某个 modality 当前是项目级 override，还是仍在继承默认 provider。
**Plans**: TBD
**UI hint**: yes

### Phase 08: Validation & Deterministic Resolution
**Goal**: 创作者在启动执行前就能知道当前项目 provider 选择是否合法、可用且会被如何解析，不会遇到 silent fallback。
**Depends on**: Phase 07
**Requirements**: VAL-01, VAL-02
**Success Criteria** (what must be TRUE):
  1. 当项目选择了未配置、被禁用或不支持对应 modality / stage 的 provider 时，创作者在启动前会被明确阻断，并看到具体原因。
  2. 当项目 provider 选择可用时，系统对 effective provider 的解析结果是确定且可复现的，不会在相同输入下出现不同结果。
  3. 创作者不会遇到界面显示一个 provider、系统却在启动时静默换成另一个 provider 的情况。
**Plans**: TBD
**UI hint**: yes

### Phase 09: Runtime Snapshot Semantics
**Goal**: 每次执行都会按明确的 provider snapshot 语义运行：fresh run 冻结当前项目选择，resume 复用旧 snapshot，rerun / new run 才采纳更新后的项目选择。
**Depends on**: Phase 08
**Requirements**: RUN-01, RUN-02, RUN-03, RUN-04
**Success Criteria** (what must be TRUE):
  1. 创作者发起 fresh run 时，该次 run 会冻结并使用项目当时保存的 provider 解析结果。
  2. 创作者修改项目 provider 后再恢复旧 run，恢复流程仍沿用旧 run 原先冻结的 provider snapshot。
  3. 创作者修改项目 provider 后发起 rerun 或新的 run，新执行会使用更新后的 provider 选择而不是旧 snapshot。
  4. 创作者可以基于 run 结果确认“当时解析了什么 provider、运行时就用了什么 provider”，不存在 UI 选 A、执行偷偷用 B 的情况。
**Plans**: TBD

### Phase 10: Proof Surface & Acceptance Evidence
**Goal**: creator 和 operator 都能看到项目 provider 选择与 run 实际使用 provider 的证据，并有自动化链路证明 text / image / video 路由按项目选择生效。
**Depends on**: Phase 09
**Requirements**: PROOF-01, PROOF-02, PROOF-03, PROOF-04
**Success Criteria** (what must be TRUE):
  1. 创作者在启动 run 前，可以在项目界面看到当前项目将使用的 text / image / video provider 选择。
  2. 创作者或 operator 可以查看某次 run 实际解析并使用了哪些 provider。
  3. 团队可以运行自动化验证，覆盖 save/reload、fresh run、resume、rerun、invalid selection failure 这条闭环。
  4. 团队可以用 deterministic mock provider 或同等级稳定证据，证明 text / image / video 三类调用都按项目选择路由。
**Plans**: TBD
**UI hint**: yes

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 07. Project Provider Contracts | 0/TBD | Not started | - |
| 08. Validation & Deterministic Resolution | 0/TBD | Not started | - |
| 09. Runtime Snapshot Semantics | 0/TBD | Not started | - |
| 10. Proof Surface & Acceptance Evidence | 0/TBD | Not started | - |

# Domain Pitfalls — v1.1 Provider Portability Proof

**Domain:** 项目级 provider portability（text / image / video）在长运行、可恢复创作流水线中的集成风险  
**Researched:** 2026-04-17  
**Confidence:** HIGH（以当前仓库实现证据为主，结合既有 LangGraph 研究结论）

## Critical Pitfalls

### 1. 把“项目级 provider”做成了“全局 settings 的另一层皮”

**What goes wrong**  
UI 允许按项目选 provider，但实际执行仍从全局 `Settings` 读取，导致项目 A 改配置后影响项目 B，或者“项目显示 A provider，运行实际用 B provider”。

**Why dangerous**  
这是 v1.1 最容易“看起来做完了、实际上没打通”的失败方式。它会直接击穿 `PROJ-02` 的证明目标。

**Repo evidence**  
- 当前 provider 选择主要仍在全局配置：`backend/app/config.py:55`, `backend/app/config.py:158`  
- 工厂直接读 `Settings`：`backend/app/services/text_factory.py:17`, `backend/app/services/video_factory.py:50`  
- `Project` 模型目前没有 provider 字段：`backend/app/models/project.py:13`

**How to prevent**  
- 把 provider 选择拆成三层且只允许一条“生效链”：**global capability/default → project selection → run snapshot**。  
- 执行入口不得直接把全局 `Settings` 当成最终 provider truth；必须先解析出 project-level effective provider config，再传给 provider adapter。  
- 明确禁止“无 project snapshot 的 provider 调用”。

**Must become requirement / success criteria**  
- **Requirement:** 每次生成都必须能从 `project_id` 推导出唯一的 text/image/video effective provider。  
- **Success criterion:** 同一实例中两个项目使用不同 provider 并行运行时，互不串线。

---

### 2. 运行中或恢复时读取“最新配置”，导致同一 run 前后 provider 漂移

**What goes wrong**  
run 开始时用 provider A，用户随后修改项目配置为 provider B；之后恢复/重试时系统读到了新配置，于是同一 `thread_id` 下的后续节点改用 provider B。

**Why dangerous**  
这会破坏同一 run 的可重放性和可解释性，造成“恢复不是恢复，而是半切换”。

**Repo evidence**  
- 恢复依赖同一 run / same-thread：`backend/app/api/v1/routes/generation.py:126`, `backend/app/agents/orchestrator.py:590`  
- `thread_id` 由 run 身份导出，但没有看到 provider snapshot 参与 recovery config：`backend/app/orchestration/runtime.py:10`, `backend/app/services/run_recovery.py:48`

**How to prevent**  
- 在 **run 创建时冻结 provider snapshot**（provider 名、模型、endpoint、关键 capability flags、凭据引用 ID/别名，但不存明文 secret）。  
- resume / retry / review-triggered rerun 默认继续使用 **run snapshot**，不是“项目当前值”。  
- 只有“显式新建 run”才允许使用新的 project provider 选择。

**Must become requirement / success criteria**  
- **Requirement:** run 的 provider snapshot 不可变。  
- **Success criterion:** run 开始后即使项目 provider 被改，resume 仍使用原 snapshot，且 UI 明确显示“当前 run 使用旧配置”。

---

### 3. 没有把 provider 信息写进 artifact / lineage，导致混合产物无法审计

**What goes wrong**  
最终能生成图、视频，但没人知道某个角色图、某个 clip、某个 final merge 分别来自哪个 provider / model / 参数组合。

**Why dangerous**  
v1.1 的目标不是“能切换一下”，而是“provider portability 闭环可证明”。没有 lineage 元数据，就无法证明，也无法 debug。

**How to prevent**  
- 每个 artifact 必须记录：provider kind、provider name、model、run_id、stage、parent artifact、snapshot hash/version。  
- final merge 必须可追溯到参与合成的 clip provider 元数据。  
- workspace / review API 至少暴露“当前成品来自哪个 provider”。

**Must become requirement / success criteria**  
- **Requirement:** provider metadata 是 artifact contract 的一部分，不是日志附加信息。  
- **Success criterion:** 给定任一当前 artifact，API 能返回其 provider lineage。

---

### 4. provider-specific 参数直接渗进通用领域模型，导致切换时到处炸

**What goes wrong**  
为支持某个 provider 的特殊字段，直接把该字段塞进项目、shot、artifact 或前端表单主模型；后续切换到别的 provider 时，这些字段要么失效、要么污染通用流程。

**Why dangerous**  
看似是“适配更快”，实际上会把 portability 变成 provider-specific branching 地狱。

**Repo evidence**  
- 当前已经存在视频 provider 特有参数，如 `doubao_*` 与 `video_image_mode`：`backend/app/config.py:128-160`  
- 工厂分支也已经按 provider 特判：`backend/app/services/video_factory.py:59-67`

**How to prevent**  
- 保持两层模型：**canonical generation contract**（通用）与 **provider adapter params**（私有）。  
- 项目/运行层只保存通用选择与 capability；provider-specific payload 在 adapter 内部映射。  
- 任何新增 provider-specific 字段，先回答：它是“业务概念”还是“适配细节”？后者不得进入核心域模型。

**Must become requirement / success criteria**  
- **Requirement:** 核心 project/run/artifact schema 不得依赖单一 provider 私有字段完成主流程。  
- **Success criterion:** 切换 video provider 时，不需要迁移 shot/project 主模型语义。

---

### 5. provider 切换后没有做兼容性校验与失效传播，导致旧资产被新 provider 误复用

**What goes wrong**  
项目从 provider A 切到 provider B 后，系统继续拿 A 产出的参考图、clip job token、merge 输入、参数假设给 B 用，结果是 silent corruption、莫名失败或质量大幅下降。

**Why dangerous**  
这是典型的数据一致性坑：系统没崩，但结果不可信。

**How to prevent**  
- 定义“切换 provider 后哪些资产仍兼容、哪些必须失效”。  
- 至少区分三类：  
  1. **可复用**：纯文本脚本、审核状态。  
  2. **条件复用**：storyboard/参考图，需满足 adapter 声明的 capability。  
  3. **必须失效**：provider-issued job IDs、polling handles、provider-specific media references。  
- provider 变更后触发明确的 downstream invalidation 规则，而不是隐式继续跑。

**Must become requirement / success criteria**  
- **Requirement:** provider 变更必须定义 invalidation matrix。  
- **Success criterion:** 切换 provider 后，系统明确标记哪些当前资产过期、哪些可保留。

---

### 6. replay / resume 前的 side effects 不可幂等，切 provider 时生成重复产物或重复扣费

**What goes wrong**  
节点在 checkpoint 前已经发起外部 provider 调用；恢复时节点 replay，再调一次 provider，生成重复 artifact、重复任务、重复计费。provider 切换会让这个问题更隐蔽，因为重复结果可能还来自不同 provider。

**Why dangerous**  
这同时打击成本、数据一致性和用户信任。

**Repo evidence**  
- 当前系统强依赖 LangGraph durable execution / same-thread resume；既有 v1.0 研究已把“replay side effects”列为关键风险。  
- 本仓库恢复路径已建立，但 provider snapshot / idempotency key 尚未与之绑定：`backend/app/agents/orchestrator.py:643-668`

**How to prevent**  
- 所有外部 provider 调用都要有 **idempotency key**，建议包含：`run_id + stage + resource_scope + provider_snapshot_hash + attempt_kind`。  
- checkpoint 前只做可重放的状态准备；真正 side effect 尽量放到可判重边界后。  
- artifact 注册必须是 upsert / unique constrained，而不是盲目 insert。

**Must become requirement / success criteria**  
- **Requirement:** provider side effects 对 replay 安全。  
- **Success criterion:** 对同一失败点连续 resume 两次，不产生重复 provider job 或重复 artifact。

---

### 7. UX 没有讲清楚“项目默认值 / 当前 run snapshot / 当前 artifact 来源”三者区别

**What goes wrong**  
用户在设置页改了 provider，项目页显示已切换，但当前运行还在用旧 provider；workspace 里只看到“Generating…”，不知道到底哪个资产来自哪个 provider，于是误以为系统没生效或乱生效。

**Why dangerous**  
v1.1 的失败不一定是后端错，也可能是“后端对、用户完全看不懂”。这会直接让 portability proof 失去说服力。

**How to prevent**  
- UI 至少同时显示：  
  - **Project default providers**  
  - **Active run providers (snapshot)**  
  - **Artifact source provider**  
- provider 变更后，如果存在可恢复/运行中的旧 run，必须给出明确文案：**“新配置只影响新的 run”** 或 **“需要新建 run 才会生效”**。  
- review / rerun 入口要明确：这是“继续旧 run”还是“按当前项目配置新开 run”。

**Must become requirement / success criteria**  
- **Requirement:** creator 能区分当前项目配置与当前运行实际使用配置。  
- **Success criterion:** 关键 UI 面上无“切换已保存但不知道何时生效”的歧义。

---

### 8. 配置验证只验证“字段存在”，不验证 provider capability 与凭据可用性

**What goes wrong**  
项目允许选择某 provider，但该 provider 没有可用 key、缺少必须模型、或不支持当前所需模式（如 image-to-video）；真正到运行中途才炸。

**Why dangerous**  
这类错误会被用户感知为“切换 provider 以后整条流水线不稳定”。

**Repo evidence**  
- 当前已有 config surface 和连接测试，但主要围绕全局配置优先级/遮罩：`backend/tests/test_api/test_config.py:287-353`  
- 还没有看到“项目选择某 provider 时的 capability gating”证据。

**How to prevent**  
- project save/start run 前做 **effective provider preflight**：凭据存在、模型存在、能力满足阶段需求。  
- 区分 text/image/video provider 的校验，不要只测一个总开关。  
- 对不支持的组合，在 UI 和 API 都返回结构化错误，而不是在运行深处失败。

**Must become requirement / success criteria**  
- **Requirement:** run 启动前必须完成 provider preflight。  
- **Success criterion:** 缺 key / 不支持能力的 provider 组合无法进入正式 run。

---

### 9. 并发与恢复控制没有绑定 provider snapshot，导致错误恢复到不兼容状态

**What goes wrong**  
项目已有 active run 或 recoverable run，但系统只按 run 状态拦截，没有把 provider snapshot mismatch 纳入控制；用户可能在“旧 snapshot 可恢复”的情况下又尝试用“新 project provider”继续，最终出现恢复分叉。

**Why dangerous**  
这会在同一项目里制造多套“都像 current 的 truth”。

**How to prevent**  
- recovery control surface 不只显示 `thread_id`，还要显示 provider snapshot 摘要。  
- 当项目配置已变化且存在 recoverable run 时，必须要求用户显式二选一：  
  1. 恢复旧 run（旧 provider snapshot）  
  2. 取消旧 run 并按新配置新开 run  
- 禁止“默默继续”。

**Must become requirement / success criteria**  
- **Requirement:** recoverable run 与当前 project config 不一致时，系统必须阻止隐式恢复。  
- **Success criterion:** 所有恢复决策都可从 API payload 和 UI 文案追溯。

---

### 10. 只测了配置页与单元测试，没有测真实 creator 路径，最后里程碑仍然“未证明”

**What goes wrong**  
测试都通过了：配置能保存、工厂能选 provider、某些 mock 调用能跑；但没有覆盖“创建项目 → 选择 provider → 开跑 → 中断 → resume → rerun → 查看 artifact 来源”的真实闭环。

**Why dangerous**  
这正是 v1.0 留下的 deferred warning 形态。v1.1 如果继续只补局部测试，审计结论不会变。

**How to prevent**  
- 至少新增一条 milestone 级集成验收链路：  
  1. 项目设置 text/image/video provider  
  2. 启动 run，验证实际 adapter 选择  
  3. 中途改项目 provider  
  4. resume 旧 run，验证仍用旧 snapshot  
  5. 新建 run，验证使用新 provider  
  6. artifact / workspace 可见 provider lineage  
- 这条链路必须进成功标准，而不是“建议补测”。

**Must become requirement / success criteria**  
- **Requirement:** milestone 完成必须有 provider portability E2E proof。  
- **Success criterion:** 审计材料能明确回答“项目级 provider selection 是否真的贯通到执行与恢复”。

## Why They Happen

| Root Cause | 在本仓库里的具体表现 | 导致的 pitfall |
|---|---|---|
| 现有实现以全局配置为中心 | `Settings` + provider factory 已经存在，最容易被复用成“伪项目级配置” | 1, 2, 8 |
| v1.0 已有 durable resume，但 provider snapshot 尚未进入 run contract | same-thread resume 已建立，新增 portability 时若不冻结 snapshot 就会漂移 | 2, 6, 9 |
| 领域模型还没有 provider portability 的一等字段 | `Project` / `ProjectRead` 当前无 provider 选择与 lineage 字段 | 1, 3, 7 |
| provider 适配差异真实存在 | `doubao_*` 等 provider-specific 参数已出现 | 4, 5 |
| 审计目标是“证明闭环”，不是“多几个 if/else” | 仅做局部 wiring 无法消除 `PROJ-02` deferred warning | 10 |

## Prevention Strategy

### 1. Data model / contract

- 给 `Project` 增加项目级 provider selection（text/image/video）。
- 给 `Run` 或当前实际执行 run 模型增加 **immutable provider snapshot**。
- 给 artifact / stage metadata 增加 provider lineage 字段。
- 不存 provider secret 明文快照；只存 provider 名、模型、endpoint、capability、secret reference。

### 2. Execution / resume

- 所有 provider adapter 调用从 **effective provider resolver** 获取配置，不直接读全局 `Settings` 作为最终值。
- `generate` 冻结 snapshot；`resume` 读取 run snapshot；`new run` 才读取 project current config。
- provider side effects 增加 idempotency key 与唯一约束。
- provider 变更时执行明确 invalidation matrix。

### 3. UX / control surface

- 在项目设置、运行控制、workspace artifact card 三处显示 provider 来源。
- 有 recoverable run 且 project config 已变化时，强制用户选择“恢复旧 run”或“按新配置新开 run”。
- 明确提示 provider 切换的生效边界：**对当前 run 不生效 / 对新 run 生效**。

### 4. Validation / testing

- 保存项目配置时做 provider capability preflight。 
- 新增 milestone 级 E2E：project selection → execution → interruption → resume → new run after switch → lineage visibility。
- 回归测试必须覆盖并发项目使用不同 provider 的隔离性。

## Requirement Implications

以下内容应从“实现建议”提升为 **显式 requirement 或 success criteria**：

### Must be explicit requirements

1. **Project-scoped provider selection is first-class data**, not derived UI state.  
2. **Each run stores an immutable provider snapshot** used for execution and resume.  
3. **Resume always reuses the original run snapshot**, never silently switching to current project config.  
4. **Artifacts expose provider lineage** sufficient for audit/debug.  
5. **Provider changes trigger defined invalidation rules** for downstream assets.  
6. **Unsupported / unconfigured provider selections are blocked before run start**.

### Must be explicit success criteria

1. 两个项目可在同一环境下使用不同 provider 并行运行，执行结果不串线。  
2. run 开始后修改项目 provider，再 resume 旧 run，实际 provider 不变。  
3. 修改项目 provider 后新开 run，实际 provider 改为新选择。  
4. 当前 artifact 与 final output 可追溯其 provider 来源。  
5. provider 变更后的 UI 文案能让 creator 明白“何时生效、影响哪些资产”。  
6. 审计文档能够把 `PROJ-02` 从“partial / deferred warning”升级为“end-to-end proven”。

## Sources

- `.planning/PROJECT.md` — v1.1 goal, active requirement, milestone constraints
- `.planning/STATE.md` — current milestone state and carry-forward concerns
- `.planning/MILESTONE-AUDIT.md` — `PROJ-02` currently partial / deferred warning
- `.planning/milestones/v1.0-REQUIREMENTS.md` — original portability requirement outcome
- `backend/app/config.py` — current global provider configuration surface
- `backend/app/services/text_factory.py` — text provider chosen from global settings
- `backend/app/services/video_factory.py` — video provider chosen from global settings
- `backend/app/models/project.py` — current project model lacks provider fields
- `backend/app/api/v1/routes/generation.py` — generate/resume control flow
- `backend/app/orchestration/runtime.py` — thread/recovery config source
- `backend/app/agents/orchestrator.py` — same-thread resume path
- `backend/app/services/run_recovery.py` — recovery summary derived from run/thread only
- `backend/tests/test_api/test_config.py` — current provider coverage is config-surface centric, not project-E2E

# openOii

## What This Is

openOii is an AI Agent-based creative platform for independent creators that turns a raw story idea into a finished comic-drama video through a coordinated workflow spanning story setup, direction, script generation, character design, storyboard generation, clip generation, review, and final assembly.

This initialization does **not** treat the current repository as the final product contract. The repo is a strong reference implementation, but the project is being re-scoped around a clearer v1 goal: a reliable, guided, end-to-end “idea to final video” loop.

## Core Value

An independent creator can go from a raw story idea to a coherent final video in one guided, resumable workflow.

## Current Milestone: v1.1 Provider Portability Proof

**Goal:** 补齐 `PROJ-02`，让项目级 provider 配置/切换在真实 creator 工作流里端到端成立，并把与该闭环直接相关的规划文档漂移一起收口。

**Target features:**
- 项目级 text / image / video provider 配置或切换路径可用
- 从项目配置到实际生成执行的 provider 选择链路可验证
- 修复与 provider portability 闭环直接相关的文档 / 审计漂移

## Requirements

### Validated

- [x] The system can orchestrate multiple AI roles and tools to produce script, characters, storyboards, video clips, and a merged final video with resumable progress. — Validated in Phase 02 (LangGraph durable execution, stage-level recovery, same-thread resume control).
- [x] The workspace can present script, character, storyboard, and video artifacts with clear status, previewability, and lineage across the generation flow. — Validated in Phase 03 for character/storyboard approval state, shot-bound cast, current approved/superseded visibility, and canvas review controls.
- [x] A creator can start a project from a story idea and style direction, then see the full generation pipeline progress in one place. — Validated by the combined Phase 01 + Phase 04 flow: project bootstrap exists, workspace projection is backend-authored, and realtime progress is visible in one shell.
- [x] The creator can review outputs at each stage and selectively re-run targeted assets without restarting the entire pipeline. — Validated in Phase 05 for character / shot / clip selective rerun, candidate acceptance, current/superseded lineage, and prompt-edit-before-rerun flow.
- [x] An independent creator can go from a raw story idea to a coherent final video in one guided, resumable workflow. — Validated in Phase 06 with automatic final merge gating, in-product preview/download, stale-final handling, and delivery from the existing workspace.

### Active

- [ ] The platform can prove project-scoped provider portability end-to-end in a real project workflow.
- [ ] Planning and audit artifacts directly tied to provider portability reflect the shipped v1.0 state accurately.

### Out of Scope

- Multi-user team collaboration — v1 is explicitly optimized for independent creators, not coordinated studio workflows.
- Marketplace, publishing, or social/community surfaces — these do not help prove the core creative loop.
- Native mobile applications — web-first delivery is sufficient for the current scope.

## Context

- The current repository already contains a meaningful product surface: FastAPI backend, React/TypeScript frontend, an infinite-canvas workflow UI, WebSocket updates, config management, and a multi-agent generation pipeline.
- Existing code demonstrates story → character → storyboard → video → merge → review concepts, but the product definition is still concentrated mostly in `README.md`, not in durable planning artifacts.
- Backend and frontend both show real capability plus quality debt: there are many diagnostics/lint issues, which means roadmap planning should separate product-scope decisions from cleanup work.
- The current planning workflow is intentionally research-heavy: research, plan-check, and verifier are all enabled.
- Phase 02 established LangGraph-backed durable execution, same-thread resume, stage-oriented recovery summaries, and a creator-facing recovery control surface in the project page.
- Phase 03 established shot-bound character references, per-character and per-shot approval contracts, storyboard-to-video gating, and canvas-level review controls for the current approved/superseded state.
- Phase 04 established a backend-authored workspace projection with canonical placeholder slots, creator-friendly realtime progress labels, and a stable canvas shell that reconstructs from backend metadata on refresh.
- Phase 05 established selective rerun as a creator-controlled correction path with explicit candidate/current promotion, direct-downstream invalidation, and minimal one-hop lineage visibility in the existing workspace.
- Phase 06 established final assembly and delivery as part of the same guided workspace flow: merge starts automatically when current clips are ready, stale finals remain visible but clearly outdated, and preview/download/retry all live in the final-output card.

## Constraints

- **Tech Stack**: Existing repo uses FastAPI on the backend and React + TypeScript on the frontend — planning should prefer evolution over unnecessary rewrite because meaningful implementation already exists.
- **Audience**: Primary target user is an independent creator — because the user explicitly selected solo-creator focus for v1.
- **Value Proof**: v1 must prove idea-to-final-video closure — because the user explicitly selected this as the main success objective.
- **Operational Shape**: The product includes long-running generation and media assembly steps — architecture and roadmap must account for resumability, progress reporting, and recovery.
- **Workflow Preferences**: Planning runs in interactive mode with standard granularity, parallel execution, research, plan-check, and verifier enabled — because the user explicitly chose a higher-confidence planning workflow.
- **Planning Persistence**: `.planning/` should be tracked in git — because the user chose to keep planning documents versioned.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Re-scope from the new product vision instead of inheriting current repo behavior | User explicitly chose “rebuild scope from the new vision” | — Pending |
| Optimize v1 for independent creators | Keeps the workflow focused and limits unnecessary collaboration scope | — Pending |
| Prioritize end-to-end idea-to-final-video closure | This is the main product proof point for v1 | — Pending |
| Fully migrate the agent framework to LangGraph in v1 | User explicitly requested LangGraph as the primary agent framework | Phase 02 established the durable LangGraph execution path; later phases continue building product flow on top |
| Preserve identity through explicit shot-bound cast and structured shot intent | Prevents character/storyboard/video drift and keeps creator approvals meaningful | Locked in Phase 03 and implemented through approval-aware character/shot contracts |
| Keep the workspace backend-authored and section-first in v1 | Avoids layout drift and keeps refresh/realtime projection deterministic | Locked in Phase 04 and implemented through canonical section projection + progress shell |
| Make selective rerun candidate-first instead of auto-overwriting current outputs | Preserves a safe creative-control loop without needing a full version browser | Locked in Phase 05 and implemented with current/superseded promotion + minimal lineage labels |
| Keep delivery inside the existing final-output card instead of adding a separate publish surface | Preserves a single creator-facing workflow and avoids a second delivery mode | Locked in Phase 06 and implemented through final-output preview/download/retry semantics |
| Keep planning interactive and research-driven | User prefers visible checkpoints and higher planning confidence | — Pending |
| Track `.planning` documents in git | Planning history should remain durable and reviewable | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition**:
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone**:
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

## Current State

- **Shipped milestone:** v1.0
- **Current milestone:** v1.1 Provider Portability Proof
- **Current focus:** Phase 07 complete — project-level provider contracts and creator-facing provider proof/edit flow are now stable across save + refresh; next focus is pre-run validation and deterministic resolution.
- **Carry-forward context:** v1.0 shipped the guided, resumable core loop; provider portability remains the primary deferred warning, but the project-scoped contract + refresh/edit consistency baseline is now in place from Phase 07.

---
*Last updated: 2026-04-18 after Phase 07 completion*

# Phase 2: LangGraph Orchestration & Durable Execution - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers a LangGraph-backed execution path for the existing end-to-end pipeline with durable PostgreSQL checkpoints, real `thread_id` ownership, explicit pause/resume at creator review gates, and recovery at stage granularity.

This phase makes the full pipeline resumable and creator-controlled without yet expanding into parallel active runs, shot/asset-level recovery controls, or selective regeneration as first-class product semantics.

</domain>

<decisions>
## Implementation Decisions

### Recovery Experience
- When the system detects a resumable run, it must show a recovery summary before continuing; it must not silently auto-resume.
- The recovery summary should explain where the run stopped, which stages are already preserved, and what stage execution will continue from.

### Approval Gates
- Phase 2 uses blocking `interrupt()` gates at character approval and storyboard approval only.
- When a gate is reached, execution stops explicitly and waits for user action; it does not auto-timeout and continue.
- At a gate, the creator can either continue or submit feedback that reroutes/re-runs the current branch.
- Final merge does not get a new human approval gate in Phase 2.

### Active Run Policy
- A project may have only one active full run at a time in Phase 2.
- If the user starts generation while an active run already exists, the system should not create a new full run; it should prompt the user to resume or cancel the existing run first.
- A run paused at an approval gate still counts as active.
- Resource-level selective regeneration is not expanded into a separate Phase 2 run model; that stays deferred to later phases.

### Recovery Granularity
- The product-level recovery promise is stage-level resume from the last valid stage, not shot/asset-level recovery.
- Inside a stage, nodes may skip already-produced outputs idempotently, but that remains an internal optimization rather than a user-facing recovery unit.
- `Run` carries the main recovery boundary and persisted `thread_id`; `Stage` records stage lineage; `Artifact` remains provenance-oriented in Phase 2 rather than becoming the primary recovery control plane.
- The recovery summary shown to the creator stays stage-oriented rather than exposing shot-level or asset-level recovery controls.

### the agent's Discretion
- The exact LangGraph node decomposition, subgraph boundaries, and durable mode selection per node are at the agent's discretion as long as they preserve single active-run semantics, stage-level recovery, idempotent re-entry, and the approved review-gate behavior.
- The implementation may reuse or wrap existing manual orchestrator logic during migration, but the final Phase 2 execution path must be LangGraph-first and checkpoint-driven.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/orchestration/state.py`, `backend/app/orchestration/runtime.py`, `backend/app/orchestration/graph.py` — existing compileable LangGraph shell with persisted `Run.thread_id` mapped into graph config.
- `backend/app/models/run.py`, `backend/app/models/stage.py`, `backend/app/models/artifact.py` — canonical lineage tables already introduced for run/stage/artifact tracking.
- `backend/app/agents/orchestrator.py`, `backend/app/agents/base.py`, `backend/app/agents/review.py` — current manual orchestration, event emission, and review-routing patterns that can inform graph-node migration.
- `backend/app/api/v1/routes/generation.py`, `backend/app/api/v1/routes/characters.py`, `backend/app/api/v1/routes/shots.py` — current run entrypoints, cancellation paths, and resource-specific regeneration locks.
- `backend/app/ws/manager.py`, `backend/app/schemas/ws.py`, `backend/app/main.py` — existing WebSocket event contract, including `run_progress`, `run_awaiting_confirm`, and `run_confirmed`.
- `frontend/app/hooks/useWebSocket.ts`, `frontend/app/stores/editorStore.ts`, `frontend/app/pages/ProjectPage.tsx`, `frontend/app/components/chat/ChatPanel.tsx`, `frontend/app/types/index.ts` — current frontend state, recovery/gate surfaces, and progress/event consumption.

### Established Patterns
- The current product already uses a creator-facing run lifecycle with persisted runs/messages plus WebSocket-driven live updates.
- Review gates are already represented as explicit events and a creator feedback loop, so Phase 2 should evolve that contract rather than invent a new interaction model.
- Current runtime orchestration still depends on process-local task tracking and process-local WebSocket broadcast, so Phase 2 should not treat those as durable execution primitives.

### Integration Points
- Replace the current `GenerationOrchestrator` entry path behind `backend/app/api/v1/routes/generation.py` with a LangGraph-backed run path.
- Use `Run.thread_id` as the authoritative graph thread boundary rather than introducing a parallel identity source.
- Feed recovery summaries, gate pauses, and progress updates through the existing frontend run state/store surfaces instead of inventing a separate recovery UI stack.

</code_context>

<specifics>
## Specific Ideas

- Recovery UX should feel guided and explicit, not automatic or invisible.
- Review-gate behavior should preserve creator control without expanding Phase 2 into a broader selective-regeneration feature set.

</specifics>

<deferred>
## Deferred Ideas

- Multiple active full runs per project.
- Shot-level or asset-level recovery controls exposed directly in the UI.
- A final human approval gate before merge.
- Turning resource-level selective regeneration into a first-class Phase 2 run model.

</deferred>

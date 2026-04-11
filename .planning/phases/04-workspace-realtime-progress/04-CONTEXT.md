# Phase 4: Workspace & Realtime Progress - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 establishes the creator-facing workspace contract: the infinite canvas shows the project's canonical artifact slots with clear status, the progress surface explains what the current run is doing in real time, and a browser refresh reconstructs the same workspace view from backend metadata.

This phase does not expand into a version browser, user-authored canvas document persistence, asset-level recovery controls, or a new execution model. It builds a projection layer on top of the Phase 2 durable run contract and the Phase 3 approval-aware artifact contract.

</domain>

<decisions>
## Implementation Decisions

### Workspace Projection Model
- Phase 4 keeps a stage-section-first canvas layout.
- The workspace is organized into canonical sections for script, characters, storyboards, clips, and final output.
- Each section may render one or more artifact cards inside it, but Phase 4 does not switch to a fully free-form artifact-first graph.

### Placeholder and Status Semantics
- Canonical artifact slots may appear before content exists so the creator can still see draft / generating / blocked / failed / complete state.
- Missing output should not mean invisible output; placeholders are allowed and expected for normative workspace slots.
- Phase 4 must preserve Phase 3's approved/superseded review semantics while also surfacing generation status in the workspace.

### Realtime Progress Surface
- The primary realtime progress surface remains the progress panel / banner rather than making the canvas itself the main progress console.
- The canvas may show lightweight status badges, inline loading states, and blocked markers, but the main explanation of current stage and run state stays in the progress/chat shell.

### Layout Persistence
- Phase 4 does not introduce user-authored canvas layout persistence.
- Refresh restores the same system-generated workspace projection from backend metadata, but does not guarantee persistence of the creator's transient drag/reposition edits.

### Stage Language
- Frontend progress copy uses creator-friendly stage labels.
- Approval pauses are surfaced explicitly as creator-facing waiting states (for example: waiting for character review / waiting for storyboard review) rather than leaking raw backend stage names directly.

### Approval Gate Presentation
- When a run is paused for review, the run-level progress surface shows a waiting-for-review state.
- Downstream artifact cards that cannot proceed yet should show blocked / not started status so the creator can see both why the run is paused and what content is still pending.

### the agent's Discretion
- The exact badge system, card internals, and preview interaction details are at the agent's discretion as long as the workspace remains a backend-driven projection, preserves current-state-only review visibility, and does not introduce user-layout persistence or a version browser.
- The exact mapping from backend run/stage signals into creator-facing labels is at the agent's discretion as long as approval pauses remain explicit and understandable.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/app/hooks/useCanvasLayout.ts` — current deterministic section-first layout generator for script / characters / storyboards / video. This is the natural base for Phase 4 projection rather than replacing the layout model.
- `frontend/app/components/canvas/InfiniteCanvas.tsx` — current tldraw shell that already consumes `useCanvasLayout`, wires previews, and hosts canvas-side mutations.
- `frontend/app/components/canvas/shapes/*` — existing shape system for script / character / storyboard / video sections and connectors. Phase 4 should extend these shapes with status/projection behavior instead of inventing a separate workspace shell.
- `frontend/app/hooks/useWebSocket.ts`, `frontend/app/components/chat/ChatPanel.tsx`, `frontend/app/stores/editorStore.ts`, `frontend/app/types/index.ts` — current realtime and run-state surfaces; progress today is stage-oriented and chat/panel-centric, with review/recovery semantics already wired.
- `backend/app/schemas/ws.py` and `backend/app/ws/manager.py` — existing websocket contract and event delivery path that already support stage-oriented progress and review state hydration.
- `backend/app/models/artifact.py` and `backend/app/models/stage.py` — existing backend lineage metadata that should remain the source of truth for workspace projection and status reconstruction on refresh.

### Established Patterns
- Phase 2 locked the workspace to a single active full run, same-thread resume, stage-level recovery, and explicit gate behavior.
- Phase 3 locked review visibility to current-state-only (approved/superseded) rather than a full version browser.
- The current canvas is already section-first and deterministic; Phase 4 should evolve that instead of pivoting to a free-form artifact graph.
- Realtime progress is already stage-oriented and panel-first; Phase 4 should enrich workspace status without duplicating the entire progress surface onto the canvas.

### Integration Points
- Workspace status projection must be derived from backend metadata and websocket updates, not from standalone frontend-only canvas state.
- Artifact cards need to combine generation status with existing approval state, especially for characters, storyboards, clips, and final output.
- Preview interactions should continue to flow through the existing canvas shell and modal/preview mechanisms rather than adding a second preview system.

</code_context>

<specifics>
## Specific Ideas

- A creator should understand the project state at a glance even when an artifact does not exist yet.
- The workspace should answer two questions clearly: what exists, and what is currently happening.
- Approval pauses should feel visible and actionable without forcing the creator to read backend terminology.

</specifics>

<deferred>
## Deferred Ideas

- Fully free-form artifact-first graph layout.
- User-authored canvas layout persistence.
- Canvas as the primary, detailed progress console.
- Full version browser / version switching UI.
- Asset-level recovery, replay, or fork controls in the workspace.

</deferred>

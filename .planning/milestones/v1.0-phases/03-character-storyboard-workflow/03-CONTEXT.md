# Phase 3: Character & Storyboard Workflow - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 establishes the creator-facing contract for character references and storyboard review so that downstream storyboard and video generation preserve character identity consistently and consume structured shot intent rather than loose project-wide prompts.

This phase adds explicit character and shot approval semantics on top of the durable LangGraph execution path from Phase 2, but does not expand into branch-level video execution, selective regeneration as a first-class workflow, or a full artifact version browser.

</domain>

<decisions>
## Implementation Decisions

### Storyboard-to-Video Gating
- Video generation starts only after all storyboard shots required for the run are approved.
- Phase 3 does not allow partially approved shots to start downstream video generation early.

### Shot-to-Character Contract
- Every storyboard shot must explicitly bind the character set used for that shot.
- Storyboard and video generation consume the shot-bound character set, not the entire project character list by default.

### Character Reference Input Shape
- Each character reference is defined by `name`, `description`, and one optional primary reference image.
- A creator may replace the reference image before approval.
- Once a character is approved, that approved reference becomes the frozen downstream source of truth for later stages in the same run.

### Character Approval Granularity
- Character approval is per-character, not whole-set only.
- The character stage is allowed to continue only after all required characters are approved.
- This preserves creator control without breaking Phase 2's stage-level recovery contract.

### Storyboard Shot Approval Payload
- Approving a storyboard shot means approving at least: cast, duration, camera/framing, and a minimal motion note.
- Phase 3 does not treat approval as “the still image looks okay” only; approval must lock enough structured shot intent for downstream video generation.

### Version / Lineage Visibility
- Backend stores complete version and lineage metadata for approved character references and storyboard shots.
- Frontend Phase 3 shows only the current `approved` / `superseded` state rather than a full version browser or version switching workflow.

### the agent's Discretion
- The exact schema split between character reference metadata, storyboard shot intent metadata, and artifact lineage records is at the agent's discretion as long as it preserves the approved/frozen contract and keeps Phase 3 within stage-level review semantics.
- The exact review UI composition is at the agent's discretion as long as creators can review per character and per shot without introducing partial downstream execution.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/models/project.py` — existing `Character` and `Shot` models are the starting point for adding reference and shot-intent structure, but they currently lack explicit approval/version/lineage semantics.
- `backend/app/api/v1/routes/characters.py` and `backend/app/api/v1/routes/shots.py` — current resource-level endpoints provide the natural integration points for character/storyboard review and targeted regeneration.
- `backend/app/agents/storyboard_artist.py` and `backend/app/agents/video_generator.py` — existing downstream generation code is where explicit shot→character bindings and structured shot intent will need to be consumed.
- `backend/app/agents/orchestrator.py`, `backend/app/api/v1/routes/generation.py`, `backend/app/services/run_recovery.py` — Phase 2 already established durable execution, same-thread resume, and server-authored recovery control; Phase 3 should build on that rather than creating a parallel execution model.
- `frontend/app/pages/ProjectPage.tsx`, `frontend/app/components/chat/ChatPanel.tsx`, `frontend/app/stores/editorStore.ts`, `frontend/app/hooks/useWebSocket.ts` — current creator workflow shell, review interactions, and live progress surfaces that can host character/shot review without inventing a separate app shell.

### Established Patterns
- Phase 2 already enforces single active full run per project, stage-oriented recovery, and explicit server-driven recovery controls.
- Existing review UX is still generic; Phase 3 is the point where review semantics become character-specific and shot-specific instead of free-form confirmation only.
- Existing artifacts/stages/lineage tables from Phase 2 should be reused instead of inventing a second provenance system.

### Integration Points
- Character approval should fit the existing creator workflow and become a real upstream dependency for storyboard generation.
- Storyboard review should remain inside the same full-run contract, with all required shots approved before video begins.
- The frontend should expose approved/superseded status and structured review data without yet turning Phase 3 into a full artifact-history browser.

</code_context>

<specifics>
## Specific Ideas

- Character identity consistency should be enforced by explicit approved references and shot-level character bindings, not by relying on project-wide prompt reuse.
- Storyboard review should feel precise and creator-controlled, but still preserve a single linear stage gate into video generation.

</specifics>

<deferred>
## Deferred Ideas

- Partial video generation from a subset of approved storyboard shots.
- Multi-image reference packs / full reference sheets as the default Phase 3 input model.
- A full artifact version browser or version switching UI in Phase 3.
- Selective regeneration as a first-class orchestration mode inside Phase 3.

</deferred>

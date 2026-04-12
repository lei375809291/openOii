# Phase 5: Review & Creative Control - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 establishes the creator-facing contract for selective regeneration and prompt-directed correction so a creator can revise individual characters, storyboard shots, and video clips without restarting the full project pipeline.

This phase adds targeted creative-control actions, candidate/current supersession semantics, and minimal lineage visibility on top of the Phase 2 durable run model, the Phase 3 approval contract, and the Phase 4 workspace projection. It does not expand into a full version browser, parallel full runs, or a new clip-only feedback domain.

</domain>

<decisions>
## Implementation Decisions

### Selective Regeneration Blast Radius
- A targeted rerun affects only the selected artifact and its direct downstream dependents.
- Unrelated artifacts remain intact.
- Character rerun invalidates the related storyboard / clip / final outputs that depend on that character.
- Shot rerun invalidates that shot’s clip and final output only.
- Clip rerun invalidates final output only.

### Relationship to the Active Run
- The system still allows only one active full run per project.
- If a full run is actively generating, targeted rerun is disabled.
- If the full run is paused at a review gate, targeted rerun is allowed only as the creator’s corrective action inside that same run/thread rather than as a second concurrent run.

### Candidate vs Current Semantics
- A rerun result is created as a candidate first.
- It becomes the current result only after explicit creator acceptance.
- The previously current result becomes superseded on acceptance.

### Editable Inputs Before Rerun
- Shot rerun may edit the free-form generation prompt plus structured shot fields: cast, camera, duration, motion note, and image prompt.
- Character rerun may edit the character description and primary reference image before rerun.
- Clip rerun does not introduce an independent new input layer in Phase 5.

### Clip Correction Model
- When a clip is unsatisfactory, correction returns to the approved shot contract and reruns from there.
- Phase 5 does not add a clip-only feedback or clip-only motion-correction layer.

### Minimal Lineage Visibility
- Phase 5 does not add a full version browser.
- The workspace must still show the minimum lineage needed for creative control: `current` / `superseded`, `vN regenerated from vN-1`, and a short regeneration reason such as `edited prompt`.

### the agent's Discretion
- The exact schema for candidate/current lineage, regeneration reason metadata, and downstream invalidation markers is at the agent's discretion as long as it preserves the locked blast-radius rules and explicit acceptance model.
- The exact placement of rerun controls is at the agent's discretion as long as the workflow remains understandable, project-scoped, and consistent with the existing workspace/progress shell.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/api/v1/routes/characters.py` and `backend/app/api/v1/routes/shots.py` already expose resource-level regenerate endpoints and approval endpoints, so Phase 5 should evolve existing control points rather than inventing a separate control surface.
- `frontend/app/components/canvas/ProjectOverview.tsx`, `frontend/app/components/canvas/canvasEvents.ts`, `frontend/app/components/canvas/InfiniteCanvas.tsx`, and `frontend/app/stores/editorStore.ts` already contain card-level actions and regeneration/loading state hooks that can be formalized into Phase 5 creative controls.
- `backend/app/models/project.py` already carries approved/current shot and character fields plus `approval_version`, which can anchor candidate/current promotion.
- `backend/app/models/artifact.py` already has `version` and artifact metadata that can support minimal lineage display without a full version browser.
- `backend/app/api/v1/routes/generation.py`, `backend/app/services/run_recovery.py`, and Phase 2 recovery controls already define the single active full-run boundary and same-thread corrective resume model.
- `frontend/app/types/index.ts`, `frontend/app/services/api.ts`, and the Phase 4 workspace shell already provide the current/superseded/progress vocabulary that Phase 5 can extend rather than replace.

### Established Patterns
- Phase 2 locked the system to one active full run, stage-level recovery, and explicit review-gate control.
- Phase 3 locked shot-bound cast, approved references, and current-state-only visibility rather than full history browsing.
- Phase 4 locked a backend-authored, section-first workspace with canonical placeholders and creator-friendly progress language.

### Integration Points
- Targeted rerun should feel like a correction path inside the existing workspace, not a second workflow engine.
- Workspace cards need enough lineage and status metadata to differentiate candidate/current/superseded states without introducing a full history browser.
- Downstream invalidation markers must project cleanly into the existing workspace status model so the creator can see what changed and what became stale.

</code_context>

<specifics>
## Specific Ideas

- Creative control should be precise: “fix this one thing and show me what changed,” not “start over.”
- The creator should never lose track of which result is current, which one is a new candidate, and why a downstream artifact became stale.
- Prompt editing should stay tightly scoped to the artifact being corrected instead of opening a second free-form review language for every stage.

</specifics>

<deferred>
## Deferred Ideas

- Full version browser / version switching UI.
- Parallel targeted reruns alongside an actively generating full run.
- Clip-only feedback / motion-correction layer independent of shot contract.
- Broad project-wide rerun cascade beyond direct downstream dependents.

</deferred>

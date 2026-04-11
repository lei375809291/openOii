# Phase 6: Final Assembly & Delivery - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 defines the creator-facing delivery contract for the finished project: when final assembly is allowed to start, how merge failures and stale finals are surfaced, and how the creator previews and downloads the final merged video inside the existing workspace.

This phase builds on the Phase 2 durable graph, the Phase 3 approval-aware clip inputs, the Phase 4 final-output workspace shell, and the Phase 5 current/superseded creative-control contract. It does not introduce a dedicated delivery page, a version browser, or a post-production editor.

</domain>

<decisions>
## Implementation Decisions

### Final Assembly Trigger
- Final merge starts automatically once all required and current clips are present and successful.
- Phase 6 does not require the creator to click a separate “assemble final video” action to begin merge.

### Final Assembly Eligibility
- A project is ready for final assembly only when every current shot in scope has a corresponding current successful clip.
- Any required clip in `failed`, `generating`, or `missing` state blocks delivery.
- Blocking clips must be surfaced clearly to the creator.

### Stale Final Behavior
- When a current clip changes and the final output becomes outdated, the prior final video remains visible but is explicitly marked `stale` / `outdated` until a new merge succeeds.
- Phase 6 does not silently remove the previous final output the moment a downstream clip changes.

### Merge Failure Recovery Entry
- The primary creator-facing retry surface for merge failure is the existing final-output card.
- That card may expose a dedicated “retry merge” action, but the underlying execution boundary still reuses the same run/thread recovery semantics rather than inventing a second delivery workflow.

### Delivery Surface
- The final-output card inside the existing section-first workspace is the primary delivery surface.
- Preview, download, blocking explanation, stale status, and retry merge all live there.
- Phase 6 does not introduce a separate delivery page or standalone completion panel.

### Minimal Provenance Visibility
- The final-output card must show the minimum provenance needed for user trust: source clip scope (for example `assembled from current clips 1–8`), current version/update time, and stale/current distinction.
- Phase 6 does not add a version browser or deep lineage exploration UI.

### the agent's Discretion
- The exact backend query strategy for “required current clips” is at the agent's discretion as long as it respects the locked current/superseded semantics from Phase 5.
- The exact stale/download/retry badge copy is at the agent's discretion as long as it remains creator-facing, explicit, and consistent with the existing workspace language.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/agents/video_merger.py` already provides the basic merge path, writes `project.video_url`, emits `project_updated`, and sends creator-facing progress messages.
- `backend/app/orchestration/graph.py` already treats `merge` as the final graph node after `clip`, so Phase 6 should evolve existing graph completion semantics rather than create a second pipeline.
- `backend/app/services/creative_control.py` and Phase 5 rerun logic already define how clip changes make final output stale; Phase 6 should build delivery semantics on that current/superseded contract.
- `backend/app/models/project.py` already stores the canonical final merged video URL on the project, while `backend/app/models/artifact.py` already supports versioned provenance records.
- `frontend/app/utils/workspaceStatus.ts` and `frontend/app/components/canvas/shapes/VideoSectionShape.tsx` already provide the final-output slot and status projection surface that Phase 6 can enrich with stale / blocked / downloadable delivery semantics.
- `frontend/app/components/canvas/ProjectOverview.tsx` and `frontend/app/components/canvas/InfiniteCanvas.tsx` already expose preview/download patterns that Phase 6 can reuse instead of inventing a second delivery shell.

### Established Patterns
- Phase 2 locked single active full-run semantics, same-thread recovery, and no extra human gate before merge.
- Phase 3 locked current/superseded artifact visibility without a version browser.
- Phase 4 locked a backend-authored section-first workspace with a canonical final-output section and creator-friendly progress language.
- Phase 5 locked selective rerun as a candidate/current correction loop that can make final output stale without resetting unrelated artifacts.

### Integration Points
- Final delivery state must project into the existing final-output card rather than bypassing the workspace.
- Merge readiness and blocking clips must be derived server-side from current clip state, then surfaced through existing workspace/progress status channels.
- Preview/download should reuse the current final video preview/download affordances rather than creating a new delivery subsystem.

</code_context>

<specifics>
## Specific Ideas

- Delivery should feel like the natural end of the same guided workflow, not a separate app mode.
- The creator should always understand whether the visible final video is current, stale, blocked, or ready to download.
- Failure to merge should be actionable from the same place the creator sees final-output status.

</specifics>

<deferred>
## Deferred Ideas

- Dedicated delivery page or standalone publish screen.
- Version browser for historical finals.
- Background music, transitions, or broader post-production controls.
- Rich export bundles beyond the core merged video artifact.

</deferred>

# Roadmap: openOii

## Overview

openOii v1 delivers a guided, resumable, creator-controlled pipeline that turns a raw story idea into a finished comic-drama video. The roadmap prioritizes LangGraph as the primary orchestration framework from the start, with FastAPI as the application shell and queued workers for heavy media jobs. Six phases deliver the complete "idea → final video" loop with character consistency, selective reruns, and an infinite canvas workspace.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Project Bootstrap** - Project creation, provider config, LangGraph graph skeleton, domain models
- [ ] **Phase 2: LangGraph Orchestration & Durable Execution** - Full pipeline graph, persistent checkpointing, interrupt/resume, resumable runs
- [ ] **Phase 3: Character & Storyboard Workflow** - Character references, identity consistency, storyboard review per shot
- [ ] **Phase 4: Workspace & Realtime Progress** - Infinite canvas, artifact status, real-time stage progress visibility
- [ ] **Phase 5: Review & Creative Control** - Selective regeneration, shot-level prompt editing
- [ ] **Phase 6: Final Assembly & Delivery** - Video merge, in-app preview, download

## Phase Details

### Phase 1: Foundation & Project Bootstrap
**Goal**: A creator can create a project with story input and provider config, backed by domain models and a LangGraph graph skeleton
**Depends on**: Nothing (first phase)
**Requirements**: PROJ-01, PROJ-02
**Success Criteria** (what must be TRUE):
  1. Creator can create a project by entering title, story idea, and style direction via the existing project form, and the project is persisted in PostgreSQL
  2. Creator can configure text, image, and video providers for a project via a configuration surface
  3. LangGraph StateGraph skeleton exists with defined state schema, reducers, and project_id/run_id/thread_id mapping, with Run.thread_id as the persisted ownership boundary
  4. Domain models for Project, Run, Stage, and Artifact exist with parent-child lineage tracking
  5. Alembic migrations are configured and can create/update the schema from scratch
**Plans**: 3
Plans:
- [ ] 01-01-PLAN.md — Lock project/config bootstrap and define canonical lineage tables
- [ ] 01-02-PLAN.md — Add LangGraph state schema and compileable skeleton
- [ ] 01-03-PLAN.md — Add Alembic migration environment and initial revision
**UI hint**: yes

### Phase 2: LangGraph Orchestration & Durable Execution
**Goal**: The system can execute the full end-to-end pipeline with durable checkpoints and resumable runs
**Depends on**: Phase 1
**Requirements**: PIPE-01, REL-01
**Success Criteria** (what must be TRUE):
  1. Creator can trigger a full generation run that executes script → characters → storyboards → clips → merge end-to-end via LangGraph
  2. After an interruption (process crash, browser close, provider timeout), creator can resume the run from the last valid checkpoint without restarting
  3. LangGraph persistent checkpointer is configured with PostgreSQL and checkpoints are tied to real thread_id values
  4. Graph nodes use idempotent side effects — re-running a completed stage produces the same result without duplication
  5. interrupt() / resume flows exist at review gates (e.g., after character approval, after storyboard review)
**Plans**: 4
Plans:
- [x] 02-01-PLAN.md — Lock the durable-execution regression contract before production changes
- [x] 02-02-PLAN.md — Move the generation engine onto a durable LangGraph pipeline
- [x] 02-03-PLAN.md — Expose resumable-run recovery and active-run control on the backend
- [x] 02-04-PLAN.md — Surface resumable-run recovery and active-run control in the creator UI

### Phase 3: Character & Storyboard Workflow
**Goal**: Character identity is consistently preserved across storyboard and video outputs, and creators can review storyboards per shot
**Depends on**: Phase 2
**Requirements**: CHAR-01, CHAR-02, SHOT-01
**Success Criteria** (what must be TRUE):
  1. Creator can define or upload character reference inputs (name, description, optional reference image) that are reused by downstream generation stages
  2. Generated storyboard outputs visually preserve character identity from approved character references for the same project
  3. Creator can review each storyboard shot individually and mark it as approved before downstream video generation proceeds
  4. Approved character references and storyboard shots are stored as versioned artifacts with lineage metadata
  5. Video generation nodes consume approved character references and shot intent metadata, not just free-form prompts
**Plans**: 4
Plans:
- [x] 03-01-PLAN.md — Persist character approvals and shot-bound review state
- [x] 03-02-PLAN.md — Gate storyboard/video execution on approved shot bindings
- [x] 03-03-PLAN.md — Add typed review state to frontend contracts and stores
- [x] 03-04-PLAN.md — Render per-character and per-shot approval controls in the canvas

### Phase 4: Workspace & Realtime Progress
**Goal**: The creator can see all project artifacts on an infinite canvas with clear status and watch generation progress in real time
**Depends on**: Phase 2
**Requirements**: WORK-01, WORK-02, PIPE-02
**Success Criteria** (what must be TRUE):
  1. Creator can view script, characters, storyboards, clips, and final output as related artifacts on an infinite tldraw canvas
  2. Each artifact on the canvas clearly shows its status: draft, generating, complete, failed, or superseded
  3. Creator can see the current stage, progress, and status changes of a generation run in real time via WebSocket updates
  4. Canvas state is a projection of backend metadata — refreshing the browser restores the same workspace view with accurate artifact states
  5. Creator can click on any artifact card to preview its content (image, text, or video)
**Plans**: 4
Plans:
- [ ] 04-01-PLAN.md — Establish the shared workspace status contract
- [ ] 04-02-PLAN.md — Render canonical canvas slots and status badges
- [ ] 04-03-PLAN.md — Sync realtime progress labels, hydration, and websocket drift
- [ ] 04-04-PLAN.md — Wire the projected workspace shell and refresh-safe fallback
**UI hint**: yes

### Phase 5: Review & Creative Control
**Goal**: The creator can selectively regenerate individual assets and edit prompts without restarting the full pipeline
**Depends on**: Phase 3
**Requirements**: REVI-01, REVI-02
**Success Criteria** (what must be TRUE):
  1. Creator can selectively regenerate a single character, storyboard shot, or video clip without restarting the full project run
  2. Creator can edit the prompt or generation instructions for a specific shot before rerunning it, and the edited prompt is used in regeneration
  3. Selective regeneration only affects the targeted artifact and its downstream dependents — unrelated artifacts remain intact
  4. Regenerated artifacts show lineage to their parent (e.g., "v2, regenerated from v1 with edited prompt")
  5. Superseded artifacts are visually distinguished from current/approved artifacts in the workspace
**Plans**: TBD

### Phase 6: Final Assembly & Delivery
**Goal**: The creator can preview and download the final merged video when all required clips complete successfully
**Depends on**: Phase 5
**Requirements**: PIPE-03, DELIV-01, DELIV-02
**Success Criteria** (what must be TRUE):
  1. When all required video clips complete successfully, the system produces a final merged video artifact
  2. Creator can preview the final merged video inside the product with a playable video player
  3. Creator can download the final merged video file from the product
  4. The merged video artifact is linked back to its source clip versions for provenance
  5. Failed clip generation prevents final merge and clearly indicates which clips are blocking
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Project Bootstrap | 0/0 | Not started | - |
| 2. LangGraph Orchestration & Durable Execution | 0/0 | Not started | - |
| 3. Character & Storyboard Workflow | 0/0 | Not started | - |
| 4. Workspace & Realtime Progress | 0/4 | Not started | - |
| 5. Review & Creative Control | 0/0 | Not started | - |
| 6. Final Assembly & Delivery | 0/0 | Not started | - |

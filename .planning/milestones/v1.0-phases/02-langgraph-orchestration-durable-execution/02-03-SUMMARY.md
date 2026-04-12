---
phase: 02-langgraph-orchestration-durable-execution
plan: 03
subsystem: api
tags: [fastapi, langgraph, websocket, pydantic, recovery]

# Dependency graph
requires:
  - phase: 02-02
    provides: durable LangGraph execution, persisted checkpoints, and recovery context
provides:
  - server-authored recovery control surface for active and resumable runs
  - stage-oriented recovery summaries with preserved stage history and thread identity
  - typed websocket payload validation for recovery and confirm events
affects: [02-04, frontend recovery UI, websocket consumers, project generation flow]

# Tech tracking
tech-stack:
  added: [run_recovery service, typed websocket event payload models]
  patterns: [server-authored recovery summaries, explicit resume/cancel control, event-name stability with payload enrichment]

key-files:
  created: [backend/app/services/run_recovery.py]
  modified: [backend/app/api/v1/routes/generation.py, backend/app/agents/orchestrator.py, backend/app/schemas/project.py, backend/app/schemas/ws.py, backend/app/ws/manager.py, backend/tests/test_api/test_phase2_generation.py, backend/tests/test_api/test_websocket.py]

key-decisions:
  - "Keep recovery summaries stage-oriented and derived on the server, never from the client"
  - "Reject duplicate active generation attempts with an explicit control surface instead of auto-forking"
  - "Preserve existing websocket event names while enriching the payloads they carry"

patterns-established:
  - "Pattern 1: recovery control responses include thread_id, summary, and available_actions"
  - "Pattern 2: websocket manager validates known event payloads through typed Pydantic models before broadcast"

requirements-completed: [PIPE-01, REL-01]

# Metrics
duration: 1h 10m
completed: 2026-04-11
---

# Phase 02: langgraph-orchestration-durable-execution Summary

Stage recovery now comes back from the backend as a server-authored control surface: creators see the current durable thread, the last completed stage, the next stage to continue from, and explicit resume/cancel actions before any new generation work starts.

## Performance

- **Duration:** 1h 10m
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added a recovery summary builder that inspects LangGraph checkpoint history plus stage/artifact lineage and emits stage-oriented recovery data.
- Updated generation conflict handling to return explicit active/recoverable control surfaces instead of silently creating another run.
- Typed the websocket recovery/confirm payloads and validated them before broadcast.

## Task Commits

1. **Task 1: recovery summary and active-run guard** - `7c29e12` (fix)
2. **Task 2: websocket recovery/gate typing** - `3d9378f` (fix)

## Files Created/Modified
- `backend/app/services/run_recovery.py` - builds stage-oriented recovery summaries and control surfaces.
- `backend/app/api/v1/routes/generation.py` - blocks duplicate runs and returns recovery controls.
- `backend/app/agents/orchestrator.py` - enriches confirm/progress websocket payloads with recovery metadata.
- `backend/app/schemas/project.py` - adds recovery summary/control response models.
- `backend/app/schemas/ws.py` - adds typed websocket payload models.
- `backend/app/ws/manager.py` - validates websocket payloads before broadcasting.
- `backend/tests/test_api/test_phase2_generation.py` - covers active and resumable recovery responses.
- `backend/tests/test_api/test_websocket.py` - covers recovery payload validation and rejection.

## Decisions Made
- Recovery state is authored by the backend and keyed to the durable thread, not a client-side guess.
- Existing websocket event names stayed intact so the frontend contract remains stable.

## Deviations from Plan

### Scope adjustment

**1. Orchestrator payload enrichment needed one extra file**
- **Found during:** Task 2
- **Issue:** The plan listed websocket schema/manager changes, but the backend also had to enrich `run_awaiting_confirm` and `run_confirmed` at the emission site so the new typed payloads actually carried recovery data.
- **Fix:** Updated `backend/app/agents/orchestrator.py` to inject `recovery_summary`, `current_stage`, `next_stage`, and `thread_id`-backed recovery context into the existing events.
- **Files modified:** `backend/app/agents/orchestrator.py`
- **Verification:** `pytest tests/test_api/test_phase2_generation.py tests/test_api/test_websocket.py -q`
- **Committed in:** `3d9378f`

## Issues Encountered
- The first recovery response test failed because the control surface did not expose `thread_id`; I added it to keep the resume path explicit.
- The websocket contract test passed after the typed payload registry was added.

## Next Phase Readiness
- The backend recovery/control contract is ready for the frontend recovery UI in Phase 02-04.
- Next work should wire the new control surface into the project page and use `thread_id` to resume the same durable run.

---
*Phase: 02-langgraph-orchestration-durable-execution*
*Completed: 2026-04-11*

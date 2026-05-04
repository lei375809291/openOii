# PRD: Fix orchestrator progress/current_agent stale after ideate stage

## Background
Auto-mode end-to-end run (run id 48, project 57) verified that the entire pipeline works: onboarding → director → scriptwriter → character_artist → storyboard_artist → TTS → video_generator → video_merger. Final video was produced. However `run.progress` stayed at `8.33%` and `run.current_agent` stayed at `"director"` from the moment ideate completed all the way to `status=ready`. The frontend's progress UI relies on these values and will appear frozen even though the backend is making progress.

## Root cause (confirmed)
File: `backend/app/agents/orchestrator.py`

Around the phase-2 graph invocation, `current_agent` and `progress` are written exactly once — right before transitioning out of the `ideate` stage — and the function returns immediately after. Subsequent stages (`script`, `visualize`, `storyboard`, `animate`, `finalize`) never update these fields.

```
# rough shape of the buggy block (line numbers may shift):
run.current_agent = next_agent_name      # writes "director" here
run.progress = compute_progress(...)     # writes 8.33% here
session.commit()
return                                    # bug: never updates again
```

## Goals
1. `run.progress` reflects the running stage at all times (monotonic, ends at `1.0`).
2. `run.current_agent` reflects the agent currently running (or last completed) within the active stage.
3. `AgentRun.updated_at` ticks for every stage boundary so WS clients can react.

## Non-goals
- Fine-grained intra-agent progress (token-level streaming progress bars). One progress bump per agent boundary is enough.
- Refactoring the LangGraph topology.

## Acceptance criteria
- [ ] After running an auto-mode generate end-to-end, `SELECT progress, current_agent FROM agentrun WHERE id=N` shows multiple distinct values across stages, ending at `1.0` / final agent.
- [ ] During a normal-mode run, the frontend progress bar advances past ideate without manual refresh.
- [ ] Existing tests pass: `cd backend && uv run pytest tests/test_orchestration -q`.
- [ ] No regression in `tests/test_api/test_generation.py`.

## Implementation notes
- `_STAGE_TO_AGENTS` already encodes the order; can derive `(stage_index, agent_index_within_stage)` per agent boundary.
- A single helper `_bump_progress(session, run, agent_name)` called at each agent's start-of-run + end-of-run keeps logic local.
- Be careful: orchestrator runs inside a background task; obtain a fresh session via `with SessionLocal() as session` rather than reusing the request-scoped one.

## Out of scope (parking lot)
- WebSocket `progress` event payload normalization (separate task if needed).
- Adding a `stage` column to `AgentRun` for cleaner UI mapping.

## Verification plan
1. `uv run pytest tests/test_orchestration -q`
2. Trigger auto-mode generate via `curl POST /api/v1/projects/{id}/generate` with `mode=auto`.
3. Watch progress: `watch -n2 "docker exec openoii-postgres-1 psql -U openoii -d openoii -c \"SELECT progress, current_agent FROM agentrun ORDER BY id DESC LIMIT 1\""`
4. Confirm progress monotonically increases through the 6 stages.

# PRD: Frontend not sending confirm signal at director gate

## Background
Run 47 (project 56) executed cleanly through ideate (onboarding + director both produced messages and committed). Backend then reached the `director` approval gate (LangGraph `interrupt(...)`). The orchestrator's `_wait_for_confirm` waited for a confirm signal for the configured timeout (~30 minutes) and then failed with:

```
Run failed: RuntimeError('等待确认超时（agent: director）')
```

Auto-mode (which auto-confirms gates internally) works end-to-end (run 48, verified). So the LLM and backend gate logic are correct. The bug is that the frontend never delivers a confirm in normal mode.

## Hypothesis (to verify in research phase)
One or more of:
1. The gate UI component is not rendered when the run reaches `waiting_for_confirmation` (state mapping issue in store / hooks).
2. The confirm button is rendered but its handler is not wired to a confirm endpoint or WS message.
3. The WS event from backend (`gate_open` / `interrupt` / similar) is not parsed into the right reducer.
4. The endpoint shape changed and the frontend still posts the old payload.

## Investigation entry points
- `frontend/app/hooks/useWebSocket.ts` — primary WS listener.
- `frontend/app/stores/editorStore.ts` — run / message state.
- `frontend/app/pages/ProjectPage.tsx` (or equivalent) — gate UI.
- `backend/app/api/v1/routes/generation.py` — confirm/feedback endpoints (note: `feedback` ≠ confirm; resume path uses `Command(resume=...)`).
- `backend/app/agents/orchestrator.py:_wait_for_confirm` — what signal source does it consume? (Redis? in-process queue?)
- Reproduce: create a project, trigger generate (mode=normal), wait for ideate to complete, watch network panel and WS frames when clicking the confirm button.

## Acceptance criteria
- [ ] In normal mode, after ideate completes, clicking the confirm button in the UI causes the run to advance past the director gate within 5s.
- [ ] WS message log on the frontend shows the outgoing confirm event.
- [ ] Backend log shows `_wait_for_confirm` returning before the 1800s timeout.
- [ ] At least one Playwright e2e or vitest covering the confirm path is added or updated.

## Out of scope
- Changing the timeout value.
- Redesigning the gate UX (only restoring functionality).
- Backend orchestration changes (already verified working via auto mode).

## Notes
- Pair with the progress-update task (04-25-fix-progress-update) when validating, because a frozen progress bar can mask working confirm logic.
- Backend `interrupt` payload is currently named `gate="director"` — confirm path on the frontend must match this exact gate name.

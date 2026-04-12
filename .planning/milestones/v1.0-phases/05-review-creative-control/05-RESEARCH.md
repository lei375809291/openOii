# Phase 5: Review & Creative Control - Research

**Researched:** 2026-04-11  
**Domain:** selective regeneration, creator acceptance, durable resume, workspace lineage  
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- A targeted rerun affects only the selected artifact and its direct downstream dependents.
- Unrelated artifacts remain intact.
- Character rerun invalidates the related storyboard / clip / final outputs that depend on that character.
- Shot rerun invalidates that shot’s clip and final output only.
- Clip rerun invalidates final output only.
- The system still allows only one active full run per project.
- If a full run is actively generating, targeted rerun is disabled.
- If the full run is paused at a review gate, targeted rerun is allowed only as the creator’s corrective action inside that same run/thread rather than as a second concurrent run.
- A rerun result is created as a candidate first.
- It becomes the current result only after explicit creator acceptance.
- The previously current result becomes superseded on acceptance.
- Shot rerun may edit the free-form generation prompt plus structured shot fields: cast, camera, duration, motion note, and image prompt.
- Character rerun may edit the character description and primary reference image before rerun.
- Clip rerun does not introduce an independent new input layer in Phase 5.
- When a clip is unsatisfactory, correction returns to the approved shot contract and reruns from there.
- Phase 5 does not add a clip-only feedback or clip-only motion-correction layer.
- Phase 5 does not add a full version browser.
- The workspace must still show the minimum lineage needed for creative control: `current` / `superseded`, `vN regenerated from vN-1`, and a short regeneration reason such as `edited prompt`.

### the agent's Discretion
- The exact schema for candidate/current lineage, regeneration reason metadata, and downstream invalidation markers is at the agent's discretion as long as it preserves the locked blast-radius rules and explicit acceptance model.
- The exact placement of rerun controls is at the agent's discretion as long as the workflow remains understandable, project-scoped, and consistent with the existing workspace/progress shell.

### Deferred Ideas (OUT OF SCOPE)
- Full version browser / version switching UI.
- Parallel targeted reruns alongside an actively generating full run.
- Clip-only feedback / motion-correction layer independent of shot contract.
- Broad project-wide rerun cascade beyond direct downstream dependents.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REVI-01 | A creator can selectively regenerate a single character, storyboard shot, or video clip without restarting the full project run. | Existing resource-scoped regenerate routes, `TargetIds` incremental rerun routing, LangGraph durable resume primitives, and workspace lineage/status projection. |
| REVI-02 | A creator can edit the prompt or generation instructions for a specific shot before rerunning it. | Existing `ShotUpdate` schema and edit modal can carry prompt deltas, but the rerun request/accept flow must be extended to keep candidate/current separation. |
</phase_requirements>

## Summary

This phase is mostly state choreography, not new generation logic. The repo already has the core pieces: approval-aware `Character` and `Shot` models, resource-scoped regenerate endpoints, a `ReviewAgent` that can route `incremental` reruns with `target_ids`, and a workspace projection that already understands `draft / generating / blocked / failed / complete / superseded / waiting-for-review` [VERIFIED: repo]. Phase 5 needs to make the candidate/current boundary explicit and keep the creator’s mental model simple: “edit one thing, rerun only what depends on it, then accept it into current state.”

The biggest technical risk is accidental over-invalidation. Current regenerate routes clear outputs immediately and start new runs, which is fine for the existing review model but not enough for a candidate-first acceptance flow [VERIFIED: repo]. LangGraph docs make the durable pattern clear: use a durable checkpointer plus a stable `thread_id`, and resume the same thread after an interrupt or review step rather than spinning up a second concurrent run [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts][CITED: https://docs.langchain.com/oss/python/langgraph/durable-execution][CITED: https://docs.langchain.com/oss/python/langgraph/persistence].

**Primary recommendation:** reuse the existing resource-scoped rerun plumbing, add explicit candidate/current promotion and one-hop lineage metadata, and gate all corrective reruns through the same durable thread rather than a second full run.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.135.3 (2026-04-01) [VERIFIED: PyPI] | API routes, deps, WebSocket shell | Existing app shell already uses it; Phase 5 should extend route contracts, not add a second API layer [VERIFIED: backend/pyproject.toml]. |
| LangGraph | 1.1.6 (2026-04-03) [VERIFIED: PyPI] | Durable orchestration, interrupts, resume | Same-thread creator corrections map directly to `interrupt()` + `Command(resume=...)` + `thread_id` [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts][CITED: https://docs.langchain.com/oss/python/langgraph/persistence]. |
| langgraph-checkpoint-postgres | 3.0.5 (2026-03-18) [VERIFIED: PyPI] | Persistent checkpoint store | Production checkpointing is required if acceptance/rerun state must survive process restarts [CITED: https://docs.langchain.com/oss/python/langgraph/persistence]. |
| PostgreSQL | 16+ [VERIFIED: repo stack] | Primary relational store | Keeps candidate/current and lineage state server-authored and auditable. |
| SQLModel / SQLAlchemy | 0.0.38 / 2.0.49 (2026-04-02 / 2026-04-??) [VERIFIED: PyPI] | ORM + schema layer | Existing approval models already live here; add minimal state fields instead of inventing a new persistence layer. |
| React | 19.2.5 (2026-04-09) [VERIFIED: npm registry] | Canvas/workspace UI | The creative-control UI belongs in the existing React workspace, not a separate surface. |
| tldraw | 4.5.8 (2026-04-10) [VERIFIED: npm registry] | Infinite canvas workspace | Current canvas projection already rides on tldraw; Phase 5 should extend the shape contract and actions. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TanStack Query | 5.97.0 (2026-04-09) [VERIFIED: npm registry] | Query/mutation cache | Invalidate candidate/current state and rerun results after acceptance or prompt edits. |
| Zustand | 5.0.12 (2026-04-09) [VERIFIED: npm registry] | Local editor state | Keep selection, candidate/current focus, and pending edit state in the canvas shell. |
| Tailwind CSS | 4.2.2 (2026-04-07) [VERIFIED: npm registry] | Styling | Extend the current workspace shell without introducing a second styling system. |
| DaisyUI | 5.5.19 (2026-02-20) [VERIFIED: npm registry] | Component primitives | Useful for badges, action bars, and review-state affordances in the workspace. |
| Vitest | 4.1.4 [VERIFIED: npm registry] | Frontend unit tests | Extend the existing canvas and workspace regression slices. |
| Playwright | 1.59.1 [VERIFIED: npm registry] | E2E tests | Use only for the final acceptance flow if component tests can’t cover the interaction. |
| pytest / pytest-asyncio | 9.0.3 / 1.3.0 [VERIFIED: PyPI] | Backend tests | Existing API/regenerate coverage should be tightened rather than replaced. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Candidate/current promotion on the existing artifact | Full version browser | More history, but out of scope and harder to keep aligned with the current canvas shell. |
| Same-thread corrective rerun | A second concurrent run | Easier to reason about superficially, but breaks the single-active-run contract. |
| Incremental rerun with direct downstream invalidation | Project-wide reset | Simpler implementation, but violates the locked blast-radius rules. |

**Installation:**
```bash
uv add langgraph langgraph-checkpoint-postgres
pnpm add react tldraw @tanstack/react-query zustand tailwindcss daisyui
```

**Version verification:** upstream versions were checked with `npm view ... version` / PyPI JSON [VERIFIED: npm registry][VERIFIED: PyPI].

## Architecture Patterns

### Recommended Project Structure
```text
backend/app/
├── api/v1/routes/        # accept/regenerate endpoints + active-run guards
├── models/               # candidate/current + approval/version source of truth
├── orchestration/        # review routing, target_ids, rerun mode selection
├── services/             # invalidation, promotion, lineage projection helpers
└── schemas/              # request/response DTOs for rerun + accept flows

frontend/app/
├── components/canvas/    # creative-control actions and lineage badges
├── components/ui/        # edit/accept modals and confirm affordances
├── stores/               # current/candidate selection and pending edit state
├── services/             # accept/regenerate API calls
└── utils/                # workspace status + one-hop lineage labels
```

### Pattern 1: Resource-scoped corrective rerun
**What:** use the existing `resource_type` / `resource_id` lock plus `TargetIds` to rerun only the selected artifact and its direct dependents [VERIFIED: repo].  
**When to use:** character, shot, or clip correction.  
**Example:**
```python
# Source: backend/app/agents/review.py and backend/app/orchestration/nodes.py [VERIFIED: repo]
mode = "incremental"
target_ids = TargetIds(character_ids=[character_id], shot_ids=[shot_id])
await orchestrator._cleanup_for_rerun(project_id, start_agent, mode=mode)
```

### Pattern 2: Durable approval gate
**What:** pause at a review point with `interrupt()`, then resume the same `thread_id` with `Command(resume=...)` after the creator edits or accepts [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts].  
**When to use:** candidate acceptance, prompt correction, or any creator-confirmed rerun.  
**Example:**
```python
from langgraph.types import Command, interrupt

def approval_node(state):
    approved = interrupt({"question": "Accept this candidate?", "details": state["summary"]})
    return {"approved": approved}

config = {"configurable": {"thread_id": "project-123"}}
graph.invoke(Command(resume=True), config=config)
```

### Anti-Patterns to Avoid
- **Second concurrent run for correction:** breaks the single-active-run rule and makes candidate/current state ambiguous.
- **Immediate overwrite of current output:** destroys rollback context before acceptance.
- **Project-wide delete/reset for one edit:** violates the locked blast-radius rules.
- **Client-side-only lineage labels:** the UI can drift; backend must author the current/superseded state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Durable pause/resume | Ad hoc retry flags | LangGraph checkpointer + `thread_id` + `interrupt()` | Same-thread resume and replay are built in [CITED: https://docs.langchain.com/oss/python/langgraph/persistence][CITED: https://docs.langchain.com/oss/python/langgraph/interrupts]. |
| Incremental rerun locks | Custom per-screen mutexes | Existing `AgentRun.resource_type/resource_id` + `TargetIds` | The repo already uses resource-scoped locks for character/shot reruns [VERIFIED: repo]. |
| Lineage projection | Hand-built version browser | One-hop backend metadata + `workspaceStatus` projection | Keeps the canvas simple and aligned with the current workspace shell [VERIFIED: repo]. |
| Acceptance/promotion | Frontend-only state swap | Server-authored accept mutation | Prevents local spoofing of current/candidate status. |

**Key insight:** the hard part is not rerunning an asset; it is preserving the current approved artifact while making the candidate, invalidation, and acceptance flow explicit and machine-verifiable.

## Common Pitfalls

### Pitfall 1: Overwriting current state before acceptance
**What goes wrong:** a failed or rejected candidate can erase the only good output.  
**Why it happens:** regenerate routes currently clear old URLs immediately [VERIFIED: repo].  
**How to avoid:** stage a candidate first, accept later, and only then supersede current.  
**Warning signs:** a rerun leaves the workspace without a visible current artifact.

### Pitfall 2: Over-invalidating downstream artifacts
**What goes wrong:** unrelated clips or final output disappear after a shot/character edit.  
**Why it happens:** cleanup logic is too coarse or is reused without scoping.  
**How to avoid:** keep direct-downstream invalidation centralized and resource-scoped.  
**Warning signs:** character edits clear unrelated shots or recreate the whole project.

### Pitfall 3: Breaking durable replay semantics
**What goes wrong:** a resumed graph replays side effects or diverges from the intended candidate state.  
**Why it happens:** code before `interrupt()` is not idempotent, or a new thread_id is used on resume [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts][CITED: https://docs.langchain.com/oss/python/langgraph/durable-execution].  
**How to avoid:** keep side effects idempotent, isolate them after the pause, and always resume on the same thread.  
**Warning signs:** duplicated files/messages or “accepted” candidates that don’t match the paused state.

### Pitfall 4: UI state drifting from backend truth
**What goes wrong:** the canvas shows the wrong artifact as current or fails to show superseded state.  
**Why it happens:** local store mutations outpace server broadcast and refetch.  
**How to avoid:** treat websocket + query invalidation as the source of truth, and project lineage from backend fields.  
**Warning signs:** the canvas badge says current while the API returns superseded.

## Code Examples

Verified patterns from official sources:

### Human-in-the-loop approval with `interrupt()`
```python
from langgraph.types import interrupt, Command

def review_node(state):
    decision = interrupt({
        "question": "Approve this candidate?",
        "details": state["details"],
    })
    return {"approved": decision}

graph.invoke(Command(resume=True), config={"configurable": {"thread_id": "thread-1"}})
```
Source: [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts]

### Durable checkpointing with a stable `thread_id`
```python
from langgraph.checkpoint.postgres import PostgresSaver

checkpointer = PostgresSaver.from_conn_string("postgresql://...")
graph = builder.compile(checkpointer=checkpointer)
graph.invoke(input, config={"configurable": {"thread_id": "project-123"}})
```
Source: [CITED: https://docs.langchain.com/oss/python/langgraph/persistence]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full-run rerun for every correction | Resource-scoped incremental rerun with `target_ids` | Already present in the repo [VERIFIED: repo] | Makes selective correction feasible without restarting the whole project. |
| One-shot overwrite of outputs | Approval-aware current / superseded snapshots | Phase 3 already established the contract [VERIFIED: repo] | Gives the canvas a stable “current” reference and a safe fallback. |
| Volatile pause/resume | LangGraph checkpointer + same `thread_id` resume | LangGraph docs current as of 2026 [CITED: https://docs.langchain.com/oss/python/langgraph/persistence] | Durable review/accept flows survive crashes and reopen correctly. |

**Deprecated/outdated:**
- A full version browser for Phase 5 — explicitly deferred [VERIFIED: CONTEXT.md].
- A second concurrent run for a single corrective edit — conflicts with the locked active-run policy [VERIFIED: CONTEXT.md].

## Open Questions (RESOLVED)

1. **RESOLVED — Should candidate acceptance be a dedicated mutation or a resume step on the same thread?**
   - Resolution: keep the durable thread as the execution boundary, and expose acceptance as a simple creator action on the existing HTTP surface.
   - Rationale: LangGraph still owns the durable resume boundary via `interrupt()` + `Command(resume=...)`, while the product keeps a straightforward server-authored accept action [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts][VERIFIED: repo].

2. **RESOLVED — Where should one-hop lineage live?**
   - Resolution: keep canonical state server-side and project a UI-friendly summary into `workspaceStatus`.
   - Rationale: the workspace only needs current/superseded plus a short regeneration reason, and the backend should author that summary so the canvas cannot drift [VERIFIED: CONTEXT.md].

3. **RESOLVED — Should shot rerun edits include cast and image prompt in the same payload as prompt text?**
   - Resolution: use a single validated payload that carries the prompt plus the structured shot fields allowed by the locked decision.
   - Rationale: the locked Phase 5 decision already permits cast, camera, duration, motion note, and image prompt edits before rerun, so the backend should accept one coherent candidate draft [VERIFIED: CONTEXT.md].

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| uv | Backend dependency management / test runs | ✓ | 0.11.3 | — |
| pnpm | Frontend dependency management / test runs | ✓ | 10.18.3 | — |
| node | Frontend toolchain / Vitest / Vite | ✓ | v25.9.0 | — |
| python3 | Backend tooling / local scripts | ✓ | 3.14.3 | — |
| psql | Local Postgres verification | ✓ | 18.3 | — |
| redis-cli | Local Redis verification | ✓ | 9.0.3 | — |

**Missing dependencies with no fallback:**
- None — the local toolchain needed for planning and verification is present.

**Missing dependencies with fallback:**
- None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Backend: pytest 9.0.3 + pytest-asyncio 1.3.0 [VERIFIED: PyPI]; Frontend: Vitest 4.1.4 + Testing Library + Playwright 1.59.1 [VERIFIED: npm registry] |
| Config file | `backend/pyproject.toml`, `frontend/package.json`, `frontend/vite.config.ts` [VERIFIED: repo] |
| Quick run command | `uv run pytest tests/test_api/test_character_storyboard_review.py tests/test_api/test_shots.py -q && pnpm test -- --run app/components/canvas/InfiniteCanvas.test.tsx app/components/canvas/StoryboardSectionShape.test.tsx` |
| Full suite command | `pnpm test && pnpm exec tsc --noEmit && uv run pytest -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REVI-01 | Selective rerun only affects the selected artifact and direct downstream dependents. | integration | `uv run pytest tests/test_api/test_review_creative_control.py -q` | ❌ new backend file needed |
| REVI-01 | Accepted candidate becomes current and previous current becomes superseded; workspace shows one-hop lineage. | backend + frontend integration | `uv run pytest tests/test_api/test_character_storyboard_review.py tests/test_api/test_shots.py -q && pnpm test -- --run app/utils/workspaceStatus.test.ts app/components/canvas/CharacterSectionShape.test.tsx app/components/canvas/StoryboardSectionShape.test.tsx` | ✅ existing slices, but acceptance assertions need tightening |
| REVI-02 | Shot rerun accepts prompt / instruction edits before rerun starts. | integration | `uv run pytest tests/test_api/test_shots.py -q` | ✅ existing file, but current assertion is placeholder |
| REVI-02 | Edit modal exposes structured shot fields for correction before rerun. | component | `pnpm test -- --run app/components/canvas/ProjectOverview.test.tsx app/components/canvas/InfiniteCanvas.test.tsx` | ❌ new frontend file needed |

### Sampling Rate
- **Per task commit:** focused backend API slice or focused canvas slice above.
- **Per wave merge:** one backend slice + one frontend slice for the requirement being changed.
- **Phase gate:** full frontend + backend suite green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `backend/tests/test_api/test_review_creative_control.py` — missing candidate/current acceptance and direct-downstream invalidation coverage.
- [ ] `frontend/app/components/canvas/ProjectOverview.test.tsx` — missing edit-before-rerun payload coverage.
- [ ] `frontend/app/utils/workspaceStatus.test.ts` — extend with candidate/current lineage labels if the status projection changes.
- [ ] `backend/tests/test_api/test_shots.py` — replace the placeholder regenerate assertion with the real contract.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing admin-gated routes already use `X-Admin-Token`; Phase 5 mutations should remain server-authorized and not rely on client-side gating [VERIFIED: backend/app/api/deps.py; VERIFIED: backend/app/api/v1/routes/generation.py]. |
| V3 Session Management | no / inherited | No new session system; keep the existing app auth/session boundary. |
| V4 Access Control | yes | Project-scoped lookup plus resource-scoped rerun locks (`resource_type`, `resource_id`) and creator acceptance checks [VERIFIED: backend/app/api/v1/routes/characters.py; VERIFIED: backend/app/api/v1/routes/shots.py]. |
| V5 Input Validation | yes | Pydantic schemas for prompt edits, structured shot fields, and target IDs; validate all rerun overrides server-side [VERIFIED: backend/app/schemas/project.py]. |
| V6 Cryptography | no | No new crypto is introduced; if checkpoint encryption is enabled later, rely on LangGraph’s encrypted serializer support [CITED: https://docs.langchain.com/oss/python/langgraph/persistence]. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-project mutation via crafted `character_id` / `shot_id` | Tampering / Elevation of privilege | Always fetch by id, compare `project_id`, and reject mismatches before accept/rerun. |
| Replaying a rerun on the wrong thread | Tampering | Keep the durable cursor bound to the project/run and reuse the same `thread_id` on resume [CITED: https://docs.langchain.com/oss/python/langgraph/persistence]. |
| Prompt/input tampering on shot correction | Tampering | Use an allowlisted correction schema; never trust client-side field visibility alone. |
| Over-deleting downstream assets | Denial of service | Centralize direct-downstream invalidation and avoid project-wide cleanup for a single correction. |

## Sources

### Primary (HIGH confidence)
- `/home/xeron/Coding/openOii/.planning/phases/05-review-creative-control/05-CONTEXT.md` - locked decisions, out-of-scope items, and discretionary boundaries [VERIFIED: repo]
- `/home/xeron/Coding/openOii/backend/app/models/project.py` - approval-aware Character/Shot snapshots and `freeze_approval()` [VERIFIED: repo]
- `/home/xeron/Coding/openOii/backend/app/api/v1/routes/characters.py` - character update/approve/regenerate routes [VERIFIED: repo]
- `/home/xeron/Coding/openOii/backend/app/api/v1/routes/shots.py` - shot update/approve/regenerate routes [VERIFIED: repo]
- `/home/xeron/Coding/openOii/backend/app/agents/review.py` and `/home/xeron/Coding/openOii/backend/app/orchestration/nodes.py` - incremental rerun routing with `mode` and `target_ids` [VERIFIED: repo]
- `/home/xeron/Coding/openOii/frontend/app/utils/workspaceStatus.ts` - current workspace status projection states [VERIFIED: repo]
- `/home/xeron/Coding/openOii/frontend/app/components/canvas/InfiniteCanvas.tsx` - approve / regenerate event wiring [VERIFIED: repo]
- `/home/xeron/Coding/openOii/frontend/app/components/canvas/ProjectOverview.tsx` - edit modal and regeneration actions [VERIFIED: repo]
- `/home/xeron/Coding/openOii/backend/pyproject.toml` and `/home/xeron/Coding/openOii/frontend/package.json` - current dependency baselines [VERIFIED: repo]
- LangGraph docs: `https://docs.langchain.com/oss/python/langgraph/interrupts`, `https://docs.langchain.com/oss/python/langgraph/durable-execution`, `https://docs.langchain.com/oss/python/langgraph/persistence` [CITED]

### Secondary (MEDIUM confidence)
- PyPI / npm registry version checks for FastAPI, LangGraph, React, tldraw, TanStack Query, Zustand, Tailwind CSS, DaisyUI, pytest, and Playwright [VERIFIED: PyPI][VERIFIED: npm registry]

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions and capabilities were verified against package registries and repo manifests.
- Architecture: HIGH - the repo already contains most of the required control-path plumbing.
- Pitfalls: HIGH - validated against current repo behavior and current LangGraph docs.

**Research date:** 2026-04-11  
**Valid until:** 2026-05-11

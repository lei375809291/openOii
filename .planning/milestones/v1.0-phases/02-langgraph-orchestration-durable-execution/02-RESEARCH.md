# Phase 2: LangGraph Orchestration & Durable Execution - Research

**Researched:** 2026-04-11  
**Domain:** LangGraph durable execution, checkpoint-backed resume, approval interrupts, and recovery UX  
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- When the system detects a resumable run, it must show a recovery summary before continuing; it must not silently auto-resume.
- The recovery summary should explain where the run stopped, which stages are already preserved, and what stage execution will continue from.
- Phase 2 uses blocking `interrupt()` gates at character approval and storyboard approval only.
- When a gate is reached, execution stops explicitly and waits for user action; it does not auto-timeout and continue.
- At a gate, the creator can either continue or submit feedback that reroutes/re-runs the current branch.
- Final merge does not get a new human approval gate in Phase 2.
- A project may have only one active full run at a time in Phase 2.
- If the user starts generation while an active run already exists, the system should not create a new full run; it should prompt the user to resume or cancel the existing run first.
- A run paused at an approval gate still counts as active.
- Resource-level selective regeneration is not expanded into a separate Phase 2 run model; that stays deferred to later phases.
- The product-level recovery promise is stage-level resume from the last valid stage, not shot/asset-level recovery.
- Inside a stage, nodes may skip already-produced outputs idempotently, but that remains an internal optimization rather than a user-facing recovery unit.
- `Run` carries the main recovery boundary and persisted `thread_id`; `Stage` records stage lineage; `Artifact` remains provenance-oriented in Phase 2 rather than becoming the primary recovery control plane.
- The recovery summary shown to the creator stays stage-oriented rather than exposing shot-level or asset-level recovery controls.

### the agent's Discretion
- The exact LangGraph node decomposition, subgraph boundaries, and durable mode selection per node are at the agent's discretion as long as they preserve single active-run semantics, stage-level recovery, idempotent re-entry, and the approved review-gate behavior.
- The implementation may reuse or wrap existing manual orchestrator logic during migration, but the final Phase 2 execution path must be LangGraph-first and checkpoint-driven.

### Deferred Ideas (OUT OF SCOPE)
- Multiple active full runs per project.
- Shot-level or asset-level recovery controls exposed directly in the UI.
- A final human approval gate before merge.
- Turning resource-level selective regeneration into a first-class Phase 2 run model.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PIPE-01 | A creator can trigger a full generation run that executes the end-to-end pipeline from story input to final merged video. | LangGraph `StateGraph` + `thread_id` + durable checkpointer + stage nodes/subgraphs + existing generation entrypoints [CITED: https://docs.langchain.com/oss/python/langgraph/persistence, https://docs.langchain.com/oss/python/langgraph/use-time-travel, VERIFIED: backend/app/orchestration/*.py, backend/app/api/v1/routes/generation.py]. |
| REL-01 | A creator can resume a run after interruption or failure from the last valid stage instead of restarting the entire pipeline. | Checkpoint history, `get_state_history`, `update_state`, `Command(resume=...)`, and interrupt semantics [CITED: https://docs.langchain.com/oss/python/langgraph/persistence, https://docs.langchain.com/oss/python/langgraph/interrupts, https://docs.langchain.com/oss/python/langgraph/use-time-travel]. |
</phase_requirements>

## Summary

Phase 2 should be planned as a migration from the current process-local orchestrator to a checkpoint-first LangGraph execution path, not as a new parallel system [VERIFIED: backend/app/agents/orchestrator.py, backend/app/orchestration/graph.py, backend/app/orchestration/runtime.py]. The current repo already has the key persistence primitives in place: `Run.thread_id` is the graph boundary, `Stage`/`Artifact` already exist, and the frontend already understands run-progress / confirm events [VERIFIED: backend/app/models/run.py, backend/app/models/stage.py, backend/app/models/artifact.py, frontend/app/hooks/useWebSocket.ts, frontend/app/pages/ProjectPage.tsx].

The LangGraph docs make the design constraints explicit: checkpoints are organized by `thread_id`, saved per super-step, and replay/fork/resume all happen from checkpoint state rather than ad hoc task state [CITED: https://docs.langchain.com/oss/python/langgraph/persistence, https://docs.langchain.com/oss/python/langgraph/use-time-travel]. For Phase 2, the important planning choice is not "how do we keep running?" but "how do we expose the saved checkpoint before resuming, preserve only stage-level recovery, and keep approval gates idempotent and blocking?" [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts].

**Primary recommendation:** keep `Run.thread_id` as the only run cursor, compile the pipeline with a durable Postgres checkpointer, and use `interrupt()` only at character and storyboard approvals while surfacing recovery from `get_state_history` before any resume [CITED: https://docs.langchain.com/oss/python/langgraph/persistence, https://docs.langchain.com/oss/python/langgraph/interrupts, https://docs.langchain.com/oss/python/langgraph/use-time-travel].

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `langgraph` | 1.1.6 [VERIFIED: `python3 -m pip index versions langgraph`] | Graph runtime, durable execution, interrupts, replay, and state history | This is the library that provides `StateGraph`, `interrupt()`, `Command(resume=...)`, `get_state_history()`, and `update_state()` [CITED: https://docs.langchain.com/oss/python/langgraph/persistence, https://docs.langchain.com/oss/python/langgraph/interrupts, https://docs.langchain.com/oss/python/langgraph/use-time-travel]. |
| `langgraph-checkpoint-postgres` | 3.0.5 [VERIFIED: `python3 -m pip index versions langgraph-checkpoint-postgres`] | Production checkpoint storage | Phase 2 needs durable PostgreSQL checkpoints; the docs call Postgres the production checkpointer path [CITED: https://docs.langchain.com/oss/python/langgraph/persistence, https://docs.langchain.com/langsmith/configure-checkpointer.md]. |
| PostgreSQL | 16+ (project baseline) [VERIFIED: AGENTS.md / `.planning/ROADMAP.md`] | Primary persistence for runs, stages, artifacts, and checkpoints | Existing lineage tables already live here, and LangGraph durable execution depends on a persistent backend [VERIFIED: backend/app/models/run.py, backend/app/models/stage.py, backend/app/models/artifact.py]. |
| FastAPI | 0.135.3 current / 0.115.0 repo [VERIFIED: `python3 -m pip index versions fastapi`, backend/pyproject.toml] | API shell for generate/resume/recovery endpoints | Keep the API shell; Phase 2 should not force a framework rewrite [VERIFIED: backend/app/api/v1/routes/generation.py]. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `SQLModel` / `SQLAlchemy` | 0.0.31 / 2.x [VERIFIED: backend/pyproject.toml] | Run/stage/artifact lineage models | Use for the product-facing run tables; LangGraph checkpoints are separate from these tables [VERIFIED: backend/app/models/run.py, backend/app/models/stage.py, backend/app/models/artifact.py; CITED: https://docs.langchain.com/oss/python/langgraph/persistence]. |
| `React` / `Zustand` / `TanStack Query` | 18.3.1 / 5.0.2 / 5.62.0 [VERIFIED: frontend/package.json] | Recovery summary, gating state, and live run UI | Use the existing store/query surfaces to show resumable-run state and approval gates [VERIFIED: frontend/app/hooks/useWebSocket.ts, frontend/app/pages/ProjectPage.tsx]. |
| `InMemorySaver` | bundled | Unit-test checkpointing | Use for fast graph tests; do not treat it as production persistence [CITED: https://docs.langchain.com/oss/python/langgraph/persistence]. |
| `Command` / `interrupt()` | bundled | Blocking approval gates and resume payloads | Use these primitives instead of the current Redis confirm loop [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts]. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Postgres checkpointer | InMemorySaver / SQLite saver | Fine for tests, but not durable enough for Phase 2 resumability [CITED: https://docs.langchain.com/oss/python/langgraph/persistence]. |
| `interrupt()` approval gates | Custom WebSocket confirm polling | Harder to make blocking, resumable, and checkpoint-safe [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts]. |
| Manual orchestrator cleanup/re-run logic | `update_state()` + replay/fork | Manual cleanup re-implements checkpoint behavior and is easier to get wrong [CITED: https://docs.langchain.com/oss/python/langgraph/use-time-travel]. |

**Installation:**
```bash
uv add langgraph==1.1.6 langgraph-checkpoint-postgres==3.0.5
```

**Version verification:** verified current package versions with `python3 -m pip index versions ...` [VERIFIED].

## Architecture Patterns

### Recommended Project Structure
```text
backend/app/orchestration/
├── state.py        # graph state schema and reducers
├── runtime.py      # thread_id / config helpers
├── graph.py        # compile root graph and checkpoints
├── nodes/          # stage/node implementations
└── stages/         # optional subgraphs for stage-local checkpoint granularity
```

### Pattern 1: Root graph owns the run boundary
**What:** the root `StateGraph` owns the full pipeline and is compiled with a durable checkpointer [CITED: https://docs.langchain.com/oss/python/langgraph/persistence].  
**When to use:** always for the Phase 2 end-to-end path, because `Run.thread_id` is the authoritative recovery cursor [VERIFIED: backend/app/models/run.py, backend/app/orchestration/runtime.py].  
**Example:**
```python
# Source: https://docs.langchain.com/oss/python/langgraph/persistence
config = {"configurable": {"thread_id": run.thread_id}}
graph = builder.compile(checkpointer=checkpointer)
```

### Pattern 2: Blocking approval gates with `interrupt()`
**What:** pause at character approval and storyboard approval only, then resume with `Command(resume=...)` [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts].  
**When to use:** exactly at the two creator-review gates locked in CONTEXT.md.  
**Example:**
```python
# Source: https://docs.langchain.com/oss/python/langgraph/interrupts
from langgraph.types import Command, interrupt

def approval_node(state):
    decision = interrupt({"question": "Approve this stage?"})
    return {"approved": decision}

# resume later with the same thread_id
graph.invoke(Command(resume=True), config=config)
```

### Pattern 3: Recovery summary from checkpoint history before resume
**What:** inspect the latest checkpoint, summarize where execution stopped, and only then continue [CITED: https://docs.langchain.com/oss/python/langgraph/use-time-travel].  
**When to use:** every time the system detects a resumable run.  
**Example:**
```python
# Source: https://docs.langchain.com/oss/python/langgraph/use-time-travel
history = list(graph.get_state_history(config))
latest = history[0]
summary = {
    "thread_id": latest.config["configurable"]["thread_id"],
    "checkpoint_id": latest.config["configurable"]["checkpoint_id"],
    "next": latest.next,
}
```

### Anti-Patterns to Avoid
- **Silent auto-resume:** violates the explicit recovery-summary requirement [VERIFIED: CONTEXT.md].
- **Custom confirm loops with timeouts:** duplicates interrupt semantics and is easy to desync from checkpoints [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts].
- **Non-idempotent side effects before `interrupt()`:** resume re-runs the node from the top, so early side effects can duplicate [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts].
- **Using `thread_id` as an authorization token:** it is a persistence pointer, not an access-control boundary [CITED: https://docs.langchain.com/oss/python/langgraph/persistence].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Durable checkpoint storage | Custom checkpoint tables / JSON blobs | `langgraph-checkpoint-postgres` | Saves graph state per thread and supports replay/resume semantics [CITED: https://docs.langchain.com/oss/python/langgraph/persistence]. |
| Approval gating | Redis polling / websocket timeouts | `interrupt()` + `Command(resume=...)` | Native blocking resume semantics, no timeout races [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts]. |
| Resume/fork logic | Manual pointer juggling | `get_state_history()` + `update_state()` | Time travel and branching are first-class and safer [CITED: https://docs.langchain.com/oss/python/langgraph/use-time-travel]. |
| Stage recovery UI data | Reconstructing from logs only | Checkpoint history + `Run`/`Stage` lineage | The docs and current schema already separate runtime state from provenance [VERIFIED + CITED]. |

**Key insight:** the checkpointer is the execution source of truth; `Run`/`Stage`/`Artifact` are product lineage records, not the execution engine [CITED: https://docs.langchain.com/oss/python/langgraph/persistence, VERIFIED: backend/app/models/run.py, backend/app/models/stage.py, backend/app/models/artifact.py].

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Legacy `agentrun` / `agentmessage` rows; canonical `run` / `stage` / `artifact` rows already exist [VERIFIED: backend/app/models/agent_run.py, backend/app/models/run.py, backend/app/models/stage.py, backend/app/models/artifact.py]. | Code edit for new writes; optional migration/backfill only if old runs must appear in the new resumable UI. |
| Live service config | None beyond normal `DATABASE_URL` / `REDIS_URL` / provider env wiring in repo config [VERIFIED: README.md, backend/app/config.py]. | None. |
| OS-registered state | None found. [VERIFIED: repo search] | None. |
| Secrets/env vars | Existing env names (`DATABASE_URL`, `REDIS_URL`, `ANTHROPIC_*`, `IMAGE_*`, `VIDEO_*`) are unchanged [VERIFIED: README.md, backend/app/config.py]. | None unless checkpoint payloads start containing secrets; then enable encrypted serialization [CITED: https://docs.langchain.com/oss/python/langgraph/persistence]. |
| Build artifacts | No phase-specific compiled artifacts found. [VERIFIED: repo search] | Clean rebuild after dependency changes; no data migration. |

**Nothing found in category:** OS-registered state. [VERIFIED: repo search]

## Common Pitfalls

### Pitfall 1: Treating `thread_id` like a job ID
**What goes wrong:** the UI or API starts creating a new run instead of resuming the existing thread [VERIFIED: CONTEXT.md].  
**Why it happens:** legacy task-manager thinking bleeds into checkpointed execution.  
**How to avoid:** always load by `thread_id`, inspect history, and require explicit user action before resume [CITED: https://docs.langchain.com/oss/python/langgraph/persistence, https://docs.langchain.com/oss/python/langgraph/use-time-travel].  
**Warning signs:** duplicate runs for the same project, or resume actions that do not show a recovery summary.

### Pitfall 2: Doing side effects before `interrupt()`
**What goes wrong:** resumed nodes repeat the side effect and create duplicates [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts].  
**Why it happens:** `interrupt()` restarts the node from the beginning on resume.  
**How to avoid:** move writes after the interrupt or make them idempotent.  
**Warning signs:** duplicate artifacts, duplicate DB rows, or repeated provider calls after resume.

### Pitfall 3: Using static interrupts for product approvals
**What goes wrong:** `interrupt_before` / `interrupt_after` are compile/run-time debugging breakpoints, not user approval gates [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts].  
**Why it happens:** the names sound similar.  
**How to avoid:** reserve static interrupts for debugging; use `interrupt()` for the creator review flow.  
**Warning signs:** approval UI that only works in tests or disappears in production.

## Code Examples

Verified patterns from official sources:

### Durable graph + thread_id
```python
# Source: https://docs.langchain.com/oss/python/langgraph/persistence
from langgraph.graph import StateGraph, START, END

config = {"configurable": {"thread_id": run.thread_id}}
graph = builder.compile(checkpointer=checkpointer)
```

### Blocking creator approval
```python
# Source: https://docs.langchain.com/oss/python/langgraph/interrupts
from langgraph.types import Command, interrupt

def approval_node(state):
    approved = interrupt({"question": "Approve storyboard?"})
    return {"approved": approved}

graph.invoke(Command(resume=True), config=config)
```

### Recover from the last valid checkpoint
```python
# Source: https://docs.langchain.com/oss/python/langgraph/use-time-travel
history = list(graph.get_state_history(config))
resume_from = history[0].config
graph.invoke(None, resume_from)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual agent runner + process-local task state [VERIFIED: backend/app/agents/orchestrator.py, backend/app/api/v1/routes/generation.py] | LangGraph `StateGraph` with durable checkpoints [CITED: https://docs.langchain.com/oss/python/langgraph/persistence] | Phase 2 | Runs become resumable and replayable by checkpoint instead of by process memory. |
| Redis confirm loop + timeout wait [VERIFIED: backend/app/agents/orchestrator.py] | `interrupt()` + `Command(resume=...)` [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts] | Phase 2 | Review gates become blocking, explicit, and checkpoint-safe. |
| Cleanup-and-rerun rerouting [VERIFIED: backend/app/agents/orchestrator.py] | `update_state()` fork/replay [CITED: https://docs.langchain.com/oss/python/langgraph/use-time-travel] | Phase 2 | Resumes preserve prior work without recomputing earlier stages. |

**Deprecated/outdated:**
- Process-local task tracking as the orchestration truth [VERIFIED: backend/app/api/v1/routes/generation.py, backend/app/ws/manager.py].
- Silent auto-resume without a recovery summary [VERIFIED: CONTEXT.md].
- Treating approval gates as websocket-only UI events instead of graph interrupts [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts].

## Assumptions Log

> All locked decisions were provided in CONTEXT.md, so there are no hidden policy assumptions below.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | None | — | — |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Resolved / Deferred Questions

1. **Stage decomposition** — resolved to root-graph nodes first.
   - What we know: the agent has discretion, and subgraphs with their own checkpointer give finer checkpoint granularity [CITED: https://docs.langchain.com/oss/python/langgraph/use-time-travel].
   - Decision: default to root-graph stages first; introduce subgraph checkpointers only where a stage needs its own recovery boundary.

2. **Legacy `agentrun` / `agentmessage` history migration** — deferred.
   - What we know: both legacy and canonical lineage tables exist today [VERIFIED: backend/app/models/agent_run.py, backend/app/models/run.py].
   - Decision: keep old history readable; only backfill if product later wants pre-Phase-2 runs to appear as resumable threads.

3. **Checkpoint payload encryption** — resolved as conditional.
   - What we know: LangGraph supports encrypted serializers and `LANGGRAPH_AES_KEY` [CITED: https://docs.langchain.com/oss/python/langgraph/persistence].
   - Decision: do not store secrets in graph state; enable encrypted serialization only if sensitive prompts or artifacts must persist in checkpoints.

**Gate closed:** no unresolved research questions remain for Phase 2 planning.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Python | Backend graph/runtime work | ✓ | 3.14.3 | — |
| uv | Python dependency management | ✓ | 0.11.3 | — |
| Node.js | Frontend recovery UI work | ✓ | 25.9.0 | — |
| pnpm | Frontend dependency management | ✓ | 10.18.3 | — |
| PostgreSQL client | Checkpointer / DB validation | ✓ | 18.3 | Use Docker Compose DB if local server is not running |
| PostgreSQL server | Durable checkpoints / integration tests | ✗ | — | Use Docker Compose / test container |
| Redis / Valkey server | Existing runtime deps, current orchestration bridge | ✗ | — | Use Docker Compose / test container |
| FFmpeg | Existing media pipeline and regression tests | ✓ | 8.1 | — |
| Docker | Local DB/service bring-up | ✓ | 29.3.1 | — |

**Missing dependencies with no fallback:**
- None.

**Missing dependencies with fallback:**
- PostgreSQL server — use Docker Compose-managed Postgres for integration tests and checkpoint validation.
- Redis / Valkey server — use Docker Compose-managed Redis/Valkey for runtime parity.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio 0.24+ [VERIFIED: backend/pyproject.toml] |
| Config file | `backend/pyproject.toml` |
| Quick run command | `pytest backend/tests/test_orchestration/test_phase2_graph.py -q` |
| Full suite command | `pytest backend/tests -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PIPE-01 | Full pipeline starts and reaches the final merge path with a real `thread_id`. | integration | `pytest backend/tests/test_orchestration/test_phase2_graph.py -q` | ❌ Wave 0 |
| PIPE-01 | API refuses to create a new run when one active full run already exists. | API/unit | `pytest backend/tests/test_api/test_phase2_generation.py -q` | ❌ Wave 0 |
| REL-01 | A paused or interrupted run resumes from the last valid checkpoint / stage. | integration | `pytest backend/tests/test_orchestration/test_phase2_recovery.py -q` | ❌ Wave 0 |
| REL-01 | Postgres checkpoint round-trip persists and restores thread state. | integration | `pytest backend/tests/integration/test_langgraph_postgres.py -q` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest backend/tests/test_orchestration/test_phase2_graph.py -q` [after Wave 0 adds the file]
- **Per wave merge:** `pytest backend/tests -q`
- **Phase gate:** full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_orchestration/test_phase2_graph.py` — covers PIPE-01 happy-path graph execution.
- [ ] `backend/tests/test_orchestration/test_phase2_recovery.py` — covers REL-01 checkpoint resume/replay.
- [ ] `backend/tests/test_api/test_phase2_generation.py` — covers single-active-run conflict behavior.
- [ ] `backend/tests/integration/test_langgraph_postgres.py` — covers durable Postgres checkpoint persistence.
- [ ] `backend/tests/conftest.py` — add a Postgres-backed fixture if integration tests need real checkpoint storage.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Keep project/run endpoints behind existing auth/role checks; do not expose resume as anonymous control [VERIFIED: backend/app/api/v1/routes/generation.py]. |
| V3 Session Management | yes | Treat `thread_id` as a persistent cursor, not a bearer token; resume only on the same authenticated project context [CITED: https://docs.langchain.com/oss/python/langgraph/persistence]. |
| V4 Access Control | yes | Verify project ownership before reading history, resuming, or forking checkpoints [VERIFIED + CITED]. |
| V5 Input Validation | yes | Validate `thread_id`, `checkpoint_id`, approval payloads, and any reroute data with Pydantic / typed graph state [VERIFIED: backend/pyproject.toml, CITED: https://docs.langchain.com/oss/python/langgraph/interrupts]. |
| V6 Cryptography | no (optional) | Do not store secrets in graph state; if sensitive content must persist, enable encrypted serializers via `LANGGRAPH_AES_KEY` [CITED: https://docs.langchain.com/oss/python/langgraph/persistence]. |

### Known Threat Patterns for LangGraph-backed runs

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `thread_id` fixation / cross-project replay | Spoofing / Information Disclosure | Bind access to authenticated project ownership; never trust `thread_id` alone [CITED: https://docs.langchain.com/oss/python/langgraph/persistence]. |
| Resume payload tampering | Tampering | Validate `Command(resume=...)` inputs and gate resume behind explicit UI actions [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts]. |
| Duplicate artifacts after resume | Repudiation / Tampering | Make pre-interrupt side effects idempotent or move them after the interrupt [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts]. |
| Checkpoint state leakage | Information Disclosure | Keep secrets out of graph state; use encrypted serialization if sensitive data must persist [CITED: https://docs.langchain.com/oss/python/langgraph/persistence]. |
| Silent auto-resume | Elevation of Privilege / Tampering | Always show a recovery summary and require explicit creator action before continuing [VERIFIED: CONTEXT.md]. |

## Sources

### Primary (HIGH confidence)
- `backend/app/orchestration/state.py`, `backend/app/orchestration/runtime.py`, `backend/app/orchestration/graph.py` — existing LangGraph shell and `Run.thread_id` mapping [VERIFIED].
- `backend/app/models/run.py`, `backend/app/models/stage.py`, `backend/app/models/artifact.py` — canonical lineage tables [VERIFIED].
- `backend/app/agents/orchestrator.py`, `backend/app/api/v1/routes/generation.py`, `backend/app/ws/manager.py`, `frontend/app/hooks/useWebSocket.ts`, `frontend/app/pages/ProjectPage.tsx` — current manual orchestration and live-update contract [VERIFIED].
- `https://docs.langchain.com/oss/python/langgraph/persistence` — checkpointing, threads, super-steps, history, update_state, and encryption [CITED].
- `https://docs.langchain.com/oss/python/langgraph/interrupts` — interrupt semantics, Command(resume=...), idempotency rules, static debug interrupts [CITED].
- `https://docs.langchain.com/oss/python/langgraph/use-time-travel` — replay, fork, and subgraph checkpoint granularity [CITED].
- `https://docs.langchain.com/langsmith/configure-checkpointer.md` — Postgres as the default durable checkpointer backend [CITED].
- `python3 -m pip index versions langgraph`, `fastapi`, `langgraph-checkpoint-postgres`, `anthropic` — current package version verification [VERIFIED].

### Secondary (MEDIUM confidence)
- `https://docs.langchain.com/langsmith/human-in-the-loop-time-travel.md` — thread/checkpoint resume examples via SDK [CITED].
- `https://docs.langchain.com/langsmith/interrupt-concurrent.md` — confirms interrupt-based run interruption semantics; useful for concurrency thinking but not the primary Phase 2 pattern [CITED].

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — current package versions verified from PyPI and docs; repo state inspected [VERIFIED/CITED].
- Architecture: HIGH — docs and current code agree on thread/checkpoint/interrupt model [VERIFIED/CITED].
- Pitfalls: HIGH — interrupt and time-travel docs explicitly document the failure modes [CITED].

**Research date:** 2026-04-11  
**Valid until:** 2026-05-11

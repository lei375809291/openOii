# Phase 1: Foundation & Project Bootstrap - Research

**Researched:** 2026-04-11
**Domain:** FastAPI + LangGraph orchestration + creator config UX + relational schema
**Confidence:** HIGH

## Summary

The repo already has the Phase 1 user flows in place: project creation collects `title/story/style` and persists a `Project`, then navigates to `?autoStart=true` [VERIFIED: `frontend/app/pages/NewProjectPage.tsx`]; provider configuration already exists as a DB/env-backed settings surface split into text/image/video sections [VERIFIED: `backend/app/api/v1/routes/config.py`, `backend/app/services/config_service.py`, `frontend/app/components/settings/SettingsModal.tsx`]. Phase 1 should therefore **evolve** the current shell, not replace it [VERIFIED: `AGENTS.md`, `.planning/PROJECT.md`].

The orchestration layer is still the legacy manual agent runner: `GenerationOrchestrator` and route-level async task dispatch drive agent order, websocket updates, and run state [VERIFIED: `backend/app/agents/orchestrator.py`, `backend/app/api/v1/routes/generation.py`, `backend/app/api/v1/routes/shots.py`]. No LangGraph `StateGraph` home exists yet [VERIFIED: repo search]. Phase 1 should add a thin orchestration boundary and canonical domain models for `Project`, `Run`, `Stage`, and `Artifact`, while deferring durable execution, resume/replay, interrupts, and queued heavy workers to Phase 2+ [VERIFIED: `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `AGENTS.md`].

**Primary recommendation:** use the current FastAPI app as the control plane, introduce `backend/app/orchestration/` as the LangGraph home, keep nodes mostly pure, and make PostgreSQL + Alembic the canonical persistence path for project/run/lineage state [CITED: LangGraph docs, Alembic docs; VERIFIED: repo state].

## Project Constraints

- Keep evolution over rewrite: the repo already has meaningful FastAPI + React implementation, so Phase 1 should reuse it [VERIFIED: `AGENTS.md`, `README.md`].
- Solo-creator scope: v1 is for independent creators, not team collaboration [VERIFIED: `AGENTS.md`, `.planning/REQUIREMENTS.md`].
- v1 success = idea → final video closure, so Phase 1 must establish the bootstrap path cleanly [VERIFIED: `AGENTS.md`, `.planning/PROJECT.md`].
- Long-running media work exists, so the architecture must preserve resumability/progress even if Phase 1 only scaffolds it [VERIFIED: `AGENTS.md`, `.planning/ROADMAP.md`].
- `.planning/` is tracked in git and planning is research-heavy/interactive [VERIFIED: `AGENTS.md`, `.planning/config.json`].

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROJ-01 | Creator can create a project by entering a story idea, title, and style direction. | Current `NewProjectPage` already gathers `title/story/style`; backend `ProjectCreate` + `ProjectService.create` persist the record [VERIFIED: `frontend/app/pages/NewProjectPage.tsx`, `backend/app/schemas/project.py`, `backend/app/services/project_service.py`]. |
| PROJ-02 | Creator can configure text, image, and video providers before running generation. | Existing config API/service/UI already splits provider config into text/image/video groups and stores values in DB/env precedence order [VERIFIED: `backend/app/api/v1/routes/config.py`, `backend/app/services/config_service.py`, `frontend/app/components/settings/SettingsModal.tsx`, `frontend/app/utils/configGroups.ts`]. |
</phase_requirements>

## Standard Stack

### Core
| Library | Current repo pin | Verified latest | Purpose | Why standard |
|---------|------------------|-----------------|---------|--------------|
| FastAPI | `>=0.115.0` [VERIFIED: `backend/pyproject.toml`] | `0.128.0` [CITED: Context7 `/fastapi/fastapi`] | API + lifespan + dependency injection | Current code already uses it; v1.0+ LangGraph integration fits cleanly into FastAPI lifespan and route dependencies [CITED: FastAPI docs]. |
| LangGraph | none | `1.0.8` [CITED: Context7 `/langchain-ai/langgraph`] | Stateful orchestration/runtime | Required for the Phase 1 graph skeleton and Phase 2 durable workflow; StateGraph + reducers + checkpoint config are the right primitives [CITED: LangGraph docs]. |
| PostgreSQL | `16` target [VERIFIED: `AGENTS.md`] | — | Canonical persistent store | Use as the source of truth for project/run/stage/artifact lineage and future LangGraph checkpoints [VERIFIED: `AGENTS.md`, `backend/app/db/session.py`]. |
| SQLModel / SQLAlchemy 2.x | `sqlmodel>=0.0.31`, `sqlalchemy>=2.0.30` [VERIFIED: `backend/pyproject.toml`] | `sqlmodel` active maintenance [CITED: Context7 `/websites/sqlmodel_tiangolo`] | ORM + metadata | Keep Phase 1 on the existing ORM surface to evolve quickly; migrations should land via Alembic, not `create_all` [VERIFIED: repo; CITED: Alembic docs]. |
| Alembic | none | `1.14+` [CITED: Context7 `/sqlalchemy/alembic`] | Schema migrations | Required because current startup path still uses `SQLModel.metadata.create_all` [VERIFIED: `backend/app/db/session.py`]. |

### Supporting
| Library | Current repo pin | Verified latest | Purpose | When to use |
|---------|------------------|-----------------|---------|-------------|
| React | `^18.3.1` [VERIFIED: `frontend/package.json`] | `19.2.5` [VERIFIED: npm registry] | UI framework | Keep the existing UI shell for Phase 1 unless a specific screen needs React 19 actions; don't let frontend upgrades block bootstrap work. |
| TypeScript | `^5.7.2` [VERIFIED: `frontend/package.json`] | `6.0.2` [VERIFIED: npm registry] | Type safety | Keep current app typing; phase work is not blocked by a language migration. |
| Vite | `^6.0.0` [VERIFIED: `frontend/package.json`] | `8.0.8` [VERIFIED: npm registry] | Frontend build tool | Keep current build pipeline for Phase 1. |
| React Router DOM | `^7.1.0` [VERIFIED: `frontend/package.json`] | `7.14.0` [VERIFIED: npm registry] | Routing | Keep existing route structure for project/config screens. |
| TanStack Query | `^5.62.0` [VERIFIED: `frontend/package.json`] | `5.97.0` [VERIFIED: npm registry] | Server-state cache | Already fits project and settings data fetching; keep it. |
| Zustand | `^5.0.2` [VERIFIED: `frontend/package.json`] | `5.0.12` [VERIFIED: npm registry] | Client state | Keep existing editor/settings stores. |
| Tailwind CSS | `^3.4.17` [VERIFIED: `frontend/package.json`] | `4.2.2` [VERIFIED: npm registry] | Styling | Keep the current design system for Phase 1 unless a style migration is explicitly scheduled. |
| DaisyUI | `^4.12.14` [VERIFIED: `frontend/package.json`] | `5.5.19` [VERIFIED: npm registry] | UI primitives | Keep current components for Phase 1; upgrade later if the styling migration becomes part of scope. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| LangGraph | Claude Agent SDK orchestration | Current repo already uses agent SDK patterns, but that duplicates orchestration concerns and is the wrong home for durable workflow state [VERIFIED: `AGENTS.md`, `backend/app/agents/orchestrator.py`]. |
| SQLModel | SQLAlchemy Core/ORM directly | More flexible for rich lineage schemas, but Phase 1 should minimize churn and use the current ORM surface [VERIFIED: `AGENTS.md`, repo state]. |
| `create_all` bootstrap | Alembic migrations | `create_all` is fine for tests, but it cannot manage schema evolution safely in v1 [VERIFIED: `backend/app/db/session.py`; CITED: Alembic docs]. |

**Installation:**
```bash
# backend
cd backend && uv sync

# frontend
cd frontend && pnpm install
```

## Architecture Patterns

### Recommended Project Structure
```text
backend/app/
├── api/v1/routes/      # HTTP entrypoints for project/config/run control
├── domain/             # Project, Run, Stage, Artifact, lineage models
├── orchestration/      # LangGraph StateGraph, reducers, compile wiring
├── providers/          # LLM/image/video adapter boundary
├── services/           # CRUD and integration services
└── db/                 # engine/session/init/migrations glue
```

### Pattern 1: Control Plane + Thin Graph Shell
**What:** FastAPI owns CRUD/config/start-run endpoints; LangGraph owns stage ordering and state transitions [CITED: FastAPI docs; CITED: LangGraph docs].
**When to use:** Phase 1 bootstrap, when the goal is to introduce the graph boundary without full durable execution.
**Example:**
```python
# Source: https://context7.com/langchain-ai/langgraph/llms.txt
from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END

def add_to_list(current: list, new: int | None) -> list:
    return current + [new] if new is not None else current

class State(TypedDict):
    values: Annotated[list[int], add_to_list]
    total: int

builder = StateGraph(State)
builder.add_node("add_value", lambda state: {"values": len(state["values"]) + 1})
builder.add_edge(START, "add_value")
builder.add_edge("add_value", END)
```

### Pattern 2: Canonical Domain Models + UI Projection
**What:** `Project`, `Run`, `Stage`, and `Artifact` are the backend truth; the canvas/progress UI is a projection, not the source of truth [VERIFIED: `AGENTS.md`, `.planning/research/ARCHITECTURE.md`].
**When to use:** Any long-running workflow where refresh/replay must reconstruct state reliably.

### Pattern 3: Reducer-Driven State for Mergeable Fields
**What:** Use LangGraph reducers for append/merge semantics (for example, message logs or artifact event lists) instead of mutating shared state in place [CITED: LangGraph docs].
**When to use:** State fields that grow over time or need deterministic merges across nodes.

### Anti-Patterns to Avoid
- **Manual orchestration loops as the source of truth:** The current `GenerationOrchestrator` and route-level `asyncio.create_task` flow are useful now, but Phase 1 should not expand that pattern further [VERIFIED: `backend/app/agents/orchestrator.py`, `backend/app/api/v1/routes/generation.py`].
- **UI as canonical state:** The infinite canvas should mirror backend metadata, not own it [VERIFIED: `.planning/research/ARCHITECTURE.md`].
- **`create_all` as permanent schema strategy:** keep it for test bootstrap only; migrations need Alembic [VERIFIED: `backend/app/db/session.py`; CITED: Alembic docs].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Workflow state merging | Custom mutable dict merging | LangGraph reducers / `Annotated` channels [CITED: LangGraph docs] | Reducers make graph updates deterministic and explicit. |
| Graph checkpoint persistence | Ad hoc JSON files or per-route memory | LangGraph checkpointer + `thread_id` [CITED: LangGraph docs] | Phase 2 needs resumable threads; Phase 1 should scaffold the mapping now. |
| Schema evolution | Hand-edited tables / `create_all` forever | Alembic migrations [CITED: Alembic docs] | The schema is already moving beyond the current model set. |
| Settings precedence | Scattered env parsing | Pydantic settings + existing `ConfigService` overlay [VERIFIED: `backend/app/config.py`, `backend/app/services/config_service.py`] | The repo already has a dual env/db config model. |
| App startup bootstrapping | Route-level side effects | FastAPI lifespan + init function [CITED: FastAPI docs] | Startup/shutdown resources belong in the app lifespan. |

**Key insight:** Phase 1 is about drawing the control boundaries correctly. The hard problems are graph state, lineage, and schema evolution; those should be explicit platform pieces, not per-route hacks.

## Common Pitfalls

### Pitfall 1: Using `create_all` as the migration system
**What goes wrong:** schema drift and no reliable upgrade path [VERIFIED: `backend/app/db/session.py`].
**Why it happens:** it is the fastest bootstrap path, so teams keep it too long.
**How to avoid:** add Alembic now and wire `target_metadata` into `env.py` [CITED: Alembic docs].
**Warning signs:** startup code still creates tables directly; no revision history exists.

### Pitfall 2: Treating `AgentRun` as the whole workflow model
**What goes wrong:** run metadata becomes overloaded with stage lineage and artifact truth.
**Why it happens:** the current model already tracks progress/status/resource locks [VERIFIED: `backend/app/models/agent_run.py`].
**How to avoid:** add separate `Stage` and `Artifact` models with parent-child lineage, and keep `AgentRun` as execution metadata only.
**Warning signs:** more fields keep getting added to `AgentRun` for non-execution concerns.

### Pitfall 3: Letting config values live in too many places
**What goes wrong:** env, DB, and UI disagree about provider values.
**Why it happens:** the repo already merges `.env` values with DB overrides [VERIFIED: `backend/app/services/config_service.py`].
**How to avoid:** define a clear precedence rule and keep provider config canonical in one service.
**Warning signs:** different screens show different values for the same provider key.

### Pitfall 4: Building the full durable runtime in Phase 1
**What goes wrong:** scope explodes into checkpoints, interrupts, queue workers, and replay logic before the bootstrap loop works.
**Why it happens:** LangGraph makes durable execution easy to imagine.
**How to avoid:** only scaffold the graph home, state schema, reducer strategy, and ID mapping in Phase 1; move execution durability to Phase 2 [VERIFIED: `.planning/ROADMAP.md`].
**Warning signs:** Phase 1 tasks start mentioning resume/replay/interrupt semantics.

## Code Examples

Verified patterns from official sources:

### LangGraph StateGraph + reducer + thread_id
```python
# Source: https://context7.com/langchain-ai/langgraph/llms.txt
from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END

def add_to_list(current: list, new: int | None) -> list:
    return current + [new] if new is not None else current

class State(TypedDict):
    values: Annotated[list[int], add_to_list]
    total: int

builder = StateGraph(State)
builder.add_node("add_value", lambda state: {"values": len(state["values"]) + 1})
builder.add_edge(START, "add_value")
builder.add_edge("add_value", END)

graph = builder.compile()
config = {"configurable": {"thread_id": "workflow-1"}}
```

### FastAPI lifespan bootstrap
```python
# Source: https://github.com/fastapi/fastapi/blob/master/docs/en/docs/release-notes.md
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(lifespan=lifespan)
```

### Alembic `env.py` autogenerate wiring
```python
# Source: https://github.com/sqlalchemy/alembic/blob/main/docs/build/autogenerate.md
from myapp.mymodel import Base
target_metadata = Base.metadata
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual async agent plan + websocket progress | LangGraph `StateGraph` + explicit checkpoints | 2026 v1 scope | Better state clarity, replayability, and future resume support [VERIFIED: repo; CITED: LangGraph docs]. |
| `SQLModel.metadata.create_all` at startup | Alembic-managed schema versions | 2026 v1 bootstrap | Safe schema evolution and upgrade paths [VERIFIED: `backend/app/db/session.py`; CITED: Alembic docs]. |
| `AgentRun` as the main execution record | `Run` + `Stage` + `Artifact` lineage model | 2026 v1 bootstrap | Separates execution metadata from product truth. |
| Provider values spread across env/UI/DB | Existing `ConfigService` precedence model | already in repo | A workable base; Phase 1 should tighten boundaries rather than replace it [VERIFIED: `backend/app/services/config_service.py`, `frontend/app/components/settings/SettingsModal.tsx`]. |

**Deprecated/outdated:**
- Treating the old agent SDK runner as the orchestration home is now the wrong abstraction for v1 [VERIFIED: `AGENTS.md`, `backend/app/agents/orchestrator.py`].
- Relying on `create_all` instead of migrations is no longer sufficient once Phase 1 adds new canonical tables [VERIFIED: `backend/app/db/session.py`; CITED: Alembic docs].

## Assumptions Log

> If this table is empty: all claims in this research were verified or cited — no user confirmation needed.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | None | — | — |

## Resolved Questions

1. **Frontend stack for Phase 1 bootstrap screens**  
   - Decision: keep the current React 18 / Tailwind 3 / DaisyUI 4 stack for Phase 1.  
   - Resolution basis: the Phase 1 plans preserve the existing project/config surfaces and add regression coverage instead of coupling bootstrap work to a broader frontend upgrade [VERIFIED: `01-01-PLAN.md`, `frontend/package.json`].

2. **Minimum v1 columns for `Stage` and `Artifact`**  
   - Decision: Phase 1 defines the canonical lineage boundary only — `Run`, `Stage`, and `Artifact` must carry explicit project/run linkage plus version/provenance fields that later phases can extend.  
   - Resolution basis: the approved plan scopes Phase 1 to canonical lineage tables and defers downstream richness/migration of current `Shot`/`Message` semantics to later phases [VERIFIED: `01-01-PLAN.md`].

3. **Canonical ownership of `thread_id`**  
   - Decision: persist `thread_id` on `Run` and treat it as the LangGraph ownership boundary for Phase 1.  
   - Resolution basis: the revised Phase 1 plans explicitly store `Run.thread_id` and derive runtime invocation config from that persisted value [VERIFIED: `01-01-PLAN.md`, `01-02-PLAN.md`].

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| uv | backend dependency management | ✓ | 0.11.3 [VERIFIED: `uv --version`] | — |
| pnpm | frontend dependency management | ✓ | 10.18.3 [VERIFIED: `pnpm --version`] | — |
| Python | backend runtime/tests | ✓ | 3.14.3 [VERIFIED: `python3 --version`] | — |
| Node.js | frontend tooling | ✓ | v25.9.0 [VERIFIED: `node --version`] | — |
| Docker | local Postgres/Redis/Migration services | ✓ | 29.3.1 [VERIFIED: `docker --version`] | Use docker compose for local services |
| FFmpeg | media tooling / future phases | ✓ | n8.1 [VERIFIED: `ffmpeg -version`] | — |
| PostgreSQL service | app runtime + future migration checks | ✗ local process | no response [VERIFIED: `pg_isready`] | Start via docker compose |
| Redis service | app runtime + future queue/progress work | ✗ local process | connection refused [VERIFIED: `redis-cli ping`] | Start via docker compose |

**Missing dependencies with no fallback:**
- None. Docker is available, so missing local Postgres/Redis services are recoverable via compose.

**Missing dependencies with fallback:**
- PostgreSQL and Redis are not listening locally, but the repo can use docker-compose services for Phase 1 implementation and integration checks [VERIFIED: environment checks; VERIFIED: repo README/docker setup].

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Backend: pytest 8.x [VERIFIED: `backend/pyproject.toml`]; Frontend: Vitest 4.1.4 + Playwright 1.59.1 [VERIFIED: npm registry] |
| Config file | `backend/pyproject.toml`, `backend/tests/conftest.py`, `frontend/package.json` [VERIFIED: repo read] |
| Quick run command | `cd backend && uv run pytest tests/test_api/test_projects.py tests/test_api/test_config.py -x` |
| Full suite command | `cd backend && uv run pytest && cd ../frontend && pnpm test && pnpm e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROJ-01 | Create project from title/story/style | unit/integration | `cd backend && uv run pytest tests/test_api/test_projects.py -x` | ✅ |
| PROJ-02 | Configure text/image/video providers | unit/integration + UI | `cd backend && uv run pytest tests/test_api/test_config.py -x && cd ../frontend && pnpm vitest run app/components/settings/SettingsModal.test.tsx app/components/settings/ConfigInput.test.tsx` | ✅ |
| PROJ-01/02 | Project form UI stays aligned with backend payloads | UI smoke | `cd frontend && pnpm vitest run app/pages/NewProjectPage.*` (or an equivalent page test once added) | ❌ |
| LangGraph scaffold | Graph module compiles with thread-aware state | unit | `cd backend && uv run pytest tests/test_orchestration/test_phase1_graph.py -x` | ❌ |
| Alembic setup | Migrations autogenerate from metadata | integration | `cd backend && uv run alembic revision --autogenerate -m "phase1 smoke"` | ❌ |

### Sampling Rate
- **Per task commit:** targeted backend API or frontend component test matching the touched surface.
- **Per wave merge:** backend pytest slice + frontend Vitest slice.
- **Phase gate:** full backend pytest and full frontend test/e2e suite before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `backend/app/orchestration/` — no LangGraph home exists yet; Phase 1 needs a compileable skeleton.
- [ ] `backend/tests/test_orchestration/test_phase1_graph.py` — missing compile/state-shape coverage for the new graph boundary.
- [ ] `backend/alembic/` (or equivalent) — no migration environment exists yet.
- [ ] `backend/tests/test_migrations.py` — missing migration smoke test / metadata parity check.
- [ ] Project/run/stage/artifact lineage tests — no coverage for the new canonical model shape yet.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing admin token guard on config writes (`X-Admin-Token`) [VERIFIED: `backend/app/api/deps.py`] |
| V3 Session Management | no/low | No user session system is in scope for Phase 1. |
| V4 Access Control | yes | Route-level guard for config updates and explicit admin dependency injection [VERIFIED: `backend/app/api/deps.py`] |
| V5 Input Validation | yes | Pydantic models for project/config/request payloads [VERIFIED: `backend/app/schemas/project.py`, `backend/app/schemas/config.py`] |
| V6 Cryptography | no | Do not hand-roll secret checks; use `secrets.compare_digest` where equality is required [VERIFIED: `backend/app/api/deps.py`] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized provider/config mutation | Elevation of privilege | Keep admin-token protection on config routes and avoid exposing raw config writes to the public UI [VERIFIED: `backend/app/api/deps.py`, `frontend/app/components/settings/SettingsModal.tsx`] |
| Malicious story/style/provider input | Tampering / injection | Validate payloads with Pydantic and treat all LLM inputs/outputs as untrusted text [VERIFIED: repo models + LangGraph docs]. |
| Secret leakage in config UI | Information disclosure | Mask sensitive values and keep `is_sensitive`/`is_masked` semantics in the config service [VERIFIED: `backend/app/services/config_service.py`, `backend/app/schemas/config.py`] |
| Schema drift during bootstrap | Tampering / reliability | Introduce Alembic rather than relying on `create_all` [CITED: Alembic docs; VERIFIED: `backend/app/db/session.py`] |
| Overloading `AgentRun` with lineage | Tampering / repudiation | Split execution metadata from canonical artifact lineage models. |

## Sources

### Primary (HIGH confidence)
- `AGENTS.md`, `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — project scope, phase boundaries, and constraints [VERIFIED: repo read].
- `backend/app/*`, `frontend/app/*`, `backend/tests/*`, `frontend/package.json` — current implementation shape and test coverage [VERIFIED: repo read].
- Context7 LangGraph docs (`/langchain-ai/langgraph`) — StateGraph, reducers, and `thread_id` checkpoint config [CITED: Context7 docs].
- Context7 FastAPI docs (`/fastapi/fastapi`) — lifespan and dependency patterns [CITED: Context7 docs].
- Context7 Alembic docs (`/sqlalchemy/alembic`) — `target_metadata` and autogenerate [CITED: Context7 docs].

### Secondary (MEDIUM confidence)
- npm registry version queries for React, TypeScript, Vite, React Router DOM, TanStack Query, Zustand, Tailwind CSS, DaisyUI, tldraw, Vitest, Playwright, MSW, and Testing Library [VERIFIED: npm registry].

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — current repo files plus current docs/version queries were checked.
- Architecture: HIGH — current code paths and official docs agree on the control-plane + LangGraph + migration shape.
- Pitfalls: MEDIUM — these are synthesis/recommendations grounded in verified repo state and docs, not direct product constraints.

**Research date:** 2026-04-11
**Valid until:** 2026-05-11

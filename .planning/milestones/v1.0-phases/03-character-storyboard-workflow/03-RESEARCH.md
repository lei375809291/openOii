# Phase 3: Character & Storyboard Workflow - Research

**Researched:** 2026-04-11
**Domain:** LangGraph approval workflow + character/storyboard data modeling + tldraw review UI
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Video generation starts only after all storyboard shots required for the run are approved.
- Phase 3 does not allow partially approved shots to start downstream video generation early.
- Every storyboard shot must explicitly bind the character set used for that shot.
- Storyboard and video generation consume the shot-bound character set, not the entire project character list by default.
- Each character reference is defined by `name`, `description`, and one optional primary reference image.
- A creator may replace the reference image before approval.
- Once a character is approved, that approved reference becomes the frozen downstream source of truth for later stages in the same run.
- Character approval is per-character, not whole-set only.
- The character stage is allowed to continue only after all required characters are approved.
- This preserves creator control without breaking Phase 2's stage-level recovery contract.
- Approving a storyboard shot means approving at least: cast, duration, camera/framing, and a minimal motion note.
- Phase 3 does not treat approval as “the still image looks okay” only; approval must lock enough structured shot intent for downstream video generation.
- Backend stores complete version and lineage metadata for approved character references and storyboard shots.
- Frontend Phase 3 shows only the current `approved` / `superseded` state rather than a full version browser or version switching workflow.

### the agent's Discretion
- The exact schema split between character reference metadata, storyboard shot intent metadata, and artifact lineage records is at the agent's discretion as long as it preserves the approved/frozen contract and keeps Phase 3 within stage-level review semantics.
- The exact review UI composition is at the agent's discretion as long as creators can review per character and per shot without introducing partial downstream execution.

### Deferred Ideas (OUT OF SCOPE)
- Partial video generation from a subset of approved storyboard shots.
- Multi-image reference packs / full reference sheets as the default Phase 3 input model.
- A full artifact version browser or version switching UI in Phase 3.
- Selective regeneration as a first-class orchestration mode inside Phase 3.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHAR-01 | A creator can upload or define character reference inputs that are reused by downstream generation stages. | Existing `Character` model + approval/frozen-state columns + per-character review UI [VERIFIED: repo] |
| CHAR-02 | The system can preserve character identity consistently across storyboard and video outputs for the same project. | LangGraph durable execution + shot-bound cast binding + prompt context scoping [CITED: Context7 LangGraph; VERIFIED: repo] |
| SHOT-01 | A creator can review storyboard outputs per shot before or during downstream video generation. | Shot-level approval state, explicit gate before `video_generator`, and canvas/card review controls [VERIFIED: repo; CITED: Context7 tldraw] |
</phase_requirements>

## Summary

Phase 3 is mostly a contract-and-state problem, not a new generation algorithm. The repo already has durable Phase 2 execution, `interrupt()` gates, recovery summaries, and canvas widgets for characters and shots; Phase 3 needs to replace the current binary confirm flow with structured per-character and per-shot approval state, then make storyboard/video generation consume the approved shot cast instead of the whole project cast [VERIFIED: repo; CITED: Context7 LangGraph].

The biggest implementation risk is accidental scope creep into a full version browser or a separate approval engine. The better fit is: keep Phase 2's LangGraph + Postgres checkpointer, add approval/version metadata to existing character/shot records or a very small lineage layer, and expose only current `approved` / `superseded` state in the UI [VERIFIED: repo; CITED: Context7 LangGraph; CITED: Context7 tldraw].

**Primary recommendation:** model approval as persisted backend state with explicit shot-character bindings, then let the frontend render that state as reviewable cards/shapes instead of inventing a new workflow system.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| LangGraph | 1.1.6 [VERIFIED: PyPI] | Durable orchestration, conditional routing, human-in-the-loop gates | The repo already uses `StateGraph`, `interrupt()`, `Command`, and checkpoint history; this is the correct layer for character/shot approvals [CITED: Context7 /langchain-ai/langgraph; VERIFIED: repo]. |
| langgraph-checkpoint-postgres | 3.0.5 [VERIFIED: PyPI] | Persistent checkpoint storage | Phase 2 already persists run state to PostgreSQL; Phase 3 approval gates should stay thread-based and resumable [VERIFIED: repo; CITED: Context7 LangGraph]. |
| FastAPI | 0.135.3 [VERIFIED: PyPI] | API + WebSocket shell | Current backend routes already expose characters, shots, generation, and recovery control; Phase 3 extends those routes instead of rewriting them [VERIFIED: repo]. |
| SQLModel | 0.0.38 [VERIFIED: PyPI] | Existing model layer | Current `Character`, `Shot`, `Stage`, `Artifact`, and `AgentRun` models already exist; Phase 3 should evolve them in place [VERIFIED: repo]. |
| tldraw | 4.5.8 [VERIFIED: npm] | Infinite canvas + custom shapes | The frontend already uses custom `ShapeUtil`s for character/storyboard sections; Phase 3 can enrich those shapes with approval state [CITED: Context7 /tldraw/tldraw; VERIFIED: repo]. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SQLAlchemy | 2.0.49 [VERIFIED: PyPI] | Association tables, migrations, query joins | Use for shot-character links and lineage queries that need referential integrity [VERIFIED: repo]. |
| Alembic | 1.18.4 [VERIFIED: PyPI] | Schema migrations | Use for approval/version columns and any new association tables [VERIFIED: repo]. |
| asyncpg | 0.31.0 [VERIFIED: PyPI] | Async Postgres driver | Use for runtime DB access and checkpoint persistence [VERIFIED: repo]. |
| @tanstack/react-query | 5.97.0 [VERIFIED: npm] | Server-state cache | Use for loading and mutating review state without hand-rolled cache invalidation [VERIFIED: repo]. |
| Zustand | 5.0.2 [VERIFIED: npm] | Local editor/canvas state | Use for selected item, review modal, and approval-state UI plumbing [VERIFIED: repo]. |
| Vitest | 4.1.4 [VERIFIED: npm] | Frontend unit tests | Use for canvas/review component tests and state-shape regressions [VERIFIED: repo]. |
| pytest | 8.x [VERIFIED: repo] | Backend unit/integration tests | Use for API, orchestration, and migration coverage. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| LangGraph approvals | Custom confirm flags in route handlers | Faster short-term, but loses durable thread history and resume semantics [CITED: Context7 LangGraph]. |
| `shot_character_link` join table | JSON array on `Shot` | Simpler write path, weaker referential integrity and queryability [ASSUMED]. |
| Separate character/shot version browser | Current-state badges only | Less history visibility, but matches the explicit Phase 3 scope [VERIFIED: CONTEXT.md]. |
| Custom canvas renderer | tldraw custom shapes | More control, but you would rebuild persistence, hit-testing, and shape composition [CITED: Context7 tldraw]. |

**Installation:**
```bash
uv add fastapi langgraph langgraph-checkpoint-postgres sqlalchemy alembic asyncpg sqlmodel
pnpm add tldraw @tanstack/react-query zustand
```

**Version verification:**
```bash
python -m pip index versions fastapi
python -m pip index versions langgraph
python -m pip index versions langgraph-checkpoint-postgres
python -m pip index versions sqlmodel
python -m pip index versions sqlalchemy
python -m pip index versions asyncpg
npm view tldraw version
npm view @tanstack/react-query version
npm view zustand version
npm view vitest version
```

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── models/            # Character/Shot approval fields, association tables, lineage metadata
├── schemas/           # API contracts for review payloads and state snapshots
├── api/v1/routes/     # character/shot review + approve/reject endpoints
├── orchestration/     # LangGraph nodes, routing, persistence, recovery
└── services/          # lineage helpers, cast binding helpers, media-safe cleanup

frontend/app/
├── components/canvas/ # Character/storyboard cards and approval badges
├── components/review/ # review panels, approval drawers, shot detail sheets
├── hooks/             # WS event handling + review mutations
├── stores/            # selected item / approval state / optimistic UI
└── types/             # stage, review, and WS event unions
```

### Pattern 1: Frozen approval snapshot
**What:** When a character or shot is approved, write the approved snapshot and mark earlier revisions `superseded` rather than mutating the approved record in place [ASSUMED].  
**When to use:** Any data that downstream storyboard or video generation must treat as immutable for the rest of the run [VERIFIED: CONTEXT.md].  
**Example:**
```python
# Source: Context7 /langchain-ai/langgraph (interrupt + Command resume pattern)
decision = interrupt({"question": "Approve this item?"})
if decision == "approve":
    return {"status": "approved", "approved_at": utcnow()}
return {"status": "draft"}
```

### Pattern 2: Shot-bound cast binding
**What:** Each shot stores the exact character set used for that shot, and storyboard/video agents read only that bound set [VERIFIED: CONTEXT.md; VERIFIED: repo].  
**When to use:** Storyboard and video prompt building, especially where identity consistency matters [VERIFIED: repo].  
**Example:**
```python
# Source: Context7 /langchain-ai/langgraph (conditional edges pattern)
builder.add_conditional_edges(
    "storyboard_approval",
    route_after_storyboard_approval,
    {"review": "review", "clip": "clip"},
)
```

### Pattern 3: Canvas-backed review workspace
**What:** Keep the canvas as the main visual shell, but render approval state on the existing character/storyboard shapes instead of introducing a separate editor [VERIFIED: repo; CITED: Context7 /tldraw/tldraw].  
**When to use:** Creator-facing review of characters and per-shot storyboard outputs [VERIFIED: CONTEXT.md].  
**Example:**
```tsx
// Source: Context7 /tldraw/tldraw
class StickyNoteShapeUtil extends ShapeUtil<any> {
  static override type = 'sticky-note' as const
  getDefaultProps() { return { text: '', color: 'yellow' } }
  component(shape: any) { return <HTMLContainer>{shape.props.text}</HTMLContainer> }
}
```

### Anti-Patterns to Avoid
- **Project-wide character prompts:** `StoryboardArtistAgent` and `VideoGeneratorAgent` currently call `build_character_context(characters)` on the whole project cast [VERIFIED: repo]. Phase 3 must scope this to the shot-bound cast.
- **Binary confirm as approval:** current Phase 2 gates only ask whether to continue [VERIFIED: repo]. Phase 3 needs structured approval payloads with cast/duration/framing/motion note [VERIFIED: CONTEXT.md].
- **Frontend-only approval state:** if approval only lives in the UI, recovery and resume will diverge from the backend graph state [CITED: Context7 LangGraph].
- **Full version browser creep:** the scope explicitly excludes browsing/switching historical versions in Phase 3 [VERIFIED: CONTEXT.md].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Long-running approvals + resume | Custom approval queue | LangGraph `interrupt()` + Postgres checkpointing | Durable run history and same-thread resume already exist [CITED: Context7 LangGraph]. |
| Per-shot cast membership | Ad hoc prompt concatenation | Association table / explicit shot cast field [ASSUMED] | Preserves queryability and prevents identity drift. |
| Canvas shape rendering | Hand-written editor canvas | tldraw `ShapeUtil` + custom props | The SDK already solves persistence, geometry, and custom shapes [CITED: Context7 /tldraw/tldraw]. |
| Cache invalidation for review state | Manual refetch plumbing | TanStack Query | The app already uses React Query for server state [VERIFIED: repo]. |

**Key insight:** the hard part is not generating more content; it's making the already-generated content freeze cleanly so the next stage can trust it.

## Common Pitfalls

### Pitfall 1: Mutating an approved asset in place
**What goes wrong:** downstream storyboard/video steps silently read a changed reference and lose reproducibility [ASSUMED].  
**Why it happens:** the current models have no approval/version semantics [VERIFIED: repo].  
**How to avoid:** write a new approved revision and mark the prior revision `superseded` [ASSUMED].  
**Warning signs:** code that overwrites `Character.image_url` / `Shot.prompt` without persisting lineage [VERIFIED: repo].

### Pitfall 2: Letting video start before all shots are approved
**What goes wrong:** Phase 3 violates the explicit storyboard-to-video gate [VERIFIED: CONTEXT.md].  
**Why it happens:** generic approval booleans are easier to wire than a real per-shot gate [ASSUMED].  
**How to avoid:** block the `clip` node until every required shot has `approved=true` [ASSUMED].  
**Warning signs:** any branch from storyboard directly into `video_generator` before review completion [VERIFIED: repo].

### Pitfall 3: Using the whole project cast for every shot
**What goes wrong:** character identity drifts and the downstream prompt no longer matches the approved shot cast [VERIFIED: repo; VERIFIED: CONTEXT.md].  
**Why it happens:** `build_character_context()` currently accepts any sequence and the agents pass the full project character list [VERIFIED: repo].  
**How to avoid:** compute a shot-specific cast set before prompt building [ASSUMED].  
**Warning signs:** storyboard/video prompts still mention characters not bound to the current shot [VERIFIED: repo].

### Pitfall 4: Treating storyboard approval as image-only
**What goes wrong:** the next stage lacks duration/framing/motion constraints and needs another human round-trip [VERIFIED: CONTEXT.md].  
**Why it happens:** UI teams often review the thumbnail and forget the structured intent [ASSUMED].  
**How to avoid:** require cast, duration, camera/framing, and motion note in the approval record [VERIFIED: CONTEXT.md].  
**Warning signs:** approval payload has only `image_url` or free-form comments [VERIFIED: repo].

### Pitfall 5: Frontend stage labels drift away from backend state
**What goes wrong:** the WS/store/UI can no longer represent approval stages accurately [VERIFIED: repo].  
**Why it happens:** frontend `WorkflowStage` is currently `ideate | visualise?`-style labels, while the backend LangGraph uses `ideate/script/character/storyboard/clip/merge/review` plus approval sub-stages [VERIFIED: repo].  
**How to avoid:** align the frontend enum/mapping layer with backend stages before adding Phase 3 badges and review controls [ASSUMED].  
**Warning signs:** `useWebSocket` or `StageView` falls back to generic states for new approval nodes [VERIFIED: repo].

## Code Examples

Verified patterns from official sources:

### Human-in-the-loop approval gate (LangGraph)
```python
# Source: Context7 /langchain-ai/langgraph
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import interrupt, Command

def human_review(state):
    decision = interrupt({
        "question": "Do you approve this proposal?",
        "options": ["approve", "reject"],
    })
    return {"approved": decision == "approve"}
```

### Conditional routing after approval (LangGraph)
```python
# Source: Context7 /langchain-ai/langgraph
builder.add_conditional_edges(
    "classify",
    route_by_classification,
    {"urgent": "urgent", "question": "question", "general": "general"},
)
```

### Custom canvas shape with persisted props (tldraw)
```tsx
// Source: Context7 /tldraw/tldraw
class StickyNoteShapeUtil extends ShapeUtil<any> {
  static override type = 'sticky-note' as const
  getDefaultProps() { return { text: '', color: 'yellow' } }
  getGeometry(shape: any) { return new Rectangle2d({ width: 200, height: 200, isFilled: true }) }
  component(shape: any) { return <HTMLContainer>{shape.props.text}</HTMLContainer> }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Binary confirm gate | Structured per-character / per-shot approval state [ASSUMED] | Phase 3 | Downstream stages can trust frozen inputs. |
| Whole-project cast prompts | Shot-bound cast binding [VERIFIED: CONTEXT.md] | Phase 3 | Better identity consistency across storyboard/video. |
| Canvas as display-only | tldraw shapes with custom props + events [VERIFIED: repo; CITED: Context7 /tldraw/tldraw] | Current repo | Review controls live in the same workspace. |
| Fresh reruns after interruption | Same-thread resume with Postgres checkpoints [VERIFIED: repo; CITED: Context7 LangGraph] | Phase 2 | Phase 3 can add approval pauses without losing durability. |

**Deprecated/outdated:**
- "Continue if the image looks okay" is too weak for Phase 3; the approval record must lock structured shot intent [VERIFIED: CONTEXT.md].
- "Use all project characters everywhere" is too weak for Phase 3; the shot must own its cast [VERIFIED: CONTEXT.md].

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this section to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Use a `shot_character_link` association table rather than a JSON cast field. | Standard Stack / Alternatives / Don't Hand-Roll | Queryability and referential integrity could be worse than planned. |
| A2 | Keep approved/superseded lineage in existing tables + a small set of new columns, rather than a standalone version browser schema. | Summary / State of the Art | Too little metadata or too much migration work. |

## Resolved Questions

All research questions below are resolved by the locked phase decisions and the phase recommendations already captured above:

1. **Approval lineage location** — Use current-row approval state plus small lineage metadata (`version` / `superseded_by`) on the existing character and shot records. Do not introduce separate full version tables in Phase 3, because the locked scope explicitly excludes a version browser and the phase only needs current approved/superseded visibility.

2. **Shot cast storage** — Use a shot-character join table or equivalent explicit binding relation, not a JSON cast blob, because the phase needs precise per-shot cast membership, queryability, and downstream prompt scoping.

3. **WebSocket event surface** — Reuse `character_updated` / `shot_updated` and enrich their payloads. Do not add new approval-only event names in Phase 3, because the current event family already exists and the UI only needs the current approved/superseded state.

4. **Frontend stage mapping** — Add a thin mapping layer from backend approval state/stages to frontend labels where needed. Do not rename the whole frontend stage union in Phase 3 unless a later phase requires it.

These choices keep the phase aligned with the locked decisions: server-owned approval state, shot-bound cast scoping, same-thread resumability, and no version browser.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Python | Backend tests / API work | ✓ | 3.14.3 [VERIFIED: bash] | — |
| uv | Backend dependency management | ✓ | 0.11.3 [VERIFIED: bash] | — |
| Node.js | Frontend build/tests | ✓ | v25.9.0 [VERIFIED: bash] | — |
| pnpm | Frontend dependency management | ✓ | 10.18.3 [VERIFIED: bash] | — |
| ffmpeg | Media pipeline verification | ✓ | n8.1 [VERIFIED: bash] | — |
| Docker | Local service startup | ✓ | 29.3.1 [VERIFIED: bash] | — |
| PostgreSQL | LangGraph checkpointer / app runtime | ✗ | — [VERIFIED: bash] | Use Docker Compose or a test DB for integration runs |
| Redis | Existing app/runtime cache + queues | ✗ | — [VERIFIED: bash] | Use Docker Compose or skip Redis-backed integration checks |

**Missing dependencies with no fallback:**
- None. PostgreSQL and Redis are missing locally, but Docker is available so they have a viable fallback [VERIFIED: bash].

**Missing dependencies with fallback:**
- PostgreSQL and Redis [VERIFIED: bash].

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | pytest 8.x + pytest-asyncio [VERIFIED: repo] |
| Backend config | `backend/pyproject.toml` `tool.pytest.ini_options` [VERIFIED: repo] |
| Backend quick run | `uv run pytest backend/tests/test_api/test_characters.py backend/tests/test_api/test_shots.py backend/tests/test_orchestration/test_phase2_graph.py -q` |
| Backend full run | `uv run pytest backend/tests -q` |
| Frontend framework | Vitest 4.1.4 + Playwright 1.57.0 [VERIFIED: repo; VERIFIED: npm] |
| Frontend quick run | `pnpm test -- --run` |
| Frontend full run | `pnpm test -- --run && pnpm e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAR-01 | Create/update/replace character references and keep the approved reference frozen for downstream stages. | backend unit + API | `uv run pytest backend/tests/test_api/test_characters.py -q` | ✅ existing file, but no approval coverage yet [VERIFIED: repo] |
| CHAR-02 | Approved character references must be the only inputs to storyboard/video prompt construction. | backend integration | `uv run pytest backend/tests/test_orchestration/test_phase3_graph.py -q` | ❌ new file needed [ASSUMED] |
| SHOT-01 | Approve storyboard shots per shot and block video generation until all required shots are approved. | backend API + orchestration | `uv run pytest backend/tests/test_api/test_shots.py -q` | ✅ existing file, but no approval/gate coverage yet [VERIFIED: repo] |
| SHOT-01 | Review per-shot storyboard state in the canvas / project page UI. | frontend unit | `pnpm test -- --run` | ❌ new component tests needed [ASSUMED] |

### Sampling Rate
- **Per task commit:** run the smallest backend or frontend test slice touching the edited file(s) [ASSUMED].
- **Per wave merge:** run backend and frontend suites for the touched area, plus the typecheck/build step [ASSUMED].
- **Phase gate:** full backend + frontend suites green before `/gsd-verify-work` [VERIFIED: config].

### Wave 0 Gaps
- [ ] `backend/tests/test_orchestration/test_phase3_graph.py` — covers CHAR-02 and SHOT-01 approval gating [ASSUMED].
- [ ] `backend/tests/test_api/test_character_storyboard_review.py` — covers character/shot approval payloads and updated read models [ASSUMED].
- [ ] `frontend/app/components/canvas/shapes/CharacterSectionShape.test.tsx` — covers approval badge + state rendering [ASSUMED].
- [ ] `frontend/app/components/canvas/shapes/StoryboardSectionShape.test.tsx` — covers per-shot approval controls and blocking UI [ASSUMED].
- [ ] `frontend/app/pages/ProjectPage.test.tsx` or equivalent review-shell test — covers WS-driven state transitions [ASSUMED].

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no new auth mechanism | reuse existing route guards / creator session checks [ASSUMED] |
| V3 Session Management | no | unchanged Phase 3 surface [VERIFIED: repo] |
| V4 Access Control | yes | project-scoped route checks before mutating character/shot approval state [ASSUMED] |
| V5 Input Validation | yes | Pydantic schemas for cast IDs, durations, framing, motion notes, and URLs [VERIFIED: repo] |
| V6 Cryptography | no | no cryptographic primitive is introduced [VERIFIED: CONTEXT.md] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on `PATCH /characters/{id}` and `PATCH /shots/{id}` | Spoofing / Elevation | Require project-scoped ownership checks before approval mutations [VERIFIED: repo; ASSUMED]. |
| Stale approval overwrite | Tampering | Optimistic concurrency or version check on approval state [ASSUMED]. |
| Prompt injection through descriptions / motion notes | Tampering | Strict schema validation and prompt-safe serialization [ASSUMED]. |
| Unsafe media URI deletion or replacement | Tampering | Treat URLs as opaque, sanitize local path joins, never trust client-provided paths [ASSUMED]. |

## Sources

### Primary (HIGH confidence)
- Context7 `/langchain-ai/langgraph` — interrupt/resume, conditional routing, checkpointer patterns [CITED: Context7].
- Context7 `/tldraw/tldraw` — custom shapes, persistence, multiplayer sync, ShapeUtil patterns [CITED: Context7].
- PyPI registry queries — `fastapi`, `langgraph`, `langgraph-checkpoint-postgres`, `sqlmodel`, `sqlalchemy`, `asyncpg`, `pydantic` [VERIFIED: bash].
- npm registry queries — `tldraw`, `@tanstack/react-query`, `zustand`, `vitest`, `react`, `daisyui` [VERIFIED: bash].
- Repo inspection — `backend/app/models/project.py`, `backend/app/agents/storyboard_artist.py`, `backend/app/agents/video_generator.py`, `backend/app/orchestration/*.py`, `frontend/app/*` [VERIFIED: repo].

### Secondary (MEDIUM confidence)
- Official / upstream docs surfaced through Context7 examples: LangGraph `llms.txt`, checkpoint README, and tldraw docs paths [CITED: Context7].

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - current registry versions were verified and the key library docs were checked [VERIFIED: bash; CITED: Context7].
- Architecture: MEDIUM - the contract is clear, but the exact schema split and event surface are still discretionary [VERIFIED: CONTEXT.md; ASSUMED].
- Pitfalls: HIGH - most pitfalls are directly visible in the current code or explicitly constrained by CONTEXT.md [VERIFIED: repo; VERIFIED: CONTEXT.md].

**Research date:** 2026-04-11
**Valid until:** 2026-05-11

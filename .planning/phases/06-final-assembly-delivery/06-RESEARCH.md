# Phase 6: Final Assembly & Delivery - Research

**Researched:** 2026-04-11  
**Domain:** final media delivery, workspace projection, FastAPI file/static responses, LangGraph persistence/resume  
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Final merge starts automatically once all required and current clips are present and successful.
- Phase 6 does not require the creator to click a separate “assemble final video” action to begin merge.
- A project is ready for final assembly only when every current shot in scope has a corresponding current successful clip.
- Any required clip in `failed`, `generating`, or `missing` state blocks delivery.
- Blocking clips must be surfaced clearly to the creator.
- When a current clip changes and the final output becomes outdated, the prior final video remains visible but is explicitly marked `stale` / `outdated` until a new merge succeeds.
- Phase 6 does not silently remove the previous final output the moment a downstream clip changes.
- The primary creator-facing retry surface for merge failure is the existing final-output card.
- That card may expose a dedicated “retry merge” action, but the underlying execution boundary still reuses the same run/thread recovery semantics rather than inventing a second delivery workflow.
- The final-output card inside the existing section-first workspace is the primary delivery surface.
- Preview, download, blocking explanation, stale status, and retry merge all live there.
- Phase 6 does not introduce a separate delivery page or standalone completion panel.
- The final-output card must show the minimum provenance needed for user trust: source clip scope (for example `assembled from current clips 1–8`), current version/update time, and stale/current distinction.
- Phase 6 does not add a version browser or deep lineage exploration UI.

### the agent's Discretion
- The exact backend query strategy for “required current clips” is at the agent's discretion as long as it respects the locked current/superseded semantics from Phase 5.
- The exact stale/download/retry badge copy is at the agent's discretion as long as it remains creator-facing, explicit, and consistent with the existing workspace language.

### Deferred Ideas (OUT OF SCOPE)
- Dedicated delivery page or standalone publish screen.
- Version browser for historical finals.
- Background music, transitions, or broader post-production controls.
- Rich export bundles beyond the core merged video artifact.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PIPE-03 | A creator can receive a final merged video artifact when all required clips complete successfully. | Merge trigger/eligibility must be derived from current shot state; `project.video_url` already stores the canonical final asset; LangGraph persistence/resume is needed for merge recovery. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md] [VERIFIED: backend/app/models/project.py] [CITED: https://docs.langchain.com/oss/python/langgraph/persistence] |
| DELIV-01 | A creator can preview the final merged video inside the product. | The existing final-output card already renders an inline `<video>` when a final URL exists; FastAPI static/file response patterns define how the asset can be served. [VERIFIED: frontend/app/components/canvas/shapes/VideoSectionShape.tsx] [CITED: https://fastapi.tiangolo.com/tutorial/static-files/] [CITED: https://fastapi.tiangolo.com/advanced/custom-response/#fileresponse] |
| DELIV-02 | A creator can download the final merged video once generation is complete. | The current UI already implements a blob-download fallback pattern; FastAPI `FileResponse` is the standard server-side delivery primitive when a download endpoint is needed. [VERIFIED: frontend/app/components/canvas/shapes/VideoSectionShape.tsx] [CITED: https://fastapi.tiangolo.com/advanced/custom-response/#fileresponse] |
</phase_requirements>

## Summary

Phase 6 should extend the existing final-output card, not introduce a new delivery surface, because the locked context keeps delivery inside the current workspace and the code already projects a canonical final URL into that slot. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md] [VERIFIED: frontend/app/utils/workspaceStatus.ts] [VERIFIED: frontend/app/components/canvas/InfiniteCanvas.tsx]

The main implementation risk is not rendering the final video; it is defining the current/stale/blocking contract correctly so the creator never mistakes an outdated final for the current one. The current backend already clears `project.video_url` when upstream reruns invalidate the output, and the current frontend already has a `superseded` workspace state that can be reused for stale delivery semantics. [VERIFIED: backend/app/services/creative_control.py] [VERIFIED: frontend/app/utils/workspaceStatus.ts] [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md]

The safest plan is: auto-start merge once all required current clips are ready, surface blockers server-side and in the card, keep the previous final visible but labeled stale, and keep retry wired to the same run/thread recovery semantics rather than inventing a second workflow. LangGraph persistence matters because merge/retry must survive interruption and resume from a stable thread. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md] [CITED: https://docs.langchain.com/oss/python/langgraph/persistence] [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts]

**Primary recommendation:** keep one canonical final asset (`project.video_url`), one delivery surface (the existing final-output card), and one recovery model (the same thread-aware run semantics). [VERIFIED: backend/app/models/project.py] [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md]

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | >=0.115.0 | API + static/file delivery | Already declared in the backend and used for static mounts / response classes. [VERIFIED: backend/pyproject.toml] [CITED: https://fastapi.tiangolo.com/tutorial/static-files/] |
| SQLModel | >=0.0.31 | ORM models | Existing project model layer already uses it. [VERIFIED: backend/pyproject.toml] [VERIFIED: backend/app/models/project.py] |
| SQLAlchemy | >=2.0.30 | Async DB operations | Used by the current test/session stack and data access code. [VERIFIED: backend/pyproject.toml] [VERIFIED: backend/tests/conftest.py] |
| PostgreSQL | 16+ | Persistent project/graph data | Existing backend target DB and LangGraph persistence fit this store. [VERIFIED: backend/pyproject.toml] [CITED: https://docs.langchain.com/oss/python/langgraph/persistence] |
| Redis | 7+ | Signals / queue backend | Existing project already uses Redis for cross-process coordination. [VERIFIED: backend/pyproject.toml] [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md] |
| LangGraph | >=1.0.8 | Durable workflow orchestration | Required for merge/retry resumability and thread-based recovery. [VERIFIED: backend/pyproject.toml] [CITED: https://docs.langchain.com/oss/python/langgraph/persistence] |
| langgraph-checkpoint-postgres | >=3.0.5 | Durable checkpoints in Postgres | Needed for thread-resume and recovery. [VERIFIED: backend/pyproject.toml] [CITED: https://docs.langchain.com/oss/python/langgraph/persistence] |
| React | ^18.3.1 | Workspace UI | Existing final-output UI and canvas are already React-based. [VERIFIED: frontend/package.json] |
| TypeScript | ^5.7.2 | Typed UI logic | Existing frontend stack. [VERIFIED: frontend/package.json] |
| tldraw | ^4.3.0 | Canvas workspace | Existing final-output card lives in the tldraw workspace. [VERIFIED: frontend/package.json] [VERIFIED: frontend/app/components/canvas/VideoSectionShape.tsx] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | ^4.0.17 | Frontend unit tests | For workspace projection and canvas shape tests. [VERIFIED: frontend/package.json] [VERIFIED: frontend/vite.config.ts] |
| Playwright | ^1.57.0 | E2E tests | For the complete preview/download flow in a real browser. [VERIFIED: frontend/package.json] [VERIFIED: frontend/playwright.config.ts] |
| pytest | >=8.0.0 | Backend tests | For merge eligibility, artifact persistence, and API delivery behavior. [VERIFIED: backend/pyproject.toml] |
| pytest-asyncio | >=0.24.0 | Async backend tests | Needed because the backend test harness is async-first. [VERIFIED: backend/pyproject.toml] [VERIFIED: backend/tests/conftest.py] |
| MSW | ^2.12.7 | UI/API mocking | Useful if the final-output card tests need mocked fetches. [VERIFIED: frontend/package.json] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing final-output card | New delivery page | Extra surface, breaks the locked workspace contract. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md] |
| Canonical `project.video_url` | Separate “finals” table/browser | Adds version browser scope that is explicitly deferred. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md] |
| Static/file responses only | Custom export service | More code, more edge cases, no added value for v1 delivery. [CITED: https://fastapi.tiangolo.com/advanced/custom-response/#fileresponse] |

**Installation:**
```bash
uv sync
pnpm install
```

**Version verification:** backend versions come from `backend/pyproject.toml`; frontend versions come from `frontend/package.json`; response/persistence semantics come from the official docs. [VERIFIED: backend/pyproject.toml] [VERIFIED: frontend/package.json] [CITED: https://fastapi.tiangolo.com/tutorial/static-files/] [CITED: https://docs.langchain.com/oss/python/langgraph/persistence]

## Architecture Patterns

### Recommended Project Structure
```text
backend/
├── app/agents/          # merge / retry execution nodes
├── app/orchestration/   # LangGraph nodes and routing
├── app/services/        # stale invalidation + file lifecycle
└── app/api/v1/routes/   # project/video delivery endpoints
frontend/
├── app/utils/           # workspace projection
├── app/components/     # final-output card and canvas shapes
└── tests/e2e/           # browser-level preview/download smoke
```

### Pattern 1: Canonical final asset + projected state
**What:** write the merged output once to `project.video_url`, then derive the workspace state from that field and current run state. [VERIFIED: backend/app/models/project.py] [VERIFIED: frontend/app/utils/workspaceStatus.ts]
**When to use:** when there is exactly one current final video and the UI must distinguish current vs stale without a version browser. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md]
**Example:**
```ts
// Source: frontend/app/utils/workspaceStatus.ts
if (project.video_url && key === "final-output") {
  return "complete";
}
```

### Pattern 2: Same-thread durable recovery for merge/retry
**What:** keep merge and retry on the same LangGraph thread so failures can be resumed instead of re-authored. [CITED: https://docs.langchain.com/oss/python/langgraph/persistence] [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts]
**When to use:** when a merge run can be interrupted, retried, or resumed after downstream fixes. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md]
**Example:**
```python
# Source: LangGraph persistence docs
config = {"configurable": {"thread_id": "1"}}
graph.get_state(config)
```

### Pattern 3: Delivery surface is read-only except for retry
**What:** preview and download live in the final-output card; the only action should be retry merge / reopen current run. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md]
**When to use:** whenever the creator is looking at the finished artifact rather than editing source clips.
**Example:**
```tsx
// Source: frontend/app/components/canvas/shapes/VideoSectionShape.tsx
<video src={videoUrl} controls aria-label={title} />
<button type="button">导出视频</button>
```

### Anti-Patterns to Avoid
- **Hide the previous final when inputs change:** the context explicitly requires the old final to remain visible and be marked stale. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md]
- **Add a second delivery page:** it conflicts with the locked workspace surface. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md]
- **Treat `project.video_url` as current after downstream invalidation:** creative-control already clears it when clip reruns invalidate the final. [VERIFIED: backend/app/services/creative_control.py]
- **Build custom file serving for simple media delivery:** FastAPI already provides `StaticFiles`, `FileResponse`, and `StreamingResponse`. [CITED: https://fastapi.tiangolo.com/tutorial/static-files/] [CITED: https://fastapi.tiangolo.com/advanced/custom-response/#fileresponse]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Final merge artifact delivery | Custom byte streaming or ad hoc download blobs | `StaticFiles` / `FileResponse` | Already supported by FastAPI and includes headers / path handling. [CITED: https://fastapi.tiangolo.com/tutorial/static-files/] [CITED: https://fastapi.tiangolo.com/advanced/custom-response/#fileresponse] |
| Merge retry / resume state | A second delivery workflow | Same LangGraph thread with persistent checkpoints | Recovery and resume are exactly what LangGraph checkpoints are for. [CITED: https://docs.langchain.com/oss/python/langgraph/persistence] [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts] |
| Current vs stale final detection | Heuristic UI-only checks | Server-side state + workspace projection | The backend already owns stale invalidation and the frontend already projects section state. [VERIFIED: backend/app/services/creative_control.py] [VERIFIED: frontend/app/utils/workspaceStatus.ts] |
| Download filename/path handling | Manual DOM anchor + raw file path assumptions | Server-provided response metadata | `FileResponse` can set `filename`, `Content-Length`, `ETag`, and `Last-Modified`. [CITED: https://fastapi.tiangolo.com/advanced/custom-response/#fileresponse] |

**Key insight:** final delivery is not a new media system; it is a state contract plus a stable file delivery primitive. [VERIFIED: backend/app/models/project.py] [CITED: https://fastapi.tiangolo.com/advanced/custom-response/#fileresponse]

## Common Pitfalls

### Pitfall 1: Stale final looks current
**What goes wrong:** the creator sees a video and assumes it matches the latest clips. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md]
**Why it happens:** the UI only checks for `video_url` and forgets the clip invalidation contract. [VERIFIED: frontend/app/utils/workspaceStatus.ts] [VERIFIED: backend/app/services/creative_control.py]
**How to avoid:** surface `stale/outdated` explicitly and keep the old final visible. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md]
**Warning signs:** final-output card shows a video but no update/provenance label. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md]

### Pitfall 2: Merge runs too early
**What goes wrong:** the system merges partially completed or superseded clips. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md]
**Why it happens:** readiness checks are inferred from stage order instead of current clip completeness. [VERIFIED: frontend/app/utils/workspaceStatus.ts] [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md]
**How to avoid:** gate merge on “every current shot has a current successful clip.” [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md]
**Warning signs:** merge node fires while `shots` still contain `missing`/`generating` clips. [VERIFIED: backend/app/orchestration/graph.py] [VERIFIED: backend/app/agents/video_merger.py]

### Pitfall 3: Retry starts a new workflow
**What goes wrong:** merge failure recovery loses context and diverges from the existing run. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md]
**Why it happens:** the implementation invents a new delivery flow instead of reusing thread/resume. [CITED: https://docs.langchain.com/oss/python/langgraph/persistence] [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts]
**How to avoid:** keep retry on the same thread/run semantics and reuse the current final-output card as the entry point. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md]
**Warning signs:** new delivery-specific state machine or second completion panel appears. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md]

### Pitfall 4: Download endpoint bypasses media safety
**What goes wrong:** raw paths, bad filenames, or traversal bugs leak or break downloads. [CITED: https://fastapi.tiangolo.com/advanced/custom-response/#fileresponse]
**Why it happens:** custom file serving ignores the built-in response semantics. [CITED: https://fastapi.tiangolo.com/tutorial/static-files/] [CITED: https://fastapi.tiangolo.com/advanced/custom-response/#fileresponse]
**How to avoid:** use FastAPI/Starlette file delivery primitives and validate the project-to-file mapping server-side. [CITED: https://fastapi.tiangolo.com/advanced/custom-response/#fileresponse]
**Warning signs:** frontend downloads from a guessed local path instead of a controlled asset URL. [VERIFIED: frontend/app/components/canvas/shapes/VideoSectionShape.tsx]

## Code Examples

Verified patterns from official sources and the repo:

### Serve static final assets
```python
# Source: https://fastapi.tiangolo.com/tutorial/static-files/
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
```

### Return a downloadable merged file
```python
# Source: https://fastapi.tiangolo.com/advanced/custom-response/#fileresponse
from fastapi.responses import FileResponse

@app.get("/api/v1/projects/{project_id}/final-video", response_class=FileResponse)
async def download_final_video(project_id: int):
    return FileResponse(path="app/static/videos/merged.mp4", filename="merged.mp4")
```

### Project final-output state in the workspace
```ts
// Source: frontend/app/utils/workspaceStatus.ts
if (project.video_url && key === "final-output") {
  return "complete";
}
```

### Reuse the current final-video UI slot
```tsx
// Source: frontend/app/components/canvas/shapes/VideoSectionShape.tsx
{videoUrl ? (
  <video className="w-full rounded-lg bg-black" src={videoUrl} controls />
) : (
  <p>{placeholderText}</p>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate publish/delivery page | Final-output card inside the workspace | Phase 6 context lock | Simpler UX, no extra surface. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md] |
| Hide outdated final | Keep old final visible and mark stale | Phase 6 context lock + Phase 5 invalidation | Clearer creator trust and provenance. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md] [VERIFIED: backend/app/services/creative_control.py] |
| Merge at arbitrary time | Merge only when all current clips are successful | Phase 6 context lock | Prevents incomplete outputs. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md] |
| Manual file streaming | FastAPI `StaticFiles` / `FileResponse` | Current FastAPI docs | Less code, better headers, fewer edge cases. [CITED: https://fastapi.tiangolo.com/tutorial/static-files/] [CITED: https://fastapi.tiangolo.com/advanced/custom-response/#fileresponse] |
| Stateless retry | Same-thread durable resume | LangGraph persistence | Merge/retry can survive interruptions. [CITED: https://docs.langchain.com/oss/python/langgraph/persistence] [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts] |

**Deprecated/outdated:**
- A separate version browser for finals is out of scope for v1. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md]
- Silent removal of the previous final on invalidation is explicitly disallowed. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md]

## Assumptions Log

> If this table is empty, all claims in this research were verified or cited.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | None — all implementation-facing claims above are grounded in repo evidence or official docs. | — | — |

## Resolved Decisions

1. **Final-output provenance copy**
   - Use short creator-facing stale/current copy plus explicit blocking clip context.
   - The backend should provide the blocking clip list/count so the workspace can show why merge is blocked without adding a version browser.

2. **Download delivery surface**
   - Use a dedicated auth-aware backend endpoint: `/api/v1/projects/{project_id}/final-video`.
   - Keep the UI pointed at the controlled endpoint so file serving stays project-scoped and filename-safe via `FileResponse`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python | backend tests / local API work | ✓ | 3.14.3 | — |
| Node.js | frontend tests / build | ✓ | v25.9.0 | — |
| pnpm | frontend package management | ✓ | 10.18.3 | — |
| uv | backend package management | ✓ | 0.11.3 | — |
| FFmpeg | merge/local media verification | ✓ | n8.1 | — |
| Docker | local stack / compose parity | ✓ | 29.3.1 | — |
| redis-cli (valkey-cli) | queue / signal sanity checks | ✓ | 9.0.3 | — |
| psql | DB sanity checks | ✓ | 18.3 | — |
| Playwright CLI | browser E2E execution | ✗ | — | Use `pnpm exec playwright` / `pnpm e2e` |

**Missing dependencies with no fallback:**
- None. [VERIFIED: shell availability checks]

**Missing dependencies with fallback:**
- Playwright CLI is not globally installed, but the repo already provides `pnpm e2e` and `frontend/playwright.config.ts`. [VERIFIED: frontend/package.json] [VERIFIED: frontend/playwright.config.ts]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | pytest >=8.0.0 + pytest-asyncio >=0.24.0 [VERIFIED: backend/pyproject.toml] |
| Backend config file | `backend/pyproject.toml` + `backend/tests/conftest.py` [VERIFIED: backend/pyproject.toml] [VERIFIED: backend/tests/conftest.py] |
| Frontend unit framework | Vitest ^4.0.17 [VERIFIED: frontend/package.json] [VERIFIED: frontend/vite.config.ts] |
| Frontend unit config file | `frontend/vite.config.ts` (Vitest config embedded) [VERIFIED: frontend/vite.config.ts] |
| Frontend e2e framework | Playwright ^1.57.0 [VERIFIED: frontend/package.json] [VERIFIED: frontend/playwright.config.ts] |
| Quick run command (backend) | `uv run pytest tests/test_agents/test_video_merger.py -q` |
| Quick run command (frontend) | `pnpm exec vitest run app/utils/workspaceStatus.test.ts` |
| Full suite command (backend) | `uv run pytest` |
| Full suite command (frontend) | `pnpm test && pnpm e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PIPE-03 | Auto-merge produces a final merged artifact once required current clips succeed | backend unit/integration | `uv run pytest tests/test_agents/test_video_merger.py -q` | ✅ |
| PIPE-03 | Merge readiness is blocked when any required clip is missing/failed/generating | backend unit | `uv run pytest tests/test_agents/test_video_merger.py -q` | ✅ (needs new case) |
| DELIV-01 | Final output is visible inside the workspace as an inline preview | frontend unit | `pnpm exec vitest run app/utils/workspaceStatus.test.ts` | ✅ |
| DELIV-01 | Final output appears in the canvas with playable media and stale/current labels | frontend component | `pnpm exec vitest run app/components/canvas/shapes/VideoSectionShape.test.tsx` | ❌ |
| DELIV-02 | Final video can be downloaded from the product | frontend component / e2e | `pnpm e2e` | ❌ |
| DELIV-02 | Download preserves the asset name / file response semantics | backend integration | `uv run pytest tests/test_api/test_projects.py -q` | ✅ (needs new case) |

### Sampling Rate
- **Per task commit:** `uv run pytest tests/test_agents/test_video_merger.py -q` or `pnpm exec vitest run app/utils/workspaceStatus.test.ts`
- **Per wave merge:** `uv run pytest` and `pnpm test`
- **Phase gate:** `pnpm e2e` plus backend suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_api/test_projects.py` — add final-video preview/download route coverage.
- [ ] `backend/tests/test_agents/test_video_merger.py` — add blocked / stale / retry behavior cases.
- [ ] `frontend/app/components/canvas/shapes/VideoSectionShape.test.tsx` — cover play/download states and label copy.
- [ ] `frontend/tests/e2e/final-delivery.spec.ts` — cover completed-project preview/download smoke.
- [ ] Framework install: none — current backend/frontend test tooling is already declared. [VERIFIED: backend/pyproject.toml] [VERIFIED: frontend/package.json] [VERIFIED: frontend/playwright.config.ts] [VERIFIED: frontend/vite.config.ts]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Keep delivery behind the same project access checks as the existing API surface; do not create a bypass path for final media. [VERIFIED: backend/tests/conftest.py] |
| V3 Session Management | no | Not unique to final delivery; rely on existing app/session handling. [VERIFIED: backend/tests/conftest.py] |
| V4 Access Control | yes | Ensure only the owning/authorized creator can read or download the final asset. [CITED: https://fastapi.tiangolo.com/advanced/custom-response/#fileresponse] |
| V5 Input Validation | yes | Validate project IDs, file paths, and stale/current state inputs with typed models. [VERIFIED: backend/app/models/project.py] |
| V6 Cryptography | no | Do not hand-roll crypto for media delivery. [CITED: https://fastapi.tiangolo.com/advanced/custom-response/#fileresponse] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal on media download | Tampering / Elevation | Use controlled `FileResponse` or `StaticFiles` mapping, never arbitrary user-supplied paths. [CITED: https://fastapi.tiangolo.com/tutorial/static-files/] [CITED: https://fastapi.tiangolo.com/advanced/custom-response/#fileresponse] |
| IDOR on final asset access | Spoofing / Information disclosure | Resolve the file from the authenticated project record, not from a client path. [VERIFIED: backend/app/models/project.py] |
| Stale-final leakage | Information disclosure / Tampering | Preserve the old final only with explicit stale labeling and provenance. [CITED: .planning/phases/06-final-assembly-delivery/06-CONTEXT.md] |
| Wrong-thread retry | Tampering / Repudiation | Resume merge on the same LangGraph `thread_id`. [CITED: https://docs.langchain.com/oss/python/langgraph/persistence] [CITED: https://docs.langchain.com/oss/python/langgraph/interrupts] |

## Sources

### Primary (HIGH confidence)
- `backend/app/models/project.py` - canonical `Project.video_url` storage and model state. [VERIFIED]
- `backend/app/agents/video_merger.py` - current merge path, `project_updated` event, and final-video write. [VERIFIED]
- `backend/app/services/creative_control.py` - downstream invalidation clears final video on reruns. [VERIFIED]
- `backend/app/orchestration/graph.py` - merge is the final node after clip. [VERIFIED]
- `frontend/app/utils/workspaceStatus.ts` - workspace section projection and final-output state rules. [VERIFIED]
- `frontend/app/components/canvas/VideoSectionShape.tsx` - inline preview/download final-output UI. [VERIFIED]
- `frontend/app/components/canvas/InfiniteCanvas.tsx` - workspace composition uses `project.video_url` for the final slot. [VERIFIED]
- `frontend/vite.config.ts` - Vitest config and frontend test setup. [VERIFIED]
- `frontend/playwright.config.ts` - browser E2E config and dev server command. [VERIFIED]
- `backend/pyproject.toml` - declared backend dependency versions and pytest config. [VERIFIED]
- `frontend/package.json` - declared frontend dependency versions and scripts. [VERIFIED]
- `backend/tests/conftest.py` - async test harness, DB/session overrides, ws stub. [VERIFIED]
- https://fastapi.tiangolo.com/tutorial/static-files/ - `StaticFiles` mount semantics. [CITED]
- https://fastapi.tiangolo.com/advanced/custom-response/#fileresponse - `FileResponse` semantics and headers. [CITED]
- https://docs.langchain.com/oss/python/langgraph/persistence - checkpoint/thread/resume behavior. [CITED]
- https://docs.langchain.com/oss/python/langgraph/interrupts - interrupt/resume and same-thread recovery. [CITED]

### Secondary (MEDIUM confidence)
- None; the phase is already grounded in repo state and official docs. [VERIFIED]

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions and configs come from repo manifests plus official docs. [VERIFIED] [CITED]
- Architecture: HIGH - locked phase context and live code paths align. [VERIFIED] [CITED]
- Pitfalls: HIGH - directly supported by existing invalidation/projection logic and official delivery docs. [VERIFIED] [CITED]

**Research date:** 2026-04-11
**Valid until:** 2026-05-11

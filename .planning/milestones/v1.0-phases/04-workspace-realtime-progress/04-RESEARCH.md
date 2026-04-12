# Phase 4: Workspace & Realtime Progress - Research

**Researched:** 2026-04-11
**Domain:** tldraw projection workspace + FastAPI WebSocket progress hydration + React Query cache sync [VERIFIED: repo]
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Phase 4 keeps a stage-section-first canvas layout.
- The workspace is organized into canonical sections for script, characters, storyboards, clips, and final output.
- Each section may render one or more artifact cards inside it, but Phase 4 does not switch to a fully free-form artifact-first graph.
- Canonical artifact slots may appear before content exists so the creator can still see draft / generating / blocked / failed / complete state.
- Missing output should not mean invisible output; placeholders are allowed and expected for normative workspace slots.
- Phase 4 must preserve Phase 3's approved/superseded review semantics while also surfacing generation status in the workspace.
- The primary realtime progress surface remains the progress panel / banner rather than making the canvas itself the main progress console.
- The canvas may show lightweight status badges, inline loading states, and blocked markers, but the main explanation of current stage and run state stays in the progress/chat shell.
- Phase 4 does not introduce user-authored canvas layout persistence.
- Refresh restores the same system-generated workspace projection from backend metadata, but does not guarantee persistence of the creator's transient drag/reposition edits.
- Frontend progress copy uses creator-friendly stage labels.
- Approval pauses are surfaced explicitly as creator-facing waiting states (for example: waiting for character review / waiting for storyboard review) rather than leaking raw backend stage names directly.
- When a run is paused for review, the run-level progress surface shows a waiting-for-review state.
- Downstream artifact cards that cannot proceed yet should show blocked / not started status so the creator can see both why the run is paused and what content is still pending.

### the agent's Discretion
- The exact badge system, card internals, and preview interaction details are at the agent's discretion as long as the workspace remains a backend-driven projection, preserves current-state-only review visibility, and does not introduce user-layout persistence or a version browser.
- The exact mapping from backend run/stage signals into creator-facing labels is at the agent's discretion as long as approval pauses remain explicit and understandable.

### Deferred Ideas (OUT OF SCOPE)
- Fully free-form artifact-first graph layout.
- User-authored canvas layout persistence.
- Canvas as the primary, detailed progress console.
- Full version browser / version switching UI.
- Asset-level recovery, replay, or fork controls in the workspace.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WORK-01 | A creator can use an infinite canvas workspace to view the project’s script, characters, storyboards, clips, and final output as related artifacts. | tldraw custom shapes + deterministic layout + backend-authored projection from project/run/artifact metadata [CITED: https://tldraw.dev/docs/shapes; https://tldraw.dev/docs/editor; VERIFIED: repo] |
| WORK-02 | The workspace can show artifact status clearly, including draft, generating, complete, failed, and superseded states. | Existing `approval_state` review contract plus placeholder/status badges in custom shapes and refresh hydration rules [VERIFIED: repo; CITED: https://tldraw.dev/docs/shapes] |
| PIPE-02 | A creator can see the current stage, progress, and status changes of a generation run in real time. | FastAPI WebSocket push + React effect cleanup + TanStack Query cache invalidation / mutation side effects [CITED: https://fastapi.tiangolo.com/advanced/websockets/; https://react.dev/reference/react/useEffect; https://tanstack.com/query/latest/docs/framework/react/guides/mutations] |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- **Tech Stack**: Existing repo uses FastAPI on the backend and React + TypeScript on the frontend — planning should prefer evolution over unnecessary rewrite because meaningful implementation already exists. [VERIFIED: /home/xeron/Coding/openOii/AGENTS.md]
- **Audience**: Primary target user is an independent creator — because the user explicitly selected solo-creator focus for v1. [VERIFIED: /home/xeron/Coding/openOii/AGENTS.md]
- **Value Proof**: v1 must prove idea-to-final-video closure — because the user explicitly selected this as the main success objective. [VERIFIED: /home/xeron/Coding/openOii/AGENTS.md]
- **Operational Shape**: The product includes long-running generation and media assembly steps — architecture and roadmap must account for resumability, progress reporting, and recovery. [VERIFIED: /home/xeron/Coding/openOii/AGENTS.md]
- **Workflow Preferences**: Planning runs in interactive mode with standard granularity, parallel execution, research, plan-check, and verifier enabled — because the user explicitly chose a higher-confidence planning workflow. [VERIFIED: /home/xeron/Coding/openOii/AGENTS.md]
- **Planning Persistence**: `.planning/` should be tracked in git — because the user chose to keep planning documents versioned. [VERIFIED: /home/xeron/Coding/openOii/AGENTS.md]

## Summary

Phase 4 should be planned as a **backend-authored workspace projection**: the canvas renders canonical artifact slots from project/run/artifact metadata, while WebSocket events only mutate the live view state and the progress shell remains the authoritative source of run state [VERIFIED: CONTEXT.md; VERIFIED: repo].

The key planning risk is **state drift**: tldraw cards, the progress panel, and query cache must all reflect the same backend truth after refresh, WebSocket updates, and review pauses [VERIFIED: repo]. The safest implementation path is to keep the current section-first layout, enrich each section with placeholder/status semantics, and use cache invalidation plus derived projection helpers instead of local canvas persistence [CITED: https://tldraw.dev/docs/persistence; https://react.dev/reference/react/useEffect; VERIFIED: CONTEXT.md].

**Primary recommendation:** implement a single projection pipeline from backend metadata → query cache/store → tldraw shapes, and treat live WebSocket updates as deltas on top of that projection [VERIFIED: CONTEXT.md; VERIFIED: repo].

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tldraw | 4.5.8 [VERIFIED: npm registry] | Infinite canvas + custom shape runtime | Custom shapes use `ShapeUtil`, `HTMLContainer`, and the editor runtime; this fits the section-first workspace projection already in the repo [CITED: https://tldraw.dev/docs/shapes; https://tldraw.dev/docs/editor]. |
| React | 19.2.5 [VERIFIED: npm registry] | UI + lifecycle/effects | `useEffect` is the correct place to connect/disconnect WebSocket subscriptions and other external systems; React docs explicitly recommend cleanup functions and client-only effects [CITED: https://react.dev/reference/react/useEffect]. |
| @tanstack/react-query | 5.97.0 [VERIFIED: npm registry] | Project/artifact cache + invalidation | Mutations expose `onSuccess`, `onSettled`, `mutateAsync`, and cache invalidation hooks, which match the project refresh/reload flow [CITED: https://tanstack.com/query/latest/docs/framework/react/guides/mutations]. |
| FastAPI | 0.135.3 [VERIFIED: PyPI] | WebSocket API + backend projection endpoints | FastAPI WebSocket routes accept dependency injection and structured receive/send loops, which is the current backend transport pattern [CITED: https://fastapi.tiangolo.com/advanced/websockets/]. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zustand | 5.0.12 [VERIFIED: npm registry] | UI state mirror for current stage/progress/selection | Use for transient workspace state that should not become the source of truth [VERIFIED: repo]. |
| Browser WebSocket API | built-in [CITED: https://fastapi.tiangolo.com/advanced/websockets/] | Client-side realtime connection | Use for the project-scoped live progress feed; pair with cleanup in `useEffect` [CITED: https://react.dev/reference/react/useEffect]. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| backend projection + tldraw custom shapes | `persistenceKey` local canvas storage | Good for simple demos, but the docs describe browser storage/local sync; Phase 4 needs refreshable backend truth, not transient local layout [CITED: https://tldraw.dev/docs/persistence]. |
| React Query cache + WebSocket deltas | manual `useEffect` fetching | React docs call out race conditions and waterfalls for direct fetching; TanStack Query gives cache/invalidation primitives for this phase [CITED: https://react.dev/reference/react/useEffect; https://tanstack.com/query/latest/docs/framework/react/guides/mutations]. |

**Installation:**
```bash
pnpm add tldraw @tanstack/react-query react react-dom zustand
uv add fastapi uvicorn
```

**Version verification:**
```bash
npm view tldraw version
npm view react version
npm view @tanstack/react-query version
npm view zustand version
python3 - <<'PY'
import json, urllib.request
for pkg in ['fastapi','uvicorn']:
    data=json.load(urllib.request.urlopen(f'https://pypi.org/pypi/{pkg}/json'))
    print(pkg, data['info']['version'])
PY
```

## Architecture Patterns

### Recommended Project Structure
```text
frontend/app/
├── components/canvas/        # tldraw shell, custom shapes, projection badges
├── components/layout/        # page shell, progress panel, stage view
├── hooks/                    # websocket + projection derivation hooks
├── stores/                   # transient UI state mirror
└── pages/                    # project workspace page and refresh orchestration

backend/app/
├── schemas/                  # websocket payloads and projection DTOs
├── ws/                       # websocket manager / broadcast path
├── models/                   # run, stage, artifact source of truth
└── services/                 # snapshot / recovery / projection helpers
```

### Pattern 1: Backend-Authored Workspace Projection
**What:** derive the canvas from project/run/artifact records and rehydrate it on refresh [VERIFIED: CONTEXT.md; VERIFIED: repo].  
**When to use:** whenever the workspace must survive browser refresh or websocket reconnect.  
**Example:**
```tsx
// Source: https://tldraw.dev/docs/shapes
class CardShapeUtil extends ShapeUtil<CardShape> {
  static override type = CARD_TYPE

  getDefaultProps(): CardShape['props'] {
    return { w: 100, h: 100 }
  }

  getGeometry(shape: CardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  component(shape: CardShape) {
    return <HTMLContainer>...</HTMLContainer>
  }
}
```

### Pattern 2: Progress Shell First, Canvas Second
**What:** keep the progress panel/banner as the primary explanation of what the run is doing, and let the canvas show lightweight badges/loading markers only [VERIFIED: CONTEXT.md].  
**When to use:** for all live run states, especially paused review states and blocked downstream cards.  
**Example:**
```tsx
// Source: https://react.dev/reference/react/useEffect
useEffect(() => {
  const ws = createConnection(projectId)
  ws.connect()
  return () => ws.disconnect()
}, [projectId])
```

### Anti-Patterns to Avoid
- **Canvas-only progress console:** the phase boundary explicitly keeps the progress shell authoritative [VERIFIED: CONTEXT.md].
- **User-authored canvas persistence:** refresh should reconstruct the system projection, not preserve transient drag edits [VERIFIED: CONTEXT.md].
- **Frontend-only status truth:** status should come from backend metadata plus WS updates, not from local card state [VERIFIED: repo].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Workspace shape rendering | a second bespoke canvas system | tldraw `ShapeUtil` + `HTMLContainer` | tldraw already provides custom shapes, editor control, geometry, and persistence primitives [CITED: https://tldraw.dev/docs/shapes; https://tldraw.dev/docs/editor; https://tldraw.dev/docs/persistence]. |
| Browser reconnect cleanup | ad hoc socket lifecycle logic | `useEffect` with cleanup | React docs explicitly require cleanup for external subscriptions and warn about race conditions [CITED: https://react.dev/reference/react/useEffect]. |
| Realtime cache sync | manual cache resets on every message | React Query invalidation / mutation callbacks | TanStack Query provides `onSuccess`, `onSettled`, `mutateAsync`, and cache methods for this exact side-effect style [CITED: https://tanstack.com/query/latest/docs/framework/react/guides/mutations]. |
| Refresh reconstruction | local canvas persistence as the source of truth | backend metadata projection | tldraw persistence docs show local persistence is browser-storage oriented; Phase 4 needs server-derived refresh consistency [CITED: https://tldraw.dev/docs/persistence]. |

**Key insight:** the hard part is not drawing cards; it is keeping projection, progress, and refresh all aligned to the same backend truth [VERIFIED: CONTEXT.md; VERIFIED: repo].

## Common Pitfalls

### Pitfall 1: Status drift between canvas and progress panel
**What goes wrong:** one surface says the run is generating while another says blocked or complete [VERIFIED: repo].  
**Why it happens:** multiple stores or separate derivation paths update independently [VERIFIED: repo].  
**How to avoid:** derive both surfaces from the same projection helper and WS event reducer [VERIFIED: CONTEXT.md].  
**Warning signs:** different labels for the same run/stage in `ChatPanel`, `StageView`, and canvas cards [VERIFIED: repo].

### Pitfall 2: Missing placeholders make empty slots invisible
**What goes wrong:** a section disappears until the first artifact exists, so the creator loses the sense of pipeline shape [VERIFIED: CONTEXT.md].  
**Why it happens:** the implementation treats empty state as absent state instead of a canonical slot [VERIFIED: CONTEXT.md].  
**How to avoid:** always render the canonical sections and an explicit empty/loading/blocked card state [VERIFIED: CONTEXT.md].  
**Warning signs:** workspace jumps from blank to populated with no intermediate explanation [VERIFIED: repo].

### Pitfall 3: Treating backend stage names as creator copy
**What goes wrong:** UI leaks `script`, `character_approval`, or `merge` into user-facing text [VERIFIED: CONTEXT.md; VERIFIED: repo].  
**Why it happens:** the mapping layer is bypassed [VERIFIED: CONTEXT.md].  
**How to avoid:** keep a stage-label adapter for progress copy and card subtitles [VERIFIED: CONTEXT.md].  
**Warning signs:** copy contains raw backend tokens or internal agent names [VERIFIED: repo].

### Pitfall 4: WebSocket effects leak duplicate listeners
**What goes wrong:** reconnects duplicate progress updates or double-apply state changes [CITED: https://react.dev/reference/react/useEffect].  
**Why it happens:** the effect is not cleaned up or dependencies are unstable [CITED: https://react.dev/reference/react/useEffect].  
**How to avoid:** one connection per project, cleanup on unmount/project change, and reuse the current `useProjectWebSocket` pattern [VERIFIED: repo].  
**Warning signs:** repeated `run_progress` events or duplicate toast/messages after route changes [VERIFIED: repo].

## Code Examples

Verified patterns from official sources:

### Custom tldraw shape for workspace cards
```tsx
// Source: https://tldraw.dev/docs/shapes
import { HTMLContainer, Rectangle2d, ShapeUtil } from 'tldraw'

class CardShapeUtil extends ShapeUtil<CardShape> {
  static override type = CARD_TYPE
  getDefaultProps() { return { w: 100, h: 100 } }
  getGeometry(shape: CardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }
  component() { return <HTMLContainer /> }
}
```

### FastAPI WebSocket progress route
```python
# Source: https://fastapi.tiangolo.com/advanced/websockets/
@app.websocket("/ws/projects/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: int):
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        await websocket.send_text(data)
```

### React Query mutation-side refresh
```tsx
// Source: https://tanstack.com/query/latest/docs/framework/react/guides/mutations
const mutation = useMutation({
  mutationFn: updateProject,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `persistenceKey` local canvas storage | backend snapshot/projection + refresh hydration | 2026 tldraw docs [CITED: https://tldraw.dev/docs/persistence] | refresh becomes a backend truth check instead of a local-layout restore [VERIFIED: CONTEXT.md]. |
| Fetching mutable server state directly in `useEffect` | React Query cache + explicit invalidation | current React guidance [CITED: https://react.dev/reference/react/useEffect; https://tanstack.com/query/latest/docs/framework/react/guides/mutations] | fewer waterfalls, easier refresh, clearer side-effect boundaries [CITED]. |
| Canvas as the main progress console | progress panel/banner first, canvas status badges second | Phase 4 decision [VERIFIED: CONTEXT.md] | easier to scan live status without hiding the workspace [VERIFIED: CONTEXT.md]. |

**Deprecated/outdated:**
- Browser-local canvas persistence as the primary workspace source of truth [CITED: https://tldraw.dev/docs/persistence; VERIFIED: CONTEXT.md].
- Direct `useEffect` data fetching for cacheable project state [CITED: https://react.dev/reference/react/useEffect].

## Assumptions Log

> All claims in this research were verified or cited in-session; no extra assumptions were needed.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | None | — | — |

## Open Questions (RESOLVED)

1. **RESOLVED — How should the empty workspace be seeded when a project exists but no generation run has produced artifacts yet?**
   - Resolution: the workspace should be seeded from a backend-authored projection that always emits the canonical section slots, even when no artifacts exist yet.
   - Why: Phase 4 explicitly locked canonical placeholders and a refresh-safe backend projection, so the empty state is part of the product contract rather than an absence of data [VERIFIED: CONTEXT.md].

2. **RESOLVED — How granular should blocked status be on downstream cards?**
   - Resolution: blocked status should be derived from the run/stage/review summary first, then reflected on the downstream artifact slots as blocked / not started until the gate clears.
   - Why: Phase 4 explicitly locked a run-level waiting-for-review surface plus downstream blocked cards, so blocked is a projection concern layered on top of stage-oriented run state [VERIFIED: CONTEXT.md].

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Python | backend tests / API work | ✓ | 3.14.3 [VERIFIED: bash] | — |
| uv | backend dependency management | ✓ | 0.11.3 [VERIFIED: bash] | — |
| Node.js | frontend tests / build | ✓ | v25.9.0 [VERIFIED: bash] | — |
| pnpm | frontend dependency management | ✓ | 10.18.3 [VERIFIED: bash] | — |
| ffmpeg | video-related integration checks | ✓ | n8.1 [VERIFIED: bash] | — |
| Docker | local stack / integration runtime | ✓ | 29.3.1 [VERIFIED: bash] | — |
| PostgreSQL server | runtime persistence / manual integration | ✗ | no response on localhost:5432 [VERIFIED: bash] | Use SQLite-backed tests or docker-compose PostgreSQL |
| Redis server | live run/progress distribution | ✗ | no local server confirmed [VERIFIED: bash] | Use docker-compose Redis/Valkey container |

**Missing dependencies with no fallback:**
- None [VERIFIED: repo; VERIFIED: bash].

**Missing dependencies with fallback:**
- PostgreSQL server (local process not up) — fallback is SQLite tests or docker-compose [VERIFIED: bash].
- Redis server (local process not confirmed) — fallback is docker-compose [VERIFIED: bash].

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Backend: pytest 8 + pytest-asyncio; Frontend: Vitest 4 + Testing Library + Playwright [VERIFIED: backend/pyproject.toml; VERIFIED: frontend/package.json] |
| Config file | `backend/pyproject.toml`, `frontend/package.json` [VERIFIED: repo] |
| Quick run command | `pnpm test -- --run app/hooks/useWebSocket.test.ts app/components/canvas/InfiniteCanvas.test.tsx && uv run pytest tests/test_api/test_websocket.py -q` |
| Full suite command | `pnpm test && pnpm tsc --noEmit && uv run pytest -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WORK-01 | Canonical workspace sections render in the infinite canvas, including empty slots before content exists. | component/integration | `pnpm test -- --run app/components/layout/StageView.test.tsx app/components/canvas/InfiniteCanvas.test.tsx` | `InfiniteCanvas.test.tsx` ✅ / `StageView.test.tsx` ❌ [VERIFIED: repo] |
| WORK-02 | Cards display draft / generating / blocked / failed / complete states without hiding missing artifacts. | component/unit | `pnpm test -- --run app/components/canvas/shapes/ScriptSectionShape.test.tsx app/components/canvas/shapes/CharacterSectionShape.test.tsx app/components/canvas/StoryboardSectionShape.test.tsx app/components/canvas/VideoSectionShape.test.tsx` | `StoryboardSectionShape.test.tsx` ✅; other status-specific tests need Wave 0 confirmation [VERIFIED: repo] |
| PIPE-02 | Progress updates, stage changes, and refresh hydration stay in sync with live run events. | unit/integration | `pnpm test -- --run app/hooks/useWebSocket.test.ts app/stores/editorStore.test.ts app/pages/ProjectPage.test.tsx` | `useWebSocket.test.ts` ✅; `ProjectPage.test.tsx` likely needs Wave 0 coverage [VERIFIED: repo] |

### Sampling Rate
- **Per task commit:** `pnpm test -- --run app/hooks/useWebSocket.test.ts app/components/canvas/InfiniteCanvas.test.tsx` or `uv run pytest tests/test_api/test_websocket.py -q` depending on the slice [VERIFIED: repo].
- **Per wave merge:** `pnpm test && pnpm tsc --noEmit` plus backend websocket coverage with `uv run pytest -q` [VERIFIED: repo].
- **Phase gate:** full frontend + backend suite green before `/gsd-verify-work` [VERIFIED: config].

### Wave 0 Gaps
- [ ] `frontend/app/components/layout/StageView.test.tsx` — covers empty workspace guidance vs canvas fallback for WORK-01 [VERIFIED: repo].
- [ ] `frontend/app/components/canvas/VideoSectionShape.test.tsx` — covers final-output placeholder/status states for WORK-02 [VERIFIED: repo].
- [ ] `frontend/app/pages/ProjectPage.test.tsx` — covers refresh/hydration behavior after `projectUpdatedAt` changes for PIPE-02 [VERIFIED: repo].
- [ ] `frontend/app/components/canvas/statusProjection.ts` (or equivalent helper, if extracted) — would let WORK-01/WORK-02 logic stay deterministic and testable [VERIFIED: repo].

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no new auth work | existing project auth/session boundary stays in place [VERIFIED: repo] |
| V3 Session Management | no new session work | reuse the current authenticated websocket/session model [VERIFIED: repo] |
| V4 Access Control | yes | project-scoped websocket and project fetch checks; never trust client-side project IDs alone [CITED: https://fastapi.tiangolo.com/advanced/websockets/] |
| V5 Input Validation | yes | Pydantic event schemas plus typed frontend DTOs for WS payloads [VERIFIED: repo] |
| V6 Cryptography | no | nothing new to design here [VERIFIED: CONTEXT.md] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-project websocket subscription | Elevation of Privilege | validate project ownership server-side before accepting/broadcasting [CITED: https://fastapi.tiangolo.com/advanced/websockets/] |
| Client-side status spoofing | Tampering | backend-authored projection + typed event validation [VERIFIED: repo] |
| Stale or duplicate progress events after reconnect | Repudiation / Tampering | `useEffect` cleanup, one socket per project, idempotent state reducers [CITED: https://react.dev/reference/react/useEffect] |
| Unsafe artifact/status text rendering | XSS | render text as text; sanitize any future rich-text/HTML payloads before display [VERIFIED: repo] |

## Sources

### Primary (HIGH confidence)
- `/home/xeron/Coding/openOii/.planning/phases/04-workspace-realtime-progress/04-CONTEXT.md` - phase boundary, locked decisions, reusable assets [VERIFIED: repo]
- `/home/xeron/Coding/openOii/frontend/app/components/canvas/InfiniteCanvas.tsx` - current tldraw shell and query/mutation wiring [VERIFIED: repo]
- `/home/xeron/Coding/openOii/frontend/app/hooks/useCanvasLayout.ts` - deterministic section-first layout generator [VERIFIED: repo]
- `/home/xeron/Coding/openOii/frontend/app/hooks/useWebSocket.ts` - WebSocket reducer for progress and project updates [VERIFIED: repo]
- `/home/xeron/Coding/openOii/frontend/app/pages/ProjectPage.tsx` - refresh/invalidation behavior and workspace shell [VERIFIED: repo]
- `/home/xeron/Coding/openOii/frontend/app/components/chat/ChatPanel.tsx` - progress shell and creator-facing stage labels [VERIFIED: repo]
- `/home/xeron/Coding/openOii/backend/app/schemas/ws.py` and `/home/xeron/Coding/openOii/backend/app/ws/manager.py` - websocket event contract and validation path [VERIFIED: repo]
- `https://tldraw.dev/docs/shapes` - custom shapes, `ShapeUtil`, `HTMLContainer` [CITED]
- `https://tldraw.dev/docs/editor` - editor control and `onMount` API [CITED]
- `https://tldraw.dev/docs/persistence` - local persistence, snapshots, multiplayer sync [CITED]
- `https://fastapi.tiangolo.com/advanced/websockets/` - WebSocket routes, dependencies, disconnections [CITED]
- `https://react.dev/reference/react/useEffect` - effect cleanup and external-system synchronization [CITED]
- `https://tanstack.com/query/latest/docs/framework/react/guides/mutations` - mutation side effects and cache invalidation [CITED]
- npm registry versions for tldraw/react/react-query/zustand/daisyui/vite/vitest [VERIFIED: npm view]
- PyPI versions for fastapi/uvicorn/pydantic/sqlalchemy/alembic/langgraph/anthropic [VERIFIED: PyPI JSON]

### Secondary (MEDIUM confidence)
- None needed; main claims were verified against repo or official docs [VERIFIED: repo].

### Tertiary (LOW confidence)
- None; no low-confidence claims were retained [VERIFIED: repo].

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions verified in registry/PyPI and behavior confirmed in official docs [VERIFIED: npm view; VERIFIED: PyPI JSON; CITED].
- Architecture: HIGH - driven by locked phase decisions and current repo structure [VERIFIED: CONTEXT.md; VERIFIED: repo].
- Pitfalls: HIGH - directly grounded in current code paths and official docs [VERIFIED: repo; CITED].

**Research date:** 2026-04-11
**Valid until:** 2026-04-25 (14 days)

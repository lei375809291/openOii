# Architecture Research

**Domain:** AI-agent creative pipeline for comic-drama video generation
**Researched:** 2026-04-11
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Creator Experience Layer                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Project Init │  │ Canvas Work  │  │ Review / Rerun│ │ Playback /    │   │
│  │ + Prompting  │  │ + Artifacts  │  │ + Feedback    │ │ Export        │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                 │                 │           │
├─────────┴─────────────────┴─────────────────┴─────────────────┴───────────┤
│                           Control Plane Layer                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────────────┐ │
│  │ FastAPI API     │  │ Run Orchestrator │  │ Review / Rerun Router     │ │
│  │ + Auth + Config │  │ + Session Model  │  │ + Approval / Resume       │ │
│  └─────────────────┘  └──────────────────┘  └───────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│                          Execution & Tooling Layer                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │ Agent Runtime │  │ MCP Tool Face │  │ Queue / Jobs  │  │ Media Workers │ │
│  │ + Roles       │  │ + Providers   │  │ + Scheduling  │  │ + Assembly    │ │
│  └───────────────┘  └───────────────┘  └───────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│                         Persistence & Asset Layer                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐ │
│  │ PostgreSQL │  │ Object     │  │ Redis /    │  │ Provider Output /    │ │
│  │ Metadata   │  │ Storage    │  │ Broker     │  │ Cache / Temp Assets  │ │
│  └────────────┘  └────────────┘  └────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Creator UI | Collect story input, visualize pipeline state, preview outputs, capture rerun feedback | React + TypeScript + tldraw-based canvas + query/state layer |
| API / Control Plane | Own requests, sessions, permissions, config, run lifecycle, websocket events | FastAPI modular monolith |
| Orchestrator | Decide which node/subgraph runs next, track durable run state, manage resume / rerun semantics | LangGraph `StateGraph` with conditional edges, interrupts, and persistence |
| Agent Roles | Produce structured creative outputs at each stage | LangGraph nodes and subgraphs backed by model/tool calls |
| MCP Tool Face | Expose generation, storage, retrieval, and utility tools cleanly to agents | In-process SDK MCP server plus external MCP or provider adapters |
| Queue / Workers | Run long jobs without blocking API, handle retries and recovery | Redis-backed queue or equivalent async job runner |
| Metadata Store | Persist projects, runs, stages, asset lineage, approvals, feedback | PostgreSQL |
| Object / Asset Storage | Store images, clips, merged videos, reviewable artifacts | S3-compatible object store or filesystem in dev |

## Recommended Project Structure

```
backend/
├── app/
│   ├── api/                 # HTTP, websocket, config, and run endpoints
│   ├── domain/              # Project, asset, run, review, and lineage models
│   ├── orchestration/       # Run state machine, routing, resume, rerun decisions
│   ├── agents/              # Agent role definitions, prompts, permissions, hooks
│   ├── tools/               # MCP tool registration and app-owned utilities
│   ├── providers/           # LLM, image, video, and media provider adapters
│   ├── jobs/                # Background job dispatch, retries, progress updates
│   ├── storage/             # Asset persistence, caching, signed URLs, cleanup
│   └── telemetry/           # Logs, metrics, tracing, cost accounting
├── tests/
└── pyproject.toml

frontend/
├── app/
│   ├── pages/               # Project creation, project workspace, history/review surfaces
│   ├── components/
│   │   ├── canvas/          # tldraw workspace, custom shapes, previews, overlays
│   │   ├── review/          # Approval, diff, rerun, and artifact comparison UI
│   │   └── settings/        # Provider and environment configuration UX
│   ├── stores/              # UI-only state, canvas selection, active review state
│   ├── services/            # API client, websocket client, artifact actions
│   └── schemas/             # Shared DTO validation and typed payloads
├── tests/
└── package.json

shared/
└── contracts/               # Shared event payloads, enums, status constants (optional)
```

### Structure Rationale

- **backend/app/orchestration/** should become the LangGraph home: state schema, nodes, subgraphs, reducers, interrupts, and compile-time wiring.
- **backend/app/tools/** isolates tool exposure from provider implementations, which makes MCP and non-MCP adapters swappable.
- **backend/app/domain/** prevents the metadata model from being scattered across API, jobs, and provider code.
- **frontend/app/components/canvas/** should stay focused on workspace composition rather than becoming the entire application shell.
- **shared/contracts/** is optional but useful once frontend/backend event schemas start drifting.

## Architectural Patterns

### Pattern 1: Control Plane + Async Execution

**What:** Keep FastAPI as a modular monolith control plane, but move long-running generation and assembly work into background jobs.
**When to use:** When user-facing requests must remain responsive while creative generation may take seconds or minutes.
**Trade-offs:** Simpler than microservices for v1 and easier to reason about; requires explicit job status, retries, and idempotency.

**Example:**
```text
API request -> create run record -> enqueue stage job -> worker executes -> persist outputs -> websocket update
```

### Pattern 2: LangGraph-First Orchestration

**What:** The primary workflow contract lives in a LangGraph `StateGraph`; stages become nodes or subgraphs, routing becomes explicit edges, and review points use `interrupt()` / resume.
**When to use:** When long-running creative workflows need durable state, resume, auditability, human approval points, and partial reruns.
**Trade-offs:** Stronger workflow guarantees, but requires deliberate state schema design, reducers, and idempotent side effects.

**Example:**
```text
brief -> outline -> character/storyboard branches -> review interrupt -> clip generation -> final assembly
```

### Pattern 3: Tool-Based Side Effects Outside Graph Truth

**What:** LangGraph owns control flow and state transitions; tools and services own provider calls, storage, and heavy media execution.
**When to use:** When the product needs durable orchestration but should not collapse all infrastructure into graph nodes.
**Trade-offs:** Cleaner boundaries and easier auditability; requires discipline so side effects remain idempotent and metadata-aware.

### Pattern 4: Artifact Lineage as a First-Class Model

**What:** Treat every generated item as a versioned artifact with parent/child lineage, provider metadata, prompt lineage, and review state.
**When to use:** Whenever selective reruns, auditability, or consistency across stages matter.
**Trade-offs:** More metadata modeling up front; dramatically lowers confusion during reruns and review.

### Pattern 5: Canvas as Reviewable Projection, Not Source of Truth

**What:** The tldraw canvas reflects artifact and run metadata, but authoritative state lives in backend metadata models.
**When to use:** In media-heavy systems where reload, recovery, approvals, and partial reruns must survive browser refresh and job retries.
**Trade-offs:** Requires careful sync design; avoids making the canvas state impossible to recover or validate.

## Data Flow

### Request Flow

```
[Creator starts project]
    ↓
[Project API] → [Run Service] → [LangGraph Runtime + Checkpointer] → [Queue / Workers]
    ↓                 ↓               ↓                ↓
[Initial UI]   [Run status]     [Stage job]     [Artifact outputs]
    ↓                                                   ↓
[Canvas + Review UI] ← [WebSocket/Event Stream] ← [Metadata + Asset Store]
```

### State Management

```
[Backend Metadata]
    ↓ (query / websocket)
[Frontend data cache]
    ↓
[Canvas projection + overlays] ←→ [UI-only store] → [actions: review / rerun / select / preview]
```

### Key Data Flows

1. **Project bootstrap:** story input + style choice -> project record -> generation run -> first agent context.
2. **Stage execution:** LangGraph advances node/subgraph state -> side-effecting tools enqueue or execute provider work -> outputs are persisted as artifacts -> UI receives progress.
3. **Selective rerun:** creator chooses one artifact or branch -> review router maps it to graph state and resume scope -> downstream invalidation and rerun plan are computed -> only affected artifacts are regenerated.
4. **Final assembly:** approved clips are merged -> final video artifact is persisted -> export/playback surface updates.

## Suggested Build Order

1. **Graph foundation** — state schema, reducers, node boundaries, `project_id/run_id/thread_id` mapping.
2. **Durable execution** — persistent checkpointer, resume/replay semantics, idempotent node side effects.
3. **Human-in-the-loop review** — interrupts, approval/resume flows, rerun scope contracts.
4. **Tool and worker boundary stabilization** — provider adapters, ARQ jobs, asset registration.
5. **Canvas projection layer** — custom shapes for graph-backed script/character/storyboard/video artifacts.
6. **Export and resilience** — final assembly, recovery, cleanup, telemetry, cost controls.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 active creators | Single FastAPI deployment, one metadata DB, one queue/broker, bounded worker pools |
| 100-1k active creators | Separate worker pools by stage type, move assets to object storage, add stronger retry/cost controls |
| 1k+ active creators | Split provider-intensive workers, introduce dedicated event/telemetry pipelines, isolate high-cost media assembly infrastructure |

### Scaling Priorities

1. **First bottleneck:** long-running video/image jobs competing with API responsiveness — fix with queued execution, per-stage worker pools, and backpressure.
2. **Second bottleneck:** asset and lineage sprawl — fix with explicit retention rules, signed URLs, and metadata-driven cleanup.

## Anti-Patterns

### Anti-Pattern 1: Premature Microservices

**What people do:** Split orchestration, providers, review, and media assembly into multiple services too early.
**Why it's wrong:** V1 complexity shifts from product learning to distributed systems coordination.
**Do this instead:** Use a modular monolith control plane with clear internal boundaries and queue-backed workers.

### Anti-Pattern 2: Treating Every Generation as Stateless

**What people do:** Persist only final outputs, not stage state, lineage, or feedback scope.
**Why it's wrong:** Resume, review, rerun, and debugging all become brittle or impossible.
**Do this instead:** Model runs, stages, artifacts, approvals, and parent-child lineage explicitly from the start.

### Anti-Pattern 3: Letting the Canvas Become the Only Truth

**What people do:** Store meaningful workflow state only in browser/canvas shape state.
**Why it's wrong:** Browser reloads, worker retries, and auditability all break down.
**Do this instead:** Treat canvas state as a visual projection of backend metadata.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| LLM provider(s) | Tool adapter behind role-aware agent runtime | Keep model choice and permissions centralized |
| Image generation provider(s) | MCP or internal tool boundary with normalized output contract | Persist prompt, provider, seed, and resulting asset metadata |
| Video generation provider(s) | Async tool invocation with polling/callback normalization | Expect long-running jobs and partial failures |
| Object storage | Signed URL / asset service abstraction | Keep storage paths and lifecycle rules out of UI code |
| Queue / broker | Stage scheduling, retries, delayed recovery | Use explicit idempotency keys for stage jobs |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Frontend ↔ API | HTTP + WebSocket/SSE | UI should read canonical status from backend |
| API ↔ LangGraph runtime | Direct application service call | FastAPI remains the shell; routes stay thin |
| LangGraph runtime ↔ Checkpointer | Persistent checkpoint reads/writes | Required for resume, review, and thread continuity |
| LangGraph runtime ↔ Workers | Queue / job dispatch | Heavy media jobs should stay outside the graph execution loop |
| Graph nodes ↔ Tools | MCP or internal tool invocation | Tool permissions, side effects, and auditing belong here |
| Metadata ↔ Asset storage | Repository/service layer | Metadata and binary storage lifecycles must remain linked |

## Sources

- LangGraph official docs and examples for workflows, persistence, interrupts, subgraphs, and streaming
- Model Context Protocol Python SDK docs and examples
- tldraw official docs, workflow starter kit, and image-pipeline starter kit
- Existing openOii repo structure and capability signals gathered during initialization

---
*Architecture research for: AI-agent comic-drama generation platform*
*Researched: 2026-04-11*

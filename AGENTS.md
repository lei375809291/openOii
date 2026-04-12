<!-- GSD:project-start source:PROJECT.md -->
## Project

**openOii**

openOii is an AI Agent-based creative platform for independent creators that turns a raw story idea into a finished comic-drama video through a coordinated workflow spanning story setup, direction, script generation, character design, storyboard generation, clip generation, review, and final assembly.

This initialization does **not** treat the current repository as the final product contract. The repo is a strong reference implementation, but the project is being re-scoped around a clearer v1 goal: a reliable, guided, end-to-end “idea to final video” loop.

**Core Value:** An independent creator can go from a raw story idea to a coherent final video in one guided, resumable workflow.

### Constraints

- **Tech Stack**: Existing repo uses FastAPI on the backend and React + TypeScript on the frontend — planning should prefer evolution over unnecessary rewrite because meaningful implementation already exists.
- **Audience**: Primary target user is an independent creator — because the user explicitly selected solo-creator focus for v1.
- **Value Proof**: v1 must prove idea-to-final-video closure — because the user explicitly selected this as the main success objective.
- **Operational Shape**: The product includes long-running generation and media assembly steps — architecture and roadmap must account for resumability, progress reporting, and recovery.
- **Workflow Preferences**: Planning runs in interactive mode with standard granularity, parallel execution, research, plan-check, and verifier enabled — because the user explicitly chose a higher-confidence planning workflow.
- **Planning Persistence**: `.planning/` should be tracked in git — because the user chose to keep planning documents versioned.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Application Framework
| Technology | Version | Purpose | Why | Keep/Change |
|------------|---------|---------|-----|-------------|
| **FastAPI** | ≥ 0.128 | REST + WebSocket API | Confirmed by Context7 as latest stable (0.128.0, updated 2026-04-03). Pydantic v2 only from 0.126+. `fastapi[standard]` extra bundles CLI, docs, email. Current repo at ≥0.115 — **must upgrade**. | **Upgrade** (0.115 → 0.128) |
| **Uvicorn** | ≥ 0.34 (standard) | ASGI server | Already in `uvicorn[standard]` — includes uvloop, httptools, watchfiles. Solid. | **Keep** |
| **Pydantic** | ≥ 2.10 | Validation + Settings | FastAPI 0.126+ drops Pydantic v1 support. Already using pydantic-settings ≥2.2 — good. | **Keep** |
| **SQLModel** | ≥ 0.0.31 | ORM layer | Same maintainer as FastAPI (tiangolo). Combines SQLAlchemy 2.0 + Pydantic. Context7 confirms active maintenance (last update 2026-01-12). However, **SQLModel is opinionated** — it forces Pydantic models as table definitions. For a complex domain like comic-drama with rich relationships, SQLAlchemy Core + 2.0 ORM directly gives more flexibility. | **Consider replacing** with SQLAlchemy 2.0 ORM directly for phases beyond MVP |
### Database
| Technology | Version | Purpose | Why | Keep/Change |
|------------|---------|---------|-----|-------------|
| **PostgreSQL** | 16+ | Primary relational store | Already in docker-compose. Async via `asyncpg`. JSONB columns for flexible agent output storage. Add **Alembic** for migrations (currently missing — critical gap). | **Keep** + add Alembic |
| **Alembic** | ≥ 1.14 | Database migrations | Context7 confirms active (2026-03-29). **Required** — current repo has no migration tooling. Every schema change is a risk without it. | **Add** |
| **SQLite (aiosqlite)** | — | Test database only | Current repo uses aiosqlite for tests — correct pattern. Keep. | **Keep** |
### Cache / Message Broker
| Technology | Version | Purpose | Why | Keep/Change |
|------------|---------|---------|-----|-------------|
| **Redis** | 7+ | Signal sharing + job queue | Already deployed. Used for confirm signals between processes. Extend to ARQ job queue (see Queue/Worker section). | **Keep** + extend usage |
### Agent Orchestration
| Technology | Version | Purpose | Why | Keep/Change |
|------------|---------|---------|-----|-------------|
| **LangGraph** | 1.0+ | Primary workflow orchestration | User explicitly chose full LangGraph migration for v1. LangGraph provides the capabilities this product now wants as first-class concerns: durable execution, graph state, conditional routing, fan-out, interrupt/resume, persistence, and state history. | **Adopt as primary orchestration layer** |
| **PostgresSaver / persistent checkpointer** | Production-grade with PostgreSQL | Durable graph checkpoints and resume | LangGraph persistence is not optional for this product shape. Resume, review gates, and long-running creative runs require durable checkpoints tied to real `thread_id` values. | **Add** |
| **Anthropic SDK** | ≥ 0.55 | Model provider client | Claude remains a model/provider option, but no longer defines the orchestration framework. Upgrade to current SDK level for model support and API stability. | **Upgrade** |
- **Claude Agent SDK as the primary orchestration layer** — conflicts with the explicit LangGraph-first v1 decision and duplicates capabilities LangGraph should own (state, routing, interrupts, durable execution).
- **CrewAI** — higher-level abstraction, less control over graph state, persistence, and explicit workflow contracts.
- **AutoGen** — conversation-centric and heavy for a directed creative pipeline.
### Queue / Worker Strategy
| Technology | Version | Purpose | Why | Keep/Change |
|------------|---------|---------|-----|-------------|
| **ARQ** | 0.27 | Async job queue (Redis-backed) | LangGraph should orchestrate workflow state, not replace background execution for expensive media jobs. ARQ remains the recommended execution layer for video/image work triggered by graph nodes. | **Add** |
| **Redis** | 7+ | ARQ backend | Already deployed — reuse existing Redis for both signals and job queue (different DB index). | **Keep** |
- **Celery** — synchronous worker model, heavier dependency chain (Kombu, Billiard), doesn't play well with async FastAPI. You'd need to run Celery workers in separate processes with sync drivers. ARQ is the async-native alternative.
- **TaskIQ** — newer, supports both sync and async, but smaller ecosystem and less battle-tested than ARQ for Redis-backed queues.
- **RQ** — synchronous predecessor to ARQ. No reason to use it in 2026 for an async codebase.
### Storage / Media
| Technology | Version | Purpose | Why | Keep/Change |
|------------|---------|---------|-----|-------------|
| **Local filesystem (`/static`)** | — | MVP media storage | Current approach — images and videos saved to `app/static/`. Fine for single-node MVP. | **Keep for v1**, plan upgrade |
| **S3-compatible (MinIO / Cloudflare R2 / AWS S3)** | — | Production media storage | **Required for multi-node or cloud deployment.** Use `aiobotocore` or `boto3` with async wrappers. MinIO for self-hosted, R2 for zero-egress-cost cloud. | **Add for v2** |
| **Pillow** | ≥ 10.0 | Image manipulation | Already included. Used for image composition (character + storyboard reference stitching). | **Keep** |
| **FFmpeg** | 6+ (system) | Video merging + processing | Required system dependency. Current repo has `video_merger.py` using subprocess calls. Add proper FFmpeg wrapper. | **Keep** (ensure v6+) |
### Media Processing Pipeline
| Technology | Version | Purpose | Why | Keep/Change |
|------------|---------|---------|-----|-------------|
| **FFmpeg (subprocess)** | 6+ | Video stitching, format conversion | Current approach via subprocess — correct for FFmpeg. Wrap in a service layer with proper error handling and progress reporting. | **Keep** |
| **MoviePy** | ≥ 2.1 | **Optional** — programmatic video editing | Context7 confirms active (2025-10-18). Python-native video editing with timeline compositing. Useful for adding transitions, text overlays, and audio tracks between scenes. **Only add if** you need more than simple concatenation (e.g., crossfades, title cards, background music). | **Optional v2** — evaluate based on creator feature requests |
### Realtime Updates
| Technology | Version | Purpose | Why | Keep/Change |
|------------|---------|---------|-----|-------------|
| **WebSocket (native FastAPI)** | — | Real-time progress streaming | Current approach — `ws/projects/{project_id}` endpoint pushes agent progress. Works but is **single-server only** — doesn't scale horizontally. | **Keep for v1**, plan upgrade |
| **Server-Sent Events (SSE)** | — | **Alternative/complement** to WebSocket | SSE is simpler for one-way server→client streaming (progress updates). Better for firewall traversal and HTTP/2 multiplexing. Consider SSE for progress streaming, WebSocket only if bidirectional is needed. | **Consider for v2** |
| **Redis Pub/Sub** | 7+ | Multi-worker event distribution | When ARQ workers generate progress events, they publish to Redis channels. The WebSocket handler subscribes and forwards to clients. **Required for horizontal scaling.** | **Add** |
### Canvas / Editor Layer
| Technology | Version | Purpose | Why | Keep/Change |
|------------|---------|---------|-----|-------------|
| **tldraw** | ^4.3 | Infinite canvas for comic-drama layout | Current repo uses tldraw v4.3. Context7 confirms tldraw v4.2.0 is latest (2026-03-25), so v4.3 may be ahead or a typo — verify. tldraw provides custom shapes, collaboration hooks (`useSync`), and a rich editing experience. The SDK supports custom shape types — perfect for storyboard cards, character cards, and script blocks as canvas objects. | **Keep** — verify version resolves correctly |
| **tldraw sync** | — | Real-time canvas collaboration | tldraw's `@tldraw/sync` package provides multiplayer collaboration. Current repo appears to use it in local-only mode. Enable for team projects. | **Enable** for team features |
- **Excalidraw** — excellent for sketches, but tldraw's programmatic shape API and React integration are stronger for a structured comic-drama editor.
- **Fabric.js / Konva** — lower-level canvas libraries. You'd rebuild tldraw's features from scratch.
### Frontend Framework
| Technology | Version | Purpose | Why | Keep/Change |
|------------|---------|---------|-----|-------------|
| **React** | 18.3 → **19** | UI framework | React 19 is stable (2024-12-05). Key features: Actions (auto pending/error/optimistic state), `useActionState`, `useOptimistic`, `use()` for promise reading, `<form>` Actions, ref as prop. For an app with heavy form interactions (project creation, feedback, configuration), React 19 Actions significantly reduce boilerplate. | **Upgrade** (18.3 → 19) |
| **TypeScript** | 5.7+ | Type safety | Current ≥5.7.2 — good. | **Keep** |
| **Vite** | 6+ | Build tool | Current ≥6.0.0 — good. | **Keep** |
| **React Router** | 7.1+ | Routing | Current ≥7.1.0 — v7 is stable. | **Keep** |
| **Zustand** | 5.0+ | Global state | Current ≥5.0.2 — lightweight, perfect for creator-focused apps. No need for Redux. | **Keep** |
| **TanStack Query** | 5.62+ | Server state management | Current ≥5.62.0 — excellent for API data caching, background refetching, and optimistic updates. Pairs well with React 19 Actions. | **Keep** |
### Styling
| Technology | Version | Purpose | Why | Keep/Change |
|------------|---------|---------|-----|-------------|
| **Tailwind CSS** | 3.4 → **4.2** | Utility-first CSS | Current repo uses v3.4.17 with `tailwind.config.ts` + `postcss.config.js`. **Tailwind v4** uses `@tailwindcss/vite` as a Vite plugin and `@import "tailwindcss"` in CSS — no more PostCSS config, no more `tailwind.config.js`. CSS-first configuration with `@theme` blocks. Faster builds, simpler setup. | **Upgrade** (3.4 → 4.2) |
| **DaisyUI** | 4.12 → **5.0+** | Component primitives | Current ≥4.12.14. DaisyUI 5 is Tailwind v4 compatible. Verify compatibility before upgrading Tailwind — if DaisyUI 5 is not yet stable, keep DaisyUI 4 and Tailwind 3 together, then upgrade both. | **Upgrade** (with Tailwind v4) |
- **shadcn/ui** — excellent component library, but adds Radix UI + more dependencies. For a creator-focused app where visual identity matters more than standard components, Tailwind + DaisyUI gives faster iteration with less opinionated defaults. Consider shadcn/ui for admin/internal tooling pages only.
- **Chakra / MUI** — too heavy, too opinionated. You'll fight the design system to create a unique creator experience.
### Testing
| Technology | Version | Purpose | Why | Keep/Change |
|------------|---------|---------|-----|-------------|
| **pytest** | ≥ 8.0 | Backend unit tests | Already configured. | **Keep** |
| **pytest-asyncio** | ≥ 0.24 | Async test support | Already configured. | **Keep** |
| **Vitest** | ≥ 4.0 | Frontend unit tests | Current ≥4.0.17 — good. | **Keep** |
| **Playwright** | ≥ 1.57 | E2E testing | Current ≥1.57.0 — good. | **Keep** |
| **Testing Library** | ≥ 16 | Component tests | `@testing-library/react` ≥16.3.2 — good. | **Keep** |
| **MSW** | ≥ 2.12 | API mocking | Current ≥2.12.7 — excellent for mocking LLM/image/video API responses in tests. | **Keep** |
| **Promptfoo** | — | **Add** — LLM prompt testing | Still valuable for evaluating prompt quality around graph nodes and approval boundaries. | **Add** |
### Deployment
| Technology | Version | Purpose | Why | Keep/Change |
|------------|---------|---------|-----|-------------|
| **Docker + Docker Compose** | — | Containerization | Current setup with separate backend/frontend images, PostgreSQL, Redis. Well-structured. | **Keep** |
| **Nginx** | — | Reverse proxy | Currently missing — add Nginx as a reverse proxy in front of both frontend and backend for production. Handles TLS, gzip, static file serving, and rate limiting. | **Add** |
| **GitHub Actions** | — | CI/CD | Partial `.github/` directory exists. Complete with: lint, test, build, push to GHCR, deploy. | **Complete** |
### Observability
| Technology | Version | Purpose | Why | Keep/Change |
|------------|---------|---------|-----|-------------|
| **Structlog** | ≥ 24.1 | Structured logging | **Add** — current repo uses basic logging. Structured JSON logs enable querying, alerting, and correlation with agent traces. | **Add** |
| **OpenTelemetry (OTEL)** | — | Distributed tracing | **Add** — trace requests from frontend → FastAPI → ARQ worker → LLM API → image/video API. Critical for debugging slow agent runs. Use `opentelemetry-distro` + `opentelemetry-exporter-otlp`. | **Add** |
| **Prometheus + Grafana** | — | Metrics + dashboards | **Add for production** — track queue depth, agent run duration, API latency, error rates. Use `prometheus-fastapi-instrumentator` for automatic FastAPI metrics. | **Add for v2** |
| **Sentry** | — | Error tracking | **Add** — capture frontend and backend errors with stack traces, user context, and release tracking. Essential for a creator-facing product. | **Add** |
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| ORM | SQLModel (v1) → SQLAlchemy 2.0 (v2) | Prisma (Python) | Not mature for Python ecosystem |
| Queue | ARQ | Celery | Sync worker model, doesn't fit async FastAPI |
| Queue | ARQ | TaskIQ | Smaller ecosystem, less battle-tested |
| Orchestration | LangGraph | Claude Agent SDK | User chose LangGraph-first v1; LangGraph better matches durability and HITL requirements |
| Orchestration | LangGraph | CrewAI | Less explicit state, routing, and persistence control |
| Styling | Tailwind v4 + DaisyUI | shadcn/ui | Too opinionated for unique creator UX |
| Canvas | tldraw | Excalidraw | Weaker programmatic shape API |
| Media storage | Local → S3 (v2) | IPFS | Not needed for private creator content |
| Frontend | React 19 (SPA) | Next.js 15 | No SSR/SEO needs for a creator dashboard app |
## Installation
# Backend — core (use uv, never pip)
# Backend — add new dependencies
# LangGraph persistence (production)
# Backend — LLM evaluation (dev)
# Backend — upgrade existing
# Frontend — upgrade React + Tailwind
# Frontend — remove deprecated postcss config (Tailwind v4 uses Vite plugin)
# Delete postcss.config.js after migration
## Version Summary Table
| Component | Current | Target | Action |
|-----------|---------|--------|--------|
| FastAPI | ≥ 0.115 | ≥ 0.128 | **Upgrade** |
| Anthropic SDK | ≥ 0.40 | ≥ 0.55 | **Upgrade** |
| React | ^18.3 | ^19 | **Upgrade** |
| Tailwind CSS | ^3.4 | ^4.2 | **Upgrade** |
| DaisyUI | ^4.12 | ^5.0 | **Upgrade** (verify compat) |
| TypeScript | ^5.7 | ^5.7 | Keep |
| tldraw | ^4.3 | ^4.3 (verify) | Keep (verify resolves) |
| Zustand | ^5.0 | ^5.0 | Keep |
| TanStack Query | ^5.62 | ^5.62 | Keep |
| PostgreSQL | 16 | 16+ | Keep |
| Redis | 7 | 7+ | Keep |
| Python | 3.10+ | 3.12+ | **Upgrade** (3.12 has better async perf) |
| LangGraph | — | 1.0+ | **Add** |
| LangGraph Postgres Checkpointer | — | latest | **Add** |
| ARQ | — | 0.27 | **Add** |
| Alembic | — | ≥ 1.14 | **Add** |
| Structlog | — | ≥ 24.1 | **Add** |
| OpenTelemetry | — | latest | **Add** |
| Promptfoo | — | latest | **Add** (dev) |
## Sources
- **FastAPI**: Context7 (`/fastapi/fastapi`, versions 0.115–0.128, last update 2026-04-03)
- **tldraw**: Context7 (`/tldraw/tldraw`, versions v3.15.5/v4.2.0, last update 2026-03-25)
- **LangGraph**: Context7 (`/langchain-ai/langgraph`, versions up to 1.0.8, last update 2026-04-06)
- **LangGraph migration patterns**: official LangGraph docs + OSS examples summarized in follow-up research (durable execution, persistence, interrupts, subgraphs, streaming)
- **SQLModel**: Context7 (`/websites/sqlmodel_tiangolo`, last update 2026-01-12)
- **SQLAlchemy**: Context7 (`/websites/sqlalchemy_en_20`, last update 2026-03-23)
- **Alembic**: Context7 (`/sqlalchemy/alembic`, last update 2026-03-29)
- **ARQ**: Context7 (`/python-arq/arq`, v0.26.3) + PyPI (v0.27.0)
- **MoviePy**: Context7 (`/websites/zulko_github_io_moviepy`, last update 2025-10-18)
- **Promptfoo**: Context7 (`/promptfoo/promptfoo`, last update 2026-03-25)
- **Tailwind CSS v4**: Official docs (tailwindcss.com, v4.2)
- **React 19**: Official blog (react.dev, 2024-12-05 stable release)
- **Repo analysis**: Direct read of `pyproject.toml`, `package.json`, `docker-compose.yml`, `README.md`, source structure
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

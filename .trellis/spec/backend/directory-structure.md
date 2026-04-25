# Directory Structure

> How backend code is organized in `backend/app/`.

---

## Overview

The backend is a FastAPI + SQLModel + LangGraph application. It follows a layered structure:

- **API layer** — thin HTTP/WS endpoints; only build runs and forward control signals.
- **Schemas layer** — Pydantic request/response models.
- **Models layer** — SQLModel ORM tables (single source of truth for DB schema).
- **Services layer** — pure business logic, no HTTP concerns.
- **Orchestration layer** — LangGraph state machine, persistence, runtime.
- **Agents layer** — LLM agent implementations (orchestrator, scriptwriter, etc.).
- **Tools layer** — Claude Agent SDK tools (MCP-style).
- **WS layer** — WebSocket connection manager.

Application entry: `backend/app/main.py` (`create_app()`).

---

## Directory Layout

```
backend/app/
├── main.py                  # FastAPI factory + lifespan + global handlers + /ws route
├── config.py                # Settings (pydantic-settings) + get_settings()
├── exceptions.py            # AppException hierarchy (mapped in main.py)
│
├── api/
│   ├── deps.py              # Shared deps: SessionDep, SettingsDep, AdminDep, WsManagerDep
│   └── v1/
│       ├── router.py        # Aggregates all routers under /api/v1
│       └── routes/          # One file per resource: projects, characters, shots, generation, text, config
│
├── schemas/                 # Pydantic models for HTTP I/O (project, text, config, ws)
│
├── models/                  # SQLModel tables (project, agent_run, message, run, stage, artifact, config_item)
│
├── services/                # Business logic (provider_resolution, generation_entry, run_recovery, ...)
│
├── orchestration/           # LangGraph: state.py, graph.py, nodes.py, runtime.py, persistence.py
│
├── agents/                  # LLM agents: orchestrator.py, scriptwriter.py, director.py, ..., base.py, prompts/
│
├── tools/                   # Claude Agent SDK tools (e.g., media_tools.py)
│
├── ws/                      # WebSocket manager
│
├── db/                      # session.py (engine, async_session_maker, init_db, get_session)
│
└── static/                  # Generated media output (videos/, images/), mounted at /static
```

Tests mirror the same layout under `backend/tests/`:

```
backend/tests/
├── conftest.py
├── test_api/                # mirrors app/api/v1/routes/
├── test_orchestration/      # mirrors app/orchestration/
├── test_services/           # mirrors app/services/
├── test_agents/             # mirrors app/agents/
├── test_migrations.py
└── integration/             # cross-layer integration tests
```

Alembic migrations live in `backend/alembic/versions/` (note: `alembic.ini` defaults to local SQLite — set `DATABASE_URL` before running).

---

## Module Organization

### Adding a new HTTP resource

1. Create `app/schemas/<resource>.py` with `*Create`, `*Read`, `*Update` models.
2. Add the SQLModel table in `app/models/<resource>.py` (and import it in `app/db/session.py`'s `init_db` import block so `create_all` picks it up).
3. Create `app/api/v1/routes/<resource>.py` with an `APIRouter()` named `router`.
4. Register it in `app/api/v1/router.py`.
5. Add tests under `backend/tests/test_api/test_<resource>.py`.

### Adding a new service

- Put it in `app/services/<name>.py`.
- Services receive an `AsyncSession` and/or `Settings` — never a `Request`.
- Services raise `AppException` subclasses, never `HTTPException`.
- Services must not import from `app/api/`.

### Adding a new agent

- Subclass the base class in `app/agents/base.py`.
- Prompts live in `app/agents/prompts/` (separate file per agent).
- Wire the agent into the LangGraph state machine in `app/orchestration/`.

### Adding a new orchestration node

- Define the state shape in `app/orchestration/state.py`.
- Add the node function in `app/orchestration/nodes.py`.
- Wire it into the graph in `app/orchestration/graph.py`.
- Persistence/checkpointer setup is in `app/orchestration/persistence.py`.

---

## Naming Conventions

- **Files / modules**: `snake_case.py`. Resource modules use the singular noun (`project.py`, `shot.py`).
- **Classes**: `PascalCase`. SQLModel tables use the bare resource name (`Project`, `Shot`, `AgentRun`).
- **Schemas**: `<Resource><Action>` — `ProjectCreate`, `ProjectRead`, `ProjectUpdate`, `ProjectListRead`, `ProjectBatchDeleteRequest`.
- **Functions**: `snake_case`, async functions are the default for I/O paths.
- **Service entry points**: verb-first (`delete_project_by_id`, `resolve_project_provider_settings_async`, `ensure_postgres_checkpointer_setup`).
- **Test files**: `test_<module>.py`, mirroring the source path.

---

## Examples

- Cleanest API route example: `app/api/v1/routes/projects.py` — uses `SessionDep` / `SettingsDep`, delegates business logic to services, returns Pydantic schemas.
- Cleanest service example: `app/services/project_deletion.py` (delete by id + batch delete, used by routes).
- Cleanest model example: `app/models/project.py` — Project / Character / Shot with cascade relationships and approval-state helpers.
- App lifecycle: `app/main.py` — `create_app()` factory, `lifespan` runs `init_db()`, exception handlers, `/ws/projects/{project_id}` route.
- Settings entry point: `app/config.py` — `Settings` with `model_config = SettingsConfigDict(extra="ignore")`, `get_settings()` lru-cached and reads `.env`.

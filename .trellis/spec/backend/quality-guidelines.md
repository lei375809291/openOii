# Quality Guidelines

> Code standards, formatting, type-checking, and forbidden patterns for the backend.

---

## Tooling

- **Package manager**: `uv` (always — never `pip install`).
- **Linter / formatter**: `ruff` (`uv run ruff check app tests`).
- **Test runner**: `pytest` with `asyncio_mode = "auto"` (`uv run pytest`).
- **Python**: `>=3.10`, `target-version = "py310"`. Use `from __future__ import annotations` for forward refs in pre-3.10-compatible style.

Config lives in `backend/pyproject.toml`:

```toml
[tool.ruff]
line-length = 100
target-version = "py310"

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
pythonpath = ["."]
```

---

## Pre-commit Checklist

Before declaring backend work done, run from `backend/`:

```bash
uv run ruff check app tests
uv run pytest
```

For a focused test run during iteration:

```bash
uv run pytest tests/test_api/test_<module>.py -q
```

If you change dependencies, regenerate the lockfile:

```bash
uv sync
```

The `Dockerfile` runs `uv sync --frozen --no-dev --extra agents`, so `uv.lock` must be in sync with `pyproject.toml`.

---

## Required Patterns

### Type hints everywhere

All public functions, route handlers, and service entry points must be typed. The codebase uses PEP 604 unions (`str | None`, not `Optional[str]`) consistently in new code.

```python
async def get_project(project_id: int, session: AsyncSession = SessionDep) -> ProjectRead:
    ...
```

### Async by default

I/O-bound code is async. Sync helpers exist only for CPU-bound utilities (e.g., path normalization in `services/file_cleaner.py`).

### Explicit imports

- `from app.<module> import <name>` — absolute imports, rooted at `app`.
- No `from app.module import *`.
- Within a model file, import from siblings via `from typing import TYPE_CHECKING` + string forward refs to avoid circular imports.

### Docstrings on public service entry points

Top-level service functions get a one-liner docstring. Routes and trivial helpers don't need one — the route decorator + Pydantic schema already document the contract.

### Settings access via DI

Use `SettingsDep` (from `app.api.deps`) inside routes. Inside `get_settings()`-aware code paths (workers, services), call `get_settings()` directly. **Do not** instantiate `Settings()` at module import time outside of tests.

---

## Forbidden Patterns

| Pattern | Why |
|---|---|
| Bare `except:` | Hides KeyboardInterrupt / SystemExit. Catch specific exceptions. |
| Empty `except Exception: pass` | Silent failure. The only acceptable case is a final-WS-send that we know may fail because the client disconnected. |
| `print(...)` for diagnostics | Use `logger`. `print` ends up in stdout without level / context. |
| `# type: ignore` without a reason | If you must use it, add a comment: `# type: ignore[...]  # reason`. |
| `os.getenv("FOO")` inside business code | Add a field to `Settings` and access via `settings.foo`. |
| Sync HTTP calls in request path (`requests`, blocking `httpx.Client`) | Use `httpx.AsyncClient` or `aiohttp`. |
| Sync DB calls in request path | Async sessions only. |
| Importing `app.api.*` from `app/services/*` | Services must be HTTP-agnostic. |
| Top-level side effects in modules | Modules should only declare; effects belong in `lifespan` / explicit init. |
| Catching exception and re-raising as `HTTPException` from a service | Use `AppException` subclasses; let routes / global handler do HTTP. |
| Hardcoded magic strings repeated in 3+ places | Lift to a constant or enum. |
| Defining local `utcnow()` in any module | Use `from app.db.utils import utcnow` — single canonical source. |

---

## Mocking and Tests

- Tests live in `backend/tests/`, mirroring the source tree.
- Use the fixtures in `backend/tests/conftest.py`:
  - `test_settings` — pure `Settings(...)` instance with sqlite in-memory DB and stub provider keys.
  - `test_session` — ephemeral `AsyncSession` against in-memory sqlite, schema created via `SQLModel.metadata.create_all`.
  - `StubWsManager` — captures events to `self.events` for assertions.
- HTTP assertions use `httpx.AsyncClient` with `ASGITransport(app=...)`.
- Inject test deps by overriding FastAPI deps:

  ```python
  app.dependency_overrides[get_db_session] = lambda: session
  app.dependency_overrides[get_app_settings] = lambda: test_settings
  app.dependency_overrides[get_ws_manager] = lambda: stub_ws
  ```

- For async work, prefer `pytest_asyncio.fixture` over manual event-loop juggling. `asyncio_mode = "auto"` means test functions can be `async def` directly without `@pytest.mark.asyncio`.

---

## Coverage Configuration for Async Tests

**Critical**: ASGITransport runs request handlers in an anyio thread pool where the coverage tracer doesn't follow by default. Without the concurrency config, coverage for route closure paths (`generation.py` `_task()`, background tasks) shows 0% even though tests pass.

Add to `backend/pyproject.toml`:

```toml
[tool.coverage.run]
concurrency = ["thread", "greenlet"]
```

This is required for any test that exercises `httpx.AsyncClient(ASGITransport(app=...))` request paths.

---

## Testing Gotchas

### 1. WebSocket stub must throw `WebSocketDisconnect`, not `RuntimeError`

When writing test stubs for WebSocket `receive_json()`, the stub must throw `WebSocketDisconnect` when messages are exhausted — **not** `RuntimeError` or `StopAsyncIteration`.

**Why**: `app/main.py` WebSocket handler has `except Exception` as a catch-all that re-enters the `while True` loop. Only `WebSocketDisconnect` triggers the clean `break` path. A `RuntimeError` stub causes an infinite loop that consumes 7GB+ memory.

```python
# Wrong — causes infinite loop
async def fake_receive_json():
    if not messages:
        raise RuntimeError("no more messages")

# Correct — clean exit
from starlette.websockets import WebSocketDisconnect
async def fake_receive_json():
    if not messages:
        raise WebSocketDisconnect(code=1000)
```

### 2. `asyncio.sleep` stubs must return coroutines, not `None`

When monkeypatching `asyncio.sleep`, lambda stubs return `None` which is not awaitable:

```python
# Wrong — TypeError: object NoneType can't be used in 'await' expression
monkeypatch.setattr(asyncio, "sleep", lambda _: None)

# Correct — return an awaitable coroutine
async def immediate_sleep(_):
    pass
monkeypatch.setattr(asyncio, "sleep", immediate_sleep)
```

### 3. Monkeypatch target must be the import location, not the source

When patching functions called by the code under test, patch where they're **imported**, not where they're defined:

```python
# Wrong — patching the source module
monkeypatch.setattr("app.services.llm.probe_text_provider", fake_probe)

# Correct — patching where orchestrator.py actually imports it
monkeypatch.setattr("app.agents.orchestrator.probe_text_provider", fake_probe)
```

### 4. `AgentMessage` lives in `app.models.agent_run`, not `app.models.message`

The `AgentMessage` SQLModel is co-located with `AgentRun` in `app/models/agent_run.py`. Don't import from `app.models.message` — that module doesn't exist.

```python
# Wrong
from app.models.message import AgentMessage

# Correct
from app.models.agent_run import AgentMessage
```

### 5. `FakeSession` with multiple query results

When a test needs `session.execute()` to return different results for different queries, use a `scalars_result` parameter:

```python
class FakeSession:
    def __init__(self, ..., scalars_result=None):
        self.scalars_result = scalars_result

    async def execute(self, statement):
        return FakeResult(rows=self.scalars_result or self.rows)
```

This is needed for orchestrator tests where `_wait_for_confirm` queries `AgentMessage` after the main `Project`/`AgentRun` lookups.

---

## Refactoring Discipline

Bug fixes and feature work should be **surgical**:

- Touch only the files needed for the change.
- Don't rewrite unrelated comments / formatting / variable names.
- Don't introduce a new abstraction layer "for future flexibility" without a concrete second use case in this PR.
- Cleanups go in their own commit / PR (`chore:` or `refactor:`), not riding on a feature.

If you spot dead code, leave a `# TODO(<name>): unused, candidate for removal` rather than deleting in the same change.

---

## Common Mistakes

1. **Forgetting `# noqa: F401` after adding a new SQLModel** — breaks `init_db()` because the model isn't registered before `create_all`.
2. **Comparing tz-aware vs tz-naive datetimes** in queries. Use `from app.db.utils import utcnow` — never define a local `utcnow()`.
3. **Reading `.env` from a test by instantiating `Settings()`**. The `Settings` class is configured _not_ to auto-read `.env`; only `get_settings()` does. Tests should pass values explicitly.
4. **Importing models inside `app/db/session.py:init_db` lazily and not adding the top-level `noqa` import** — schema misses tables.
5. **Calling `await session.commit()` inside a service that the caller already commits**. Pick one layer to own the transaction; for routes the caller (route) owns it; for `delete_project_by_id` the service owns it because it does multi-step cascade.

---

## Examples

- Clean route module: `app/api/v1/routes/projects.py`.
- Clean service module: `app/services/project_deletion.py`.
- Test module shape: `backend/tests/test_api/test_projects.py` (look for fixture overrides).
- Conftest patterns: `backend/tests/conftest.py`.

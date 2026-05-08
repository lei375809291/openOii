# WS Event Contracts

> Executable contracts for WebSocket event schema alignment between backend and frontend.

---

## 1. Scope / Trigger

- Any change to a WS event payload (new field, removed field, type change)
- Any new WS event type
- Any change to `_EVENT_DATA_MODELS` or `WsEventType` in `app/schemas/ws.py`
- Any new `send_event` call in orchestrator/agents

---

## 2. Architecture

### Cast Pipeline

```
orchestrator/agent calls send_event(project_id, dict)
  → ConnectionManager.send_event()
    → WsEvent.model_validate(dict)          # strips unknown top-level keys
    → if event_type in _EVENT_DATA_MODELS:
        data_model.model_validate(event.data)  # strips unknown data fields
        event.data = data_model.model_dump(mode="json")
    → broadcast to connected clients
```

**Key behavior**: Pydantic `model_validate` with default config (`extra="ignore"`) **silently drops** fields not defined in the model. This means:

- If orchestrator sends `{"project_id": 1, "stage": "plan", "run_id": 5}` but `RunStartedEventData` only defines `run_id`, then `project_id` and `stage` are **silently dropped** before reaching the frontend.
- If an event type is NOT in `_EVENT_DATA_MODELS`, the raw dict passes through **unvalidated** — all fields survive.

### Three-Way Contract

| Layer | File | Responsibility |
|-------|------|----------------|
| **Producer** | `orchestrator.py`, `base.py`, `nodes.py` | Sends dict with correct fields |
| **Schema** | `app/schemas/ws.py` `_EVENT_DATA_MODELS` | Validates/strips fields |
| **Consumer** | `frontend/app/hooks/useWebSocket.ts` `applyWsEvent` | Reads `event.data` fields |

**All three must agree on field names and types.** A mismatch at any layer causes silent data loss.

---

## 3. Signatures

### Backend Schema (Pydantic)

```python
# app/schemas/ws.py
WsEventType = Literal["run_started", "run_progress", ...]

_EVENT_DATA_MODELS: dict[str, type[BaseModel]] = {
    "run_started": RunStartedEventData,
    "run_progress": RunProgressEventData,
    "run_message": RunMessageEventData,
    "run_completed": RunCompletedEventData,
    ...
}
```

### Frontend Types (TypeScript)

```typescript
// frontend/app/types/index.ts
export interface RunProgressEventData {
    run_id: number;
    project_id?: number;
    current_agent?: string | null;
    // ... must match Pydantic fields exactly
}
```

---

## 4. Contracts

### Adding a New Field to an Existing Event

**Steps (order matters):**

1. Add field to Pydantic model in `app/schemas/ws.py` (with default for backward compat)
2. Add field to orchestrator/agent `send_event` call
3. Add field to frontend TypeScript interface in `frontend/app/types/index.ts`
4. Use field in frontend `applyWsEvent` handler

**Wrong**: Adding to orchestrator without updating schema → field silently dropped.
**Wrong**: Adding to schema without adding to orchestrator → field always None/default.

### Adding a New Event Type

**Steps:**

1. Add to `WsEventType` Literal in `app/schemas/ws.py`
2. Create Pydantic data model
3. Register in `_EVENT_DATA_MODELS` dict
4. Add to frontend `WsEventType` union in `types/index.ts`
5. Add `case` in frontend `applyWsEvent` handler
6. Send from orchestrator/agent

---

## 5. Validation & Error Matrix

| Scenario | Result | Detection |
|----------|--------|-----------|
| Orchestrator sends field not in Pydantic model | Field silently dropped | Cast output ≠ input |
| Pydantic model has field orchestrator never sends | Field always None/default | Frontend reads undefined |
| Event type not in `_EVENT_DATA_MODELS` | Raw dict passes through unvalidated | All fields survive (may have wrong types) |
| Event type not in frontend `WsEventType` | TypeScript compile error | `tsc --noEmit` |
| Frontend reads field that was dropped by cast | `undefined` at runtime | No error, silent wrong behavior |

---

## 6. Good / Bad Cases

### Good: Adding `project_id` to `RunStartedEventData`

```python
# Schema
class RunStartedEventData(BaseModel):
    run_id: int
    project_id: int | None = None  # ← add with default
    ...

# Orchestrator
await self.ws.send_event(project_id, {
    "type": "run_started",
    "data": {"run_id": run_id, "project_id": project_id, ...}
})

# Frontend
export interface RunStartedEventData {
    run_id: number;
    project_id?: number;  // ← add optional
    ...
}
```

### Bad: Adding field only to orchestrator

```python
# Orchestrator sends it
{"type": "run_started", "data": {"run_id": 1, "project_id": 1}}

# But schema doesn't have it → silently dropped
class RunStartedEventData(BaseModel):
    run_id: int
    # project_id missing!

# Frontend reads it → always undefined
event.data.project_id  // undefined
```

---

## 7. Tests Required

### Schema Roundtrip Test

```python
def test_run_started_event_data_preserves_all_fields():
    data = {"run_id": 1, "project_id": 5, "stage": "plan", "current_agent": "plan"}
    result = RunStartedEventData.model_validate(data)
    dumped = result.model_dump(mode="json")
    assert dumped["project_id"] == 5
    assert dumped["stage"] == "plan"
```

### Cast Pipeline Test

```python
def test_cast_event_data_preserves_registered_fields():
    event = {"type": "run_started", "data": {"run_id": 1, "project_id": 5}}
    cast = _cast_event_data(event)
    assert cast["data"]["project_id"] == 5
```

---

## 8. Wrong vs Correct

### Wrong: Assuming extra fields survive cast

```python
# Developer adds "metadata" to event data
await ws.send_event(pid, {"type": "run_completed", "data": {
    "run_id": 1, "metadata": {"key": "value"}
}})
# RunCompletedEventData doesn't have "metadata"
# → silently dropped, frontend never sees it
```

### Correct: Add to schema first

```python
class RunCompletedEventData(BaseModel):
    run_id: int | None = None
    metadata: dict[str, Any] | None = None  # ← add here first
```

---

## Anti-Patterns

### Don't: Send fields without schema registration

```python
# Don't add fields to send_event without updating the Pydantic model
await ws.send_event(pid, {"type": "run_started", "data": {"new_field": "value"}})
# If RunStartedEventData doesn't have new_field → silently lost
```

### Don't: Use `event.data` as raw dict without type narrowing

```typescript
// Don't cast blindly
const data = event.data as any;  // no type safety

// Do use typed interface
const data = event.data as RunStartedEventData;
```

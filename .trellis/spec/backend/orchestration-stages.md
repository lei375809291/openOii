# Orchestration Sub-Stage Architecture

> Contracts for the LangGraph-based Phase2 pipeline with per-sub-stage approval gates.

---

## 1. Scope / Trigger

- Any change to the orchestration graph structure (adding/removing nodes, edges)
- Any change to agent sub-step methods (`run_characters`, `run_shots`, etc.)
- Any change to approval gate logic
- Any change to `PHASE2_STAGE_ORDER` or `AGENT_TO_STAGE`

---

## 2. Architecture

### Graph Topology

```
plan_characters → characters_approval → plan_shots → shots_approval
  → render_characters → character_images_approval → render_shots → shot_images_approval
  → compose_videos → compose_merge → compose_approval → END

         ↓ (any approval with feedback)
      review → routes back to production stage
```

### Stage Categories

| Category       | Stages                                                                                                           | Behavior                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Production** | `plan_characters`, `plan_shots`, `render_characters`, `render_shots`, `compose_videos`, `compose_merge`          | Runs agent sub-method                           |
| **Approval**   | `characters_approval`, `shots_approval`, `character_images_approval`, `shot_images_approval`, `compose_approval` | Interrupts for user confirmation                |
| **Review**     | `review`                                                                                                         | Routes feedback to appropriate production stage |

### Key Mappings

```python
# app/services/run_recovery.py
PHASE2_STAGE_ORDER = (
    "plan_characters", "characters_approval",
    "plan_shots", "shots_approval",
    "render_characters", "character_images_approval",
    "render_shots", "shot_images_approval",
    "compose_videos", "compose_merge", "compose_approval",
    "review",
)

AGENT_TO_STAGE = {
    "plan": "plan_characters",
    "render": "render_characters",
    "compose": "compose_videos",
    "review": "review",
}

# app/agents/orchestrator.py
GRAPH_STAGE_FOR_AGENT = {
    "plan": "plan_characters",
    "render": "render_characters",
    "compose": "compose_videos",
    "review": "review",
}
```

---

## 3. Signatures

### Agent Sub-Step Methods

```python
# PlanAgent
async def run_characters(self, ctx: AgentContext) -> None: ...
async def run_shots(self, ctx: AgentContext) -> None: ...

# RenderAgent
async def run_characters(self, ctx: AgentContext) -> None: ...
async def run_shots(self, ctx: AgentContext) -> None: ...

# ComposeAgent
async def run_videos(self, ctx: AgentContext) -> int: ...  # returns video count
async def run_merge(self, ctx: AgentContext) -> None: ...
```

### Graph Node Function Signature

```python
async def plan_characters_node(
    state: Phase2State,
    runtime: Runtime[Phase2RuntimeContext],
) -> dict[str, Any]: ...
```

### Approval Node Signature

```python
async def characters_approval_node(
    state: Phase2State,
    runtime: Runtime[Phase2RuntimeContext],
) -> dict[str, Any]: ...
```

---

## 4. Contracts

### `_resolve_base_stage` — Maps any stage to its production stage

```python
def _resolve_base_stage(stage: str) -> str | None:
    """Maps production stages (identity) and approval gates to their production stage."""
    if stage in PRODUCTION_STAGE_SEQUENCE:
        return stage
    return _APPROVAL_TO_PRODUCED_STAGE.get(stage)
```

**Mapping**:

- `"plan_characters"` → `"plan_characters"` (identity)
- `"characters_approval"` → `"plan_characters"` (via `_APPROVAL_TO_PRODUCED_STAGE`)
- `"shot_images_approval"` → `"render_shots"`
- `"compose_approval"` → `"compose_merge"`

### `_run_sub_stage` — Generic production node runner

```python
async def _run_sub_stage(state, runtime, *, stage: str, method_name: str) -> dict:
    # 1. Check video provider validity (compose_videos only)
    # 2. Check artifact_lineage for skip
    # 3. Emit run_progress event
    # 4. Call agent.method_name(ctx)
    # 5. Return state update with artifact_lineage
```

### `_manual_approval_node` — Generic approval gate

```python
async def _manual_approval_node(runtime, *, approval_stage, history_key, gate, message, next_stage) -> dict:
    # 1. If auto_mode → return auto_approval_result
    # 2. Else → interrupt() and wait for user
    # 3. Return approval_result with route_stage
```

### Agent Context Data Caching

```python
# Plan agent caches LLM response for sub-step consumption
ctx.plan_data: dict | None = None  # Set by run_characters(), read by run_shots()
```

---

## 5. Validation & Error Matrix

| Scenario                                     | Result                                         |
| -------------------------------------------- | ---------------------------------------------- |
| `run_shots()` called without `ctx.plan_data` | `RuntimeError` raised                          |
| Video provider invalid at `compose_videos`   | Node skips work, adds to `artifact_lineage`    |
| Approval with feedback                       | Routes to `review` node                        |
| Approval without feedback                    | Routes to next production stage                |
| `auto_mode=True`                             | Approval returns immediately without interrupt |
| Stage in `artifact_lineage`                  | Production node skips (already done)           |

---

## 6. Good / Bad Cases

### Good: Adding a new sub-stage

```python
# 1. Add to PRODUCTION_STAGE_SEQUENCE
PRODUCTION_STAGE_SEQUENCE = ("plan_characters", "plan_shots", "new_stage", ...)

# 2. Add to PHASE2_STAGE_ORDER (with approval gate)
PHASE2_STAGE_ORDER = (..., "new_stage", "new_stage_approval", ...)

# 3. Add approval gate mapping
_APPROVAL_TO_PRODUCED_STAGE["new_stage_approval"] = "new_stage"

# 4. Add graph nodes
graph.add_node("new_stage", new_stage_node)
graph.add_node("new_stage_approval", new_stage_approval_node)

# 5. Wire edges
graph.add_edge("new_stage", "new_stage_approval")
graph.add_conditional_edges("new_stage_approval", route_after_new_stage_approval, ...)
```

### Bad: Adding stage without updating all mappings

```python
# Add to PRODUCTION_STAGE_SEQUENCE but forget PHASE2_STAGE_ORDER
# → _stage_index returns 0 for unknown stages
# → _next_stage returns wrong stage
# → recovery summary breaks
```

---

## 7. Tests Required

### Graph Routing Test

```python
async def test_graph_interrupts_at_each_approval(start_stage, expected_agent, expected_gate):
    """Verify graph pauses at approval gate, not mid-agent."""
    result = await compiled.ainvoke(initial_state, config, context=runtime_context)
    interrupts = result.get("__interrupt__") or []
    assert interrupts
    assert interrupts[0].value["gate"] == expected_gate
```

### Skip Logic Test

```python
def test_should_skip_stage_with_lineage():
    state = {"artifact_lineage": ["stage:plan_characters"]}
    assert _should_skip_stage(state, "plan_characters") is True
    assert _should_skip_stage(state, "plan_shots") is False
```

### Stage Resolution Test

```python
def test_resolve_base_stage():
    assert _resolve_base_stage("plan_characters") == "plan_characters"
    assert _resolve_base_stage("characters_approval") == "plan_characters"
    assert _resolve_base_stage("unknown") is None
```

---

## 8. Wrong vs Correct

### Wrong: Using old stage names

```python
# Old (2-gate model)
GRAPH_STAGE_FOR_AGENT = {"plan": "plan", "render": "render"}
PHASE2_STAGE_ORDER = ("plan", "plan_approval", "render", ...)

# New (sub-stage model)
GRAPH_STAGE_FOR_AGENT = {"plan": "plan_characters", "render": "render_characters"}
PHASE2_STAGE_ORDER = ("plan_characters", "characters_approval", "plan_shots", ...)
```

### Correct: Keeping all mappings in sync

When adding/modifying stages, update ALL of:

1. `PRODUCTION_STAGE_SEQUENCE` in `state.py`
2. `PHASE2_STAGE_ORDER` in `run_recovery.py`
3. `AGENT_TO_STAGE` in `run_recovery.py`
4. `GRAPH_STAGE_FOR_AGENT` in `orchestrator.py`
5. `_APPROVAL_TO_PRODUCED_STAGE` in `state.py` and `run_recovery.py`
6. Graph nodes and edges in `graph.py`

---

## Design Decisions

### DD: Sub-stage approval instead of per-item approval

**Context**: User wanted "manual mode confirms every small step."

**Options**:

1. Per-character/per-shot approval (extremely granular, many interrupts)
2. Per-sub-stage approval (one interrupt per agent phase)
3. Per-agent approval (original 2-gate design)

**Decision**: Option 2 — per-sub-stage. Each agent is split into 2-3 logical phases (characters → shots, character images → shot images, videos → merge). Manual mode pauses between phases. Yolo mode skips all pauses.

**Tradeoff**: Less granular than per-item, but avoids interrupt fatigue and keeps the graph manageable.

### DD: `ctx.plan_data` for cross-sub-step data sharing

**Context**: Plan agent's LLM returns both characters and shots in one response, but they're now consumed in separate sub-steps.

**Options**:

1. Call LLM twice (once per sub-step) — wastes tokens, may get inconsistent results
2. Cache response on `AgentContext` — simple, shared mutable state
3. Store in LangGraph state — requires state schema changes

**Decision**: Option 2 — `ctx.plan_data`. Set by `run_characters()`, read by `run_shots()`. Simple and effective since sub-steps always run sequentially within a single agent context.

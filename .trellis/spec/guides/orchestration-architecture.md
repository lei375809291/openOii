# Orchestration Architecture Guide

> **Purpose**: Documents the 3-agent orchestration architecture, stage contracts, and cross-layer data flow.

---

## Architecture Overview

The generation pipeline uses **3 agents** (down from 8) with a **6-stage** LangGraph state machine:

```
plan → plan_approval → render → render_approval → compose → END
                                              ↘ review ↗
```

| Stage | Agent | LLM Call | Purpose |
|-------|-------|----------|---------|
| `plan` | PlanAgent | 1 call | Generates characters + shots (10-field) from story idea |
| `plan_approval` | — | — | Interrupt gate; user confirms plan |
| `render` | RenderAgent | N calls | Generates character ref images + shot keyframes |
| `render_approval` | — | — | Interrupt gate; user confirms visuals |
| `compose` | ComposeAgent | 0 calls | I2V per shot + merge into final video |
| `review` | ReviewRuleEngine | 0 calls | Rule-based feedback routing (deterministic) |

**Key invariant**: `review` is only reachable via user feedback (`/feedback` API), never in the normal forward flow.

---

## Stage Name Contract

Stage names are **shared across 4 files** and must stay in sync:

| File | Purpose |
|------|---------|
| `app/orchestration/state.py` | `Phase2Stage` Literal type + `PRODUCTION_STAGE_SEQUENCE` |
| `app/orchestration/graph.py` | Node names + edge routing |
| `app/agents/orchestrator.py` | `STAGE_AGENT_MAP` (single source; `GRAPH_STAGE_FOR_AGENT`, `AGENT_STAGE_MAP`, `RESUME_AGENT_FOR_STAGE` are aliases) |
| `app/services/run_recovery.py` | `AGENT_TO_STAGE` + `PHASE2_STAGE_ORDER` |

**When adding/removing a stage**: update ALL four files + corresponding test fixtures.

---

## Shot 10-Field Schema

The `Shot` model uses 10 content fields for structured prompts:

| Field | Type | Description |
|-------|------|-------------|
| `description` | `str \| None` | Overall shot description |
| `camera` | `str \| None` | Camera movement/type |
| `duration` | `float \| None` | Planned duration (seconds) |
| `scene` | `str \| None` | Scene/environment setting |
| `action` | `str \| None` | Character action in shot |
| `expression` | `str \| None` | Character facial expression |
| `lighting` | `str \| None` | Lighting description |
| `dialogue` | `str \| None` | Spoken dialogue text |
| `sfx` | `str \| None` | Sound effect notes |
| `motion_note` | `str \| None` | Motion/animation direction |
| `seed` | `int \| None` | RNG seed for style-consistent regeneration |

Each has an `approved_` counterpart set during the approval gate.

**Cross-layer**: `backend/app/models/project.py` → `backend/app/schemas/project.py` → `frontend/app/types/index.ts` + canvas shape types.

---

## Style Locking

`project.style` (set at creation: anime/cinematic/manga/realistic) must be enforced at every generation step:

| Step | Where | How |
|------|-------|-----|
| Plan | `PlanAgent` system prompt | "Style Locking" section forces `visual_bible` + `image_prompt` to match style |
| Render | `RenderAgent._style_descriptor()` | Maps style name → image generation prompt prefix (anime/cinematic/manga/realistic) |
| Compose | (video generation) | Inherits `style` from project context |

**Key invariant**: `RenderAgent._style_descriptor()` must match the style keys in `PlanAgent`'s style mapping (currently 11 styles: anime, shonen, slice-of-life, manga, donghua, cinematic, pixar, lowpoly, watercolor, sketch, realistic).

---

## Progress Update Points

Progress (`run.progress` + `run.current_agent`) is updated at every stage boundary:

| Point | File | Progress Value |
|-------|------|----------------|
| Enter plan | `orchestrator.py:_run_phase2_graph` | `workflow_progress_for_stage("plan")` |
| Enter plan_approval | `nodes.py:_manual_approval_node` | `workflow_progress_for_stage("plan_approval")` |
| Enter render | `orchestrator.py:_run_phase2_graph` | `workflow_progress_for_stage("render")` |
| Enter render_approval | `nodes.py:render_approval_node` | `workflow_progress_for_stage("render_approval")` |
| Enter compose | `orchestrator.py:_run_phase2_graph` | `workflow_progress_for_stage("compose")` |
| Per-shot I2V | `compose.py:_run_i2v_for_shot` | Incremental within compose range |
| Finalize | `orchestrator.py:_run_phase2_graph` | `1.0` |

**run_progress WS event** always includes: `run_id`, `project_id`, `current_agent`, `current_stage`, `stage`, `next_stage`, `progress`.

---

## Thread ID Persistence

`AgentRun.thread_id` (str, nullable) stores the LangGraph checkpointer thread ID at graph build time. This enables:

1. **Resume from recovery**: No need to rebuild `graph_config` — read `thread_id` from DB
2. **Time-travel debugging**: Query checkpointer state by thread_id
3. **Multi-instance safety**: Thread ID survives process restart

**Migration**: `0010_add_thread_id_to_agentrun.py`

---

## Review Routing Rules

`ReviewRuleEngine` in `app/agents/review_rules.py` uses deterministic routing (no LLM):

| Feedback Type | Route To | Mode |
|---------------|----------|------|
| plan/story/script/global | `plan` | `incremental` or `full` |
| render/character/shot/storyboard | `render` | `incremental` or `full` |
| compose/video/merge | `compose` | `incremental` or `full` |
| retry-compose keywords | `compose` | `incremental` |
| unknown | `plan` | `incremental` or `full` |

**Mode decision**: `full` only when feedback contains explicit full-restart keywords ("推倒重来", "从头开始", "完全重新", "全部推翻", "redo all", "restart from scratch", etc.). All other feedback defaults to `incremental`.

**Feedback type flow**: `feedback_type` is passed end-to-end:
1. Frontend `ShapeContextMenu` or canvas card hover buttons map shape sections → `plan/render/compose` (agent-level names)
2. Frontend `ChatPanel` defaults to `"plan"`
3. `POST /api/v1/projects/{id}/feedback` accepts `feedback_type`, `entity_type`, `entity_id` in `FeedbackRequest`
4. `generation.py` route passes all three to `orchestrator.run_from_agent(feedback_type=..., entity_type=..., entity_id=...)`
5. `orchestrator.py` sets `ctx.feedback_type`, `ctx.entity_type`, `ctx.entity_id` before running `ReviewRuleEngine`

**Per-entity feedback**: When `entity_type` + `entity_id` are set, `ReviewRuleEngine` routes feedback to re-generate only that specific entity, not the full stage. Entity type map: `character→render`, `shot→render`, `video→compose`. This avoids "regenerate everything" when only one card is wrong.

**`_FEEDBACK_TYPE_MAP` keys**: Both agent-level (`plan`, `render`, `compose`) and entity-level (`story`, `script`, `character`, `shot`, `storyboard`, `video`, `merge`) are accepted. Frontend sends agent-level; entity-level keys are retained for backward compatibility.

**Good case**: "角色3的眼睛颜色不对" → feedback_type=render, entity_type=character, entity_id=3 → route=render, mode=incremental (per-entity)
**Base case**: "推倒重来" → no specific type → route=plan, mode=full
**Bad case**: LLM review routing (old) — non-deterministic, wasted tokens, sometimes wrong routing

---

## Validation & Error Matrix

| Error | Where | Handling |
|-------|-------|----------|
| Video provider not configured | `nodes.py:_is_video_provider_invalid` | Skip compose, return `video_generation_skipped` |
| Stage already completed (rerun) | `nodes.py:_should_skip_stage` | Return early, advance stage |
| User feedback empty | `ReviewRuleEngine` | Default route to `plan` with "未提供具体反馈", mode=incremental |
| Auto mode | `orchestrator.py:_wait_for_confirm` | Skip all approval gates |
| Run recovery finds stale stage | `run_recovery.py` | Fallback to `plan` stage |

---

## Frontend Stage Sync (M7)

Frontend references 3 pipeline stages matching backend `Phase2Stage`:

| Frontend Constant | Backend Stage | Purpose |
|-------------------|---------------|---------|
| `"plan"` | `plan` | Story → characters + shots |
| `"render"` | `render` | Character images + shot keyframes |
| `"compose"` | `compose` | I2V + video merge |

**Updated files** (M7 migration from 6 → 3 visible stages):
- `app/utils/pipeline.ts` — `PIPELINE_STAGES`, `STAGE_INFO_MAP`, `getWorkflowStageInfo`
- `app/stores/editorStore.ts` — `currentStage` default, `preserved_stages` values
- `app/stores/workspaceStatus.ts` — `SECTION_LABELS`, `GROUP_MAP`, `statusEntries()`
- `app/hooks/useCanvasLayout.ts` — 3 layout zones (plan/render/compose)
- `app/components/canvas/InfiniteCanvas.tsx` — `visibleSections` from 3 stages
- `app/components/chat/ChatPanel.tsx` — `agentNameMap`, `stageIconMap`
- `app/components/project/StagePipeline.tsx` — pipeline step labels
- `app/pages/ProjectPage.tsx` — stage-driven chat panel state

**Approval stages** (`plan_approval`, `render_approval`) are backend-internal; frontend shows them as pending states within their parent stage.

---

## Test Assertion Points

1. **Graph topology**: `test_phase2_graph.py` — route helpers return correct next stages
2. **Approval gates**: `test_phase2_graph.py` — interrupt fires at correct nodes
3. **Review routing**: `test_review.py` — each feedback type routes to correct agent
4. **Recovery**: `test_run_recovery.py` — `_resume_target_stage` returns correct stage
5. **Progress**: `test_progress.py` — `workflow_progress_for_stage` returns correct 0-1 values
6. **Cross-layer**: frontend `workspaceStatus.test.ts` — stage names match backend enum values

---

## Asset Library API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/assets` | GET | List all assets (optional `?asset_type=character\|scene\|style`) |
| `/api/v1/assets` | POST | Create asset from scratch |
| `/api/v1/assets/from-character/{id}` | POST | One-click add character to asset library |
| `/api/v1/assets/{id}` | GET | Get single asset |
| `/api/v1/assets/{id}` | DELETE | Remove asset |

**Cross-layer types**: `Asset` (frontend) ↔ `AssetRead` (backend); `AssetCreatePayload` (frontend) ↔ `AssetCreate` (backend).

**Schema**: `Asset` ORM (`app/models/asset.py`) — id, name, asset_type (character/scene/style), description, image_url, metadata_json, source_project_id, tags, created_at, updated_at.

**Migration**: `0009_create_asset_table.py` (adds `asset` table).

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
| `app/agents/orchestrator.py` | `GRAPH_STAGE_FOR_AGENT` + `RESUME_AGENT_FOR_STAGE` |
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

Each has an `approved_` counterpart set during the approval gate.

**Cross-layer**: `backend/app/models/project.py` → `backend/app/schemas/project.py` → `frontend/app/types/index.ts` + canvas shape types.

---

## Review Routing Rules

`ReviewRuleEngine` in `app/agents/review_rules.py` uses deterministic routing (no LLM):

| Feedback Type | Route To | Mode |
|---------------|----------|------|
| character/shot/render | `render` | `incremental` |
| video/compose | `compose` | `incremental` |
| story/style/scene | `plan` | `full` |
| retry-compose keywords | `compose` | `incremental` |
| unknown | `plan` | `full` |

**Good case**: "角色3的眼睛颜色不对" → feedback_type=character → route=render
**Base case**: "重新生成" → no specific type → route=plan (full regeneration)
**Bad case**: LLM review routing (old) — non-deterministic, wasted tokens, sometimes wrong routing

---

## Validation & Error Matrix

| Error | Where | Handling |
|-------|-------|----------|
| Video provider not configured | `nodes.py:_is_video_provider_invalid` | Skip compose, return `video_generation_skipped` |
| Stage already completed (rerun) | `nodes.py:_should_skip_stage` | Return early, advance stage |
| User feedback empty | `ReviewRuleEngine` | Default route to `plan` with "未提供具体反馈" |
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

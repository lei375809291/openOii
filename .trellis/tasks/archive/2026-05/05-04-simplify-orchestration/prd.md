# PRD: Simplify LangGraph Orchestration — 3-Stage + 2-Gate Architecture

## Problem Diagnosis

### Current Complexity Map

```
START
  ↓ route_from_start (7-way conditional)
  ├─ ideate (onboarding + director, 2 LLM calls)
  │    ↓
  │  ideate_approval → interrupt ←── user确认1
  │    ↓ route_after_ideate_approval (2-way)
  ├─ script (scriptwriter, 1 LLM call)
  │    ↓
  │  script_approval → interrupt ←── user确认2
  │    ↓ route_after_script_approval (2-way)
  ├─ character (character_artist, 0 LLM, API calls)
  │    ↓
  │  character_approval → interrupt ←── user确认3
  │    ↓ route_after_character_approval (2-way)
  ├─ storyboard (storyboard_artist, 0 LLM, API calls)
  │    ↓
  │  storyboard_approval → interrupt ←── user确认4
  │    ↓ route_after_storyboard_approval (3-way)
  ├─ clip (video_generator, 0 LLM, API calls)
  │    ↓
  │  clip_approval → interrupt ←── user确认5
  │    ↓ route_after_clip_approval (2-way)
  ├─ merge (video_merger, 0 LLM, FFmpeg)
  │    ↓
  └─ END

  + review node (1 LLM call just to classify feedback)
    → routes back to any of script/character/storyboard/clip/merge
```

**Count**: 11 nodes, 7 conditional edges, 5 approval gates (4 manual + 1 auto), 1 review node
**Total LLM calls per full run**: 4 (onboarding + director + scriptwriter + review)
**User interruptions**: 5 gates × ~30s cognitive cost = 2.5min of pure waiting-for-user

### Core Problems

| # | Problem | Evidence |
|---|---------|----------|
| P1 | **Onboarding → Director 冗余** | Onboarding 分析故事推荐风格，Director 也分析故事推荐风格，Director 输出完全覆盖 Onboarding。2 次 LLM 调用做同件事 |
| P2 | **审批关卡过多** | 5 个 approval gates，用户每阶段都要点"通过"。竞品（漫小芽、Anime AI Studio）最多 2 个审批点 |
| P3 | **ReviewAgent 浪费 token** | 用 LLM 分类 feedback 类型，前端发送 feedback 时已经知道是"改剧本"还是"重画角色"。1 次 LLM 调用做无需 LLM 的事 |
| P4 | **Scriptwriter 耦合角色+分镜** | 一次 LLM 调用生成 characters[] + shots[]，修改任一个都要整批重生成。Shot 字段只有 description/camera/duration/prompt/image_prompt，行业标准 10 字段 |
| P5 | **CharacterArtist 结果未被 StoryboardArtist 充分利用** | StoryboardArtist 已有 I2I 模式用角色图做参考，但默认关闭（use_i2i = false）。角色图画完后直接跳分镜，视觉上下文断裂 |
| P6 | **画布纯展示，无交互** | 所有 shape `canEdit=false, canResize=false, hideSelectionBounds`。用户无法从画布发起操作 |

---

## Solution: 3-Stage + 2-Gate Architecture

### New Pipeline

```
START
  ↓ route_from_start (4-way: plan/render/compose/review)
  ├─ plan (PlanAgent: 1 LLM call, structured output)
  │    ↓
  │  plan_approval → interrupt ←── user确认（唯一创作审批点）
  │    ↓ route_after_plan_approval (2-way)
  ├─ render (RenderAgent: 0 LLM, image API batch)
  │    ↓
  │  render_approval → interrupt ←── user确认（唯一视觉审批点）
  │    ↓ route_after_render_approval (2-way)
  ├─ compose (ComposeAgent: 0 LLM, video API + FFmpeg)
  │    ↓
  └─ END

  + review node (rule engine, 0 LLM)
    → deterministic route based on feedback_type
```

**Count**: 6 nodes, 3 conditional edges, 2 approval gates
**Total LLM calls per full run**: 1 (PlanAgent)
**User interruptions**: 2 gates × ~30s = 1min

### Stage Details

#### plan (PlanAgent)
- **Merges**: Onboarding + Director + Scriptwriter
- **LLM calls**: 1 (single structured output with all planning data)
- **Input**: user story prompt + optional template/style/ratio/duration
- **Output schema** (structured output):
  ```python
  class PlanOutput(BaseModel):
      title: str
      genre: str              # e.g. "都市悬疑", "古风玄幻"
      style: str              # visual style keywords
      summary: str            # story summary
      visual_bible: str       # 全局视觉指南（光影、色调、构图风格）
      characters: list[CharacterPlan]
      shots: list[ShotPlan]
  
  class CharacterPlan(BaseModel):
      name: str
      description: str
      role: str               # protagonist/antagonist/supporting
  
  class ShotPlan(BaseModel):
      order: int
      scene: str              # 场景描述（"夜晚的古寺大殿"）
      action: str             # 角色动作（"缓步推门"）
      expression: str         # 表情（"警惕凝视"）
      camera: str             # 景别+运镜（"中景→推近"）
      lighting: str           # 光线（"月光从窗棂斜入"）
      dialogue: str           # 台词（"这扇门...不该开着"）
      sfx: str                # 音效备注（"风铃轻响"）
      duration: float         # 秒数
  ```
- **Persists**: project.title/genre/style/summary, Character[], Shot[] (with new fields)
- **Key improvement**: 10-field shot schema produces dramatically better image/video prompts

#### render (RenderAgent)
- **Merges**: CharacterArtist + StoryboardArtist
- **LLM calls**: 0 (pure image API)
- **Pipeline**:
  1. Batch generate all character ref images
  2. Use character images as I2I reference for storyboard frames
  3. I2I is now **always on** (not optional) — this is the default flow
- **Key improvement**: character visual identity automatically carries into storyboard

#### compose (ComposeAgent)
- **Merges**: VideoGenerator + VideoMerger
- **LLM calls**: 0 (pure video API + FFmpeg)
- **Pipeline**:
  1. Generate video for each shot (I2V from storyboard frame)
  2. Merge all clips into final video
  3. No approval gate — final step, failures retried per-shot
- **Key improvement**: video generation and merge are logically inseparable (no reason to approve between them)

#### review (Rule Engine)
- **Replaces**: ReviewAgent LLM call
- **Logic**: Frontend sends `feedback_type: "plan" | "render" | "compose"` along with feedback text
- **Routing**:
  - `plan` → route to plan stage (re-plan)
  - `render` → route to render stage (re-render)
  - `compose` → route to compose stage (re-compose)
- **No LLM call**, deterministic routing

### Model Changes

Shot model gains 6 new fields (all nullable for backward compat):

```python
scene: Mapped[str | None]       # 场景描述
action: Mapped[str | None]      # 角色动作
expression: Mapped[str | None]  # 表情
lighting: Mapped[str | None]    # 光线
dialogue: Mapped[str | None]    # 台词
sfx: Mapped[str | None]         # 音效备注
```

### Graph Simplification

| Metric | Before | After | Δ |
|--------|--------|-------|---|
| Nodes | 11 | 6 | -5 |
| Conditional edges | 7 | 3 | -4 |
| Approval gates | 5 | 2 | -3 |
| LLM calls per run | 4 | 1 | -75% |
| User interruptions | 5 | 2 | -60% |

---

## Migration Steps (M1–M10)

### M1: Extend Shot Model + Alembic Migration
- Add 6 nullable columns to Shot model
- Create Alembic migration
- Update ShotCreate/ShotRead schemas
- Update frontend Shot type
- **Est**: 0.5d

### M2: Create PlanAgent
- New file `backend/app/agents/plan.py`
- Single LLM call with structured output (PlanOutput schema)
- Replace OnboardingAgent + DirectorAgent + ScriptwriterAgent logic
- Merge their prompt templates into one comprehensive system prompt
- Persist: project fields + Character[] + Shot[] (with 10-field schema)
- **Est**: 1d

### M3: Create RenderAgent
- New file `backend/app/agents/render.py`
- Merge CharacterArtistAgent + StoryboardArtistAgent
- Always use I2I mode for storyboard (character images as reference)
- Remove `use_i2i` config toggle — always on
- **Est**: 0.5d

### M4: Create ComposeAgent
- New file `backend/app/agents/compose.py`
- Merge VideoGeneratorAgent + VideoMergerAgent
- Sequential: generate clips → merge into final video
- Remove clip_approval gate (no approval between generate and merge)
- **Est**: 0.5d

### M5: Replace ReviewAgent with Rule Engine
- Replace LLM-based ReviewAgent with deterministic rule engine
- Frontend sends `feedback_type` field in feedback API call
- Route based on feedback_type: plan/render/compose
- Update `/feedback` API endpoint to accept feedback_type
- **Est**: 0.5d

### M6: Rewrite Graph + State + Nodes
- New `graph.py`: 6 nodes (plan, plan_approval, render, render_approval, compose, review)
- New `state.py`: Phase2Stage = "plan" | "plan_approval" | "render" | "render_approval" | "compose" | "review"
- New `nodes.py`: simplified approval logic, rule-based review routing
- Update `orchestrator.py`: new agent registry, new stage mapping, 2-gate confirm flow
- Update `PRODUCTION_STAGE_SEQUENCE` and `workflow_progress_for_stage`
- **Est**: 1d

### M7: Frontend Pipeline + Canvas Adaptation
- Update `pipeline.ts`: STAGE_PIPELINE from 6 stages → 3 stages (plan/render/compose)
- Update `StagePipeline.tsx`: 3 stages with 2 approval indicators
- Update `useCanvasLayout.ts`: 3 zones (plan→script section, render→characters+storyboards, compose→clips+final)
- Update `editorStore.ts`: currentStage values
- Update `useWebSocket.ts`: handle new stage names, remove old stage-specific logic
- Update `ChatPanel.tsx`: simplified workflow stage info
- **Est**: 1d

### M8: Canvas Interaction — Selectable Shapes + Context Menu
- Remove `canEdit=false, canResize=false, hideSelectionBounds` from shape creation
- Add tldraw `onSelect` handler → show context menu (regenerate / edit prompt / replace image)
- Context menu sends feedback to `/feedback` API with `feedback_type` and target entity info
- **Est**: 1d

### M9: Structured Creative Input on HomePage
- Add template selector (古风/都市/悬疑/热血/校园)
- Add style selector (日漫/国漫/水彩/写实)
- Add ratio selector (9:16/16:9)
- Add duration selector (1min/3min/5min)
- Send as structured fields alongside text prompt
- **Est**: 0.5d

### M10: Streaming Shapes + Auto-Focus
- Add `isStreaming` prop to shape types → show loading animation during generation
- Auto-zoom: `editor.zoomToShape(currentSectionShape)` on stage transition
- **Est**: 0.5d

---

## File Changes Map

### New Files
- `backend/app/agents/plan.py` — PlanAgent
- `backend/app/agents/render.py` — RenderAgent
- `backend/app/agents/compose.py` — ComposeAgent
- `backend/alembic/versions/xxxx_add_shot_detail_fields.py` — migration
- `backend/tests/test_agents/test_plan.py`
- `backend/tests/test_agents/test_render.py`
- `backend/tests/test_agents/test_compose.py`

### Modified Files
- `backend/app/models/project.py` — Shot model +6 fields
- `backend/app/schemas/project.py` — ShotCreate/ShotRead +6 fields
- `backend/app/orchestration/graph.py` — 3-stage graph
- `backend/app/orchestration/state.py` — new stage types
- `backend/app/orchestration/nodes.py` — simplified nodes
- `backend/app/agents/orchestrator.py` — new agent registry + stage mapping
- `backend/app/api/v1/routes/generation.py` — feedback_type param
- `backend/app/services/run_recovery.py` — new stage order
- `frontend/app/utils/pipeline.ts` — 3 stages
- `frontend/app/components/pipeline/StagePipeline.tsx` — 3 stages
- `frontend/app/hooks/useCanvasLayout.ts` — 3 zones
- `frontend/app/stores/editorStore.ts` — new stage values
- `frontend/app/hooks/useWebSocket.ts` — new stage names
- `frontend/app/types/index.ts` — WorkflowStage type + Shot type
- `frontend/app/services/api.ts` — feedback with feedback_type

### Deleted Files (after M6 complete)
- `backend/app/agents/onboarding.py`
- `backend/app/agents/director.py`
- `backend/app/agents/scriptwriter.py`
- `backend/app/agents/character_artist.py`
- `backend/app/agents/storyboard_artist.py`
- `backend/app/agents/video_generator.py`
- `backend/app/agents/video_merger.py`
- `backend/app/agents/review.py`

---

## Acceptance Criteria

- All backend tests pass (≥866)
- All frontend tests pass (≥346)
- ruff check clean, tsc --noEmit clean
- Backend coverage ≥95% on new agent modules
- End-to-end generation flow works (manual test with dev stack)
- Old agent files removed (not just deprecated)
- Graph has exactly 6 nodes, 2 approval gates
- PlanAgent produces 10-field shots by default

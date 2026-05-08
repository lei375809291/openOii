# Journal - c (Part 1)

> AI development session journal
> Started: 2026-04-25

---



## Session 1: Bootstrap Trellis Project Guidelines

**Date**: 2026-04-25
**Task**: Bootstrap Trellis Project Guidelines
**Branch**: `main`

### Summary

(Add summary)

### Main Changes

**Goal**: Fill all 11 placeholder spec files in `.trellis/spec/{backend,frontend}/` with project-specific guidelines based on real codebase patterns.

| Layer | File | Highlights |
|-------|------|------------|
| Backend | `directory-structure.md` | `app/` module map, FastAPI entry, orchestration layout |
| Backend | `database-guidelines.md` | SQLAlchemy 1.x style, dual init (Alembic + `init_db()`), Postgres/SQLite branches |
| Backend | `error-handling.md` | `AppError` tree, `add_exception_handlers`, generation `RuntimeError` non-blocking |
| Backend | `quality-guidelines.md` | `uv` workflow, ruff rules, common pitfalls (`Settings()` vs `get_settings()`) |
| Backend | `logging-guidelines.md` | `setup_logging` + `LogContextManager`, `run_id`/`project_id` context |
| Frontend | `directory-structure.md` | `app/` layout, `~/` alias |
| Frontend | `component-guidelines.md` | Function components, props typing, co-located tests |
| Frontend | `hook-guidelines.md` | Custom hook patterns; `useWebSocket`+`applyWsEvent` reducer as canonical |
| Frontend | `state-management.md` | Local / Zustand `editorStore` / TanStack Query boundaries |
| Frontend | `type-safety.md` | Strict tsconfig, `WsEvent` discriminated union, `type` vs `interface` |
| Frontend | `quality-guidelines.md` | No ESLint (verified) — `tsc --noEmit` + `pnpm build` is the only gate |

**Key Findings**:
- Frontend has **no ESLint/Prettier** — quality enforcement is purely `tsc` + review
- Tailwind is **v3** (`@tailwind` directives + `tailwind.config.ts`), not v4
- Backend uses dual-init pattern (Alembic versions + runtime `init_db()` `create_all()`)
- Generation orchestration is single-instance (in-process `task_manager` + Redis confirms)
- Both `index.md` updated from "To fill" → "Filled"

**Updated Files**:
- `.trellis/spec/backend/index.md`
- `.trellis/spec/backend/{directory-structure,database-guidelines,error-handling,quality-guidelines,logging-guidelines}.md`
- `.trellis/spec/frontend/index.md`
- `.trellis/spec/frontend/{directory-structure,component-guidelines,hook-guidelines,state-management,quality-guidelines,type-safety}.md`
- `.gitignore` — removed `.trellis` exclusion
- `.trellis/.gitignore` — added `workspace/*/` and `backup/` rules to keep shared registry but ignore per-dev journals

**Verification**: All spec files include real signatures, file paths, validation/error matrices, and Good/Bad examples per spec hard-block requirements.


### Git Commits

| Hash | Message |
|------|---------|
| `0fb1a83` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: Coverage push to 97% + container restart

**Date**: 2026-04-29
**Task**: Coverage push to 97% + container restart
**Branch**: `main`

### Summary

(Add summary)

### Main Changes

## Coverage Push Summary

| 模块 | 之前 | 现在 |
|---|---|---|
| `orchestrator.py` | 84% | **95%** |
| `characters.py` | — | **98%** |
| `shots.py` | — | **96%** |
| `video_generator.py` | 71% | **100%** |
| `storyboard_artist.py` | 77% | **100%** |
| `image.py` | 70% | **93%** |
| `scriptwriter.py` | 34% | **100%** |
| `config.py` | 37% | **97%** |
| `runtime.py` | — | **100%** |
| `exceptions.py` | — | **100%** |
| **TOTAL** | **88%** | **97%** |

**Final**: 814 passed, ruff clean, frontend 228 passed + build clean.

## Key Fixes

- `test_main.py` WebSocket stub infinite loop: `RuntimeError` → `WebSocketDisconnect` on message exhaustion (memory blowup root cause)
- Ruff auto-fix: 10 duplicate/unused imports cleaned across test files
- `FakeSession` extended with `scalars_result` parameter for orchestrator `_wait_for_confirm` tests
- `asyncio.sleep` lambda stubs fixed to return coroutines (not `None`)
- All core business modules now ≥95% line coverage

## Container Restart

Restarted all openOii services (postgres 5433, redis, backend, frontend). Backend required rebuild (old image from 3 days ago). Confirmed API healthy at `/api/v1/projects`.

## Remaining Task

- `04-25-fix-progress-update` still pending: `run.progress` / `run.current_agent` only update at ideate→script transition; subsequent stages never update progress (frontend progress bar appears frozen).


### Git Commits

| Hash | Message |
|------|---------|
| `f581cce` | (see git log) |
| `b923874` | (see git log) |
| `5ea2e54` | (see git log) |
| `d1552e5` | (see git log) |
| `30e5318` | (see git log) |
| `a2b472a` | (see git log) |
| `3ee01f6` | (see git log) |
| `55952c1` | (see git log) |
| `ff0ed36` | (see git log) |
| `106e5d5` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 3: Implement multi-agent UX simplification

**Date**: 2026-05-03
**Task**: Implement multi-agent UX simplification
**Branch**: `main`

### Summary

Implemented collapsible message display with summary field, auto-continue for scriptwriter and video_generator, pause/resume controls, and natural language progress messages

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `93d8ce2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 4: Refactor 4-stage to 3-stage orchestration (plan/render/compose)

**Date**: 2026-05-06
**Task**: Refactor 4-stage to 3-stage orchestration (plan/render/compose)
**Branch**: `main`

### Summary

Merged character+shot into render stage across backend and frontend, deleted CharacterAgent and ShotAgent, updated graph/nodes/state/orchestrator/review_rules/recovery and all canvas/pipeline/workflowStatus components. All 953 backend + 341 frontend tests pass.

### Main Changes

(Add details)

### Git Commits

(No commits - planning session)

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 5: Refactor 4-stage to 3-stage orchestration (plan/render/compose)

**Date**: 2026-05-06
**Task**: Refactor 4-stage to 3-stage orchestration (plan/render/compose)
**Branch**: `main`

### Summary

Merged character+shot into render stage across backend and frontend. Deleted CharacterAgent and ShotAgent, updated graph/nodes/state/orchestrator/review_rules/recovery and all canvas/pipeline/workflowStatus components. Fixed StagePipeline palette icon missing from STAGE_ICONS. All 953 backend + 341 frontend tests pass.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `69d4371` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 6: Canvas refactor: grouped draggable shapes + AssetDrawer fix

**Date**: 2026-05-06
**Task**: Canvas refactor: grouped draggable shapes + AssetDrawer fix
**Branch**: `main`

### Summary

Two changes: (1) Fix AssetDrawer not showing images — it used asset.image_url directly instead of getStaticUrl(), breaking relative paths on the frontend dev server. (2) Major canvas refactor — split the monolithic storyboard-board shape into independent tldraw shapes grouped by section (plan-section, character-section with character-card children via parentId, storyboard-section with shot-card children via parentId, compose-section). Dragging a section moves all its child cards together; dragging a single card moves only that card. All 345 tests pass.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `c4e8f01` | (see git log) |
| `9c576d8` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 7: Audit and fix canvas duplication

**Date**: 2026-05-06
**Task**: Audit and fix canvas duplication
**Branch**: `main`

### Summary

Full frontend-backend API alignment audit (all aligned, no issues). Fixed canvas duplication: CharacterSectionShape and StoryboardSectionShape rendered cards inline while independent CharacterCardShape/ShotCardShape child shapes also rendered the same cards, causing double rendering. Deleted the independent card shapes, kept inline rendering in section shapes. Updated all related tests.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `42dcff3` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 8: InsightFace face cropping + Settings UI improvements

**Date**: 2026-05-07
**Task**: InsightFace face cropping + Settings UI improvements
**Branch**: `main`

### Summary

Added InsightFace face cropping for character consistency in storyboard generation. Fixed settings UI: basic settings tab, empty value delete behavior, config reveal flow.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e07488c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 9: Settings fixes, video API, font bundling, progress cleanup

**Date**: 2026-05-08
**Task**: Settings fixes, video API, font bundling, progress cleanup
**Branch**: `main`

### Summary

Fixed settings UI (basic tab, config delete, ConfigInput reveal, test-connection whitelist). Fixed HistoryDrawer navigation. Added video service support for grok-videos and veo3 models. Bundled fonts locally with @fontsource. Cleaned up progress messages on completion. Fixed project deletion cascade. Fixed URL safety check for empty values.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e07488c` | (see git log) |
| `14d6086` | (see git log) |
| `9d7c0f7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

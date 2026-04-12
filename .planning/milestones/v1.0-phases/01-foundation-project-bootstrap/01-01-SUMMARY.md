---
phase: 01-foundation-project-bootstrap
plan: 01
subsystem: bootstrap
tags: [regression-tests, sqlmodel, lineage, frontend]
dependency_graph:
  requires: [backend/app/models/project.py, backend/app/models/agent_run.py, backend/app/services/config_service.py, frontend/app/pages/NewProjectPage.tsx]
  provides: [backend/app/models/run.py, backend/app/models/stage.py, backend/app/models/artifact.py, backend/tests/test_domain/test_lineage_models.py]
  affects: [backend/app/db/session.py, backend/tests/conftest.py, backend/tests/test_api/test_projects.py, backend/tests/test_api/test_config.py, frontend/app/pages/NewProjectPage.test.tsx]
tech_stack: [FastAPI, SQLModel, pytest, Vitest, React, React Query]
key_files: [backend/tests/conftest.py, backend/tests/test_api/test_projects.py, backend/tests/test_api/test_config.py, backend/tests/test_domain/test_lineage_models.py, backend/app/models/run.py, backend/app/models/stage.py, backend/app/models/artifact.py, backend/app/db/session.py, frontend/app/pages/NewProjectPage.test.tsx]
decisions:
  - Keep AgentRun and the manual orchestrator unchanged.
  - Persist Run.thread_id as the canonical LangGraph ownership boundary.
  - Treat Stage and Artifact as explicit lineage tables with project/run linkage plus version/provenance fields.
metrics:
  duration: in-session
  completed_date: 2026-04-11
---

# Phase 01 Plan 01: Foundation Project Bootstrap Summary

Locked the existing project/config bootstrap flow with regression coverage and added canonical lineage tables for Run, Stage, and Artifact without changing runtime orchestration.

## What changed

- Added backend regression tests for project creation, provider config precedence/masking, and lineage model contracts.
- Added a frontend regression test that verifies the existing NewProjectPage payload and `?autoStart=true` navigation.
- Implemented `Run`, `Stage`, and `Artifact` SQLModel tables and registered them in metadata bootstrap.
- Updated test bootstrap imports so the new tables are created in isolated test databases.

## Verification

- `cd backend && uv run pytest tests/test_api/test_projects.py tests/test_api/test_config.py tests/test_domain/test_lineage_models.py -x`
- `cd frontend && pnpm vitest run app/pages/NewProjectPage.test.tsx`

## Deviations from Plan

None.

## Blockers / Follow-up

None.

## Self-Check: PASSED

- Summary file exists at the expected path.
- Targeted backend and frontend verification commands passed.

# Research Summary

**Project:** openOii
**Domain:** AI-agent comic-drama generation platform for independent creators
**Summarized:** 2026-04-11
**Confidence:** HIGH for core product direction, MEDIUM for fast-moving ecosystem details

## Executive Summary

The strongest direction for openOii is not “more automation everywhere,” but a guided, resumable, creator-controlled pipeline that turns a story idea into a final video while preserving artifact lineage, reviewability, and selective reruns.

The existing repository already validates the rough shape of the product: FastAPI backend, React frontend, tldraw-based workspace, WebSocket progress, multiple creative stages, and review/regeneration concepts. The roadmap should therefore focus on tightening the core workflow, hardening long-running execution, and making creator control explicit — not on expanding into collaboration, social features, or marketplace surfaces.

## Key Findings

### Stack

- The current overall stack direction is sound: FastAPI + React + TypeScript + PostgreSQL + Redis + tldraw.
- The main upgrades are architectural hardening rather than wholesale replacement:
  - add a real async job queue
  - add DB migrations
  - formalize observability
  - tighten agent/tool boundaries
  - make LangGraph the primary orchestration layer
- By explicit project decision, LangGraph is now the v1 workflow baseline. FastAPI remains the application shell; LangGraph owns orchestration, persistence, interrupt/resume behavior, and graph state.

### Features

- Users in this category expect the full story → script → character → storyboard → clip → final video loop to exist.
- The hardest and most important product problem is **character consistency across downstream artifacts**.
- The highest-value differentiators are:
  - multi-agent orchestration
  - transparent agent reasoning/progress
  - selective rerun / review control
  - artifact-aware workspace UX
- The wrong v1 expansions are team collaboration, marketplace/community, native mobile creation, full video-editing suites, and custom model training.

### Architecture

- Recommended shape: **FastAPI modular monolith shell + embedded LangGraph orchestration layer + async execution layer + asset/metadata persistence layer**.
- The backend should own canonical truth for projects, runs, stages, artifacts, approvals, and lineage.
- The canvas should be a projection of backend metadata, not the only source of truth.
- Long-running media work must be queued and resumable, with explicit stage states and durable LangGraph checkpoints.

### Pitfalls

- The biggest failure modes are:
  - orchestration drift between stages
  - prompt / asset lineage loss
  - character consistency collapse
  - storyboard/video mismatch
  - runaway generation cost
  - weak recovery for long-running jobs
  - generic review/rerun UX
  - asset storage sprawl
  - canvas performance and accessibility debt

## Recommended Product Shape for v1

### Must Prove

1. A solo creator can create a project from a story idea.
2. The system can run the full creative pipeline end-to-end.
3. The creator can inspect progress and outputs at each stage.
4. The creator can selectively rerun bad outputs without restarting the full run.
5. The system can produce a final merged video artifact.

### Should Include

- Character reference handling and approval before downstream expansion
- Per-shot prompt editing and rerun targeting
- Real-time progress and failure visibility
- Workspace views that clearly separate draft, approved, failed, and superseded artifacts
- Cost-aware execution and provider configuration management

### Should Defer

- Team collaboration
- Community or marketplace features
- Native mobile authoring
- Full-featured timeline editor / post-production suite
- Voice/TTS pipeline
- Custom model training / LoRA workflows

## Roadmap Implications

### Likely Early Phases

1. **Foundation and run model**
   - canonical project/run/stage/artifact schema
   - LangGraph state schema, reducers, and thread mapping
   - lineage and approval state
   - migrations and basic telemetry

2. **Durable execution and human review**
   - persistent checkpointer
   - interrupt/resume approval flows
   - resumable stage execution

3. **Queued execution and workspace truth**
   - background jobs
   - backend-driven progress and canvas projection

4. **Character and storyboard fidelity**
   - character reference management
   - shot metadata enrichment
   - consistency safeguards

5. **Review and selective reruns**
   - artifact-scoped feedback
   - targeted rerun flows
   - approval checkpoints

6. **Final assembly and production readiness**
   - final merge/export
   - storage lifecycle
   - observability and recovery hardening

## What to Watch Closely

- Do not let the roadmap inherit every current repo detail as a product commitment.
- Do not collapse all business truth into LangGraph state; projects/assets/permissions still belong to the application data model.
- Do not add collaboration and platform ambitions before the solo-creator loop feels excellent.
- Do not ship a demo-shaped pipeline without durable run state, lineage, and resumability.
- Do not rely on generic rerun UX; the product needs artifact-specific correction paths.

## Source Set

- `.planning/research/STACK.md`
- `.planning/research/FEATURES.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/PITFALLS.md`

---
*Research summary for: openOii*
*Summarized: 2026-04-11*

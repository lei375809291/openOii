# Requirements

**Project:** openOii
**Date:** 2026-04-11
**Scope Basis:** interactive scoping after research review

**Technical Note:** v1 planning now assumes LangGraph as the primary agent orchestration framework.

## v1 Requirements

### Project Setup

- [ ] **PROJ-01**: A creator can create a project by entering a story idea, title, and style direction.
- [ ] **PROJ-02**: A creator can configure the text, image, and video providers used by the project before running generation.

### Pipeline Execution

- [ ] **PIPE-01**: A creator can trigger a full generation run that executes the end-to-end pipeline from story input to final merged video.
- [ ] **PIPE-02**: A creator can see the current stage, progress, and status changes of a generation run in real time.
- [ ] **PIPE-03**: A creator can receive a final merged video artifact when all required clips complete successfully.

### Character and Story Consistency

- [ ] **CHAR-01**: A creator can upload or define character reference inputs that are reused by downstream generation stages.
- [ ] **CHAR-02**: The system can preserve character identity consistently across storyboard and video outputs for the same project.
- [x] **SHOT-01**: A creator can review storyboard outputs per shot before or during downstream video generation.

### Workspace and Visualization

- [ ] **WORK-01**: A creator can use an infinite canvas workspace to view the project’s script, characters, storyboards, clips, and final output as related artifacts.
- [ ] **WORK-02**: The workspace can show artifact status clearly, including draft, generating, complete, failed, and superseded states.

### Review and Creative Control

- [ ] **REVI-01**: A creator can selectively regenerate a single character, storyboard shot, or video clip without restarting the full project run.
- [ ] **REVI-02**: A creator can edit the prompt or generation instructions for a specific shot before rerunning it.

### Reliability and Recovery

- [ ] **REL-01**: A creator can resume a run after interruption or failure from the last valid stage instead of restarting the entire pipeline.

### Delivery

- [ ] **DELIV-01**: A creator can preview the final merged video inside the product.
- [ ] **DELIV-02**: A creator can download the final merged video once generation is complete.

## v1.x Requirements

- [ ] **PROJ-03**: A creator can see an estimated generation cost before starting a full run.
- [ ] **WORK-03**: A creator can use a timeline-style view to inspect clip order and pacing in addition to the canvas view.
- [ ] **REVI-03**: A creator can inspect the message or activity history of the responsible agents during project generation.
- [ ] **REL-02**: The system can fall back to an alternative configured provider when a primary provider fails for a supported generation step.
- [ ] **CTRL-01**: A creator can view explicit lineage from script sections to storyboard shots and downstream clips.
- [ ] **CTRL-02**: A creator can batch-regenerate multiple shots with controlled variations for creative exploration.
- [ ] **MEDIA-01**: A creator can add simple background music or light transition presets during final assembly.

## Out of Scope

- Multi-user collaboration and shared editing — deferred because v1 is focused on independent creators.
- Marketplace, community, or social sharing features — deferred because they do not prove the core creation loop.
- Native mobile authoring experience — deferred because the core workspace is desktop-first.
- Full post-production video editing suite — deferred because the product’s value is AI creation, not replacing video editors.
- Voice generation / TTS workflow — deferred because it adds a separate modality and quality problem set.
- Custom model training or LoRA workflows — deferred because they materially expand infrastructure and product scope.

## Traceability

| Requirement ID | Planned Phase | Status |
|----------------|---------------|--------|
| PROJ-01 | Phase 1 | Pending |
| PROJ-02 | Phase 1 | Pending |
| PIPE-01 | Phase 2 | Pending |
| PIPE-02 | Phase 4 | Pending |
| PIPE-03 | Phase 6 | Pending |
| CHAR-01 | Phase 3 | Pending |
| CHAR-02 | Phase 3 | Pending |
| SHOT-01 | Phase 3 | Complete |
| WORK-01 | Phase 4 | Pending |
| WORK-02 | Phase 4 | Pending |
| REVI-01 | Phase 5 | Pending |
| REVI-02 | Phase 5 | Pending |
| REL-01 | Phase 2 | Pending |
| DELIV-01 | Phase 6 | Pending |
| DELIV-02 | Phase 6 | Pending |

**Coverage:** 15/15 v1 requirements mapped ✓ — no orphans, no duplicates.

---
*Requirements for: openOii*
*Defined: 2026-04-11*

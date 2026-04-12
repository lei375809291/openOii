# Pitfalls Research

**Domain:** AI-agent comic-drama generation platform for independent creators
**Researched:** 2026-04-11
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Orchestration Drift Between Stages

**What goes wrong:**
Each stage generates something plausible in isolation, but the overall run stops feeling coherent because later stages no longer reflect earlier creative intent.

**Why it happens:**
The system stores outputs but not enough structured intent, constraints, or stage-level contracts to preserve direction.

**How to avoid:**
Persist stage briefs, decision summaries, and artifact lineage as first-class metadata. Make downstream stages consume structured context, not only free-form text.

**Warning signs:**
- Character visuals stop matching the approved script direction.
- Storyboard prompts drift away from the selected style.
- Repeated “why did it decide that?” review moments.

**Phase to address:**
Foundation phase for domain model and orchestration contracts.

---

### Pitfall 2: Prompt and Asset Lineage Loss

**What goes wrong:**
The creator cannot tell which prompt, provider, parameters, or parent asset produced the current result, so reruns become guesswork.

**Why it happens:**
Teams optimize for shipping visible media quickly and postpone lineage metadata.

**How to avoid:**
Store every artifact with parent-child relationships, provider metadata, prompt references, version timestamps, and approval state.

**Warning signs:**
- “Regenerate” creates different outputs with no explanation.
- Teams cannot compare current output to prior approved versions.
- Debugging quality regressions requires searching logs manually.

**Phase to address:**
Foundation phase for artifact schema and review model.

---

### Pitfall 3: Character Consistency Collapse

**What goes wrong:**
Characters change appearance between shots, or regenerated storyboards no longer look like the approved character set.

**Why it happens:**
Character identity is treated as descriptive text rather than as a reusable, constrained visual reference with lineage.

**How to avoid:**
Create explicit character reference assets, character IDs, reusable visual descriptors, and approval gates before storyboard/video expansion.

**Warning signs:**
- “Main character” must be manually re-explained in later stages.
- Reviewers approve a character, then reject most downstream shots for inconsistency.

**Phase to address:**
Character and storyboard workflow phase.

---

### Pitfall 4: Storyboard-to-Video Semantic Mismatch

**What goes wrong:**
The video output is technically valid but no longer matches the framing, pacing, or emotional intent of the storyboard.

**Why it happens:**
The video stage consumes an underspecified prompt and loses shot intent, timing, or composition metadata.

**How to avoid:**
Persist shot intent, timing hints, camera language, and reference imagery separately from the plain prompt. Validate that the video stage consumes these fields explicitly.

**Warning signs:**
- Approved storyboard images still yield unusable clips.
- Video regeneration success rate is much lower than storyboard approval rate.

**Phase to address:**
Video generation and final assembly phase.

---

### Pitfall 5: Runaway Generation Cost

**What goes wrong:**
Users trigger broad reruns, providers retry expensively, and the product proves usage but not unit economics.

**Why it happens:**
There is no granular rerun targeting, no cost budget tracking, and no execution throttling by stage.

**How to avoid:**
Add per-run cost accounting, stage-level quotas, selective rerun scopes, and explicit “full rerun vs targeted rerun” choices.

**Warning signs:**
- Costs spike on review-heavy projects.
- The system frequently regenerates more artifacts than the user intended.
- Provider bills are hard to map back to user actions.

**Phase to address:**
Orchestration hardening and review/rerun phase.

---

### Pitfall 6: Long-Running Job Recovery Failure

**What goes wrong:**
When a provider, worker, or process dies mid-run, the project is left in a confusing half-complete state with no reliable resume path.

**Why it happens:**
Status transitions are not idempotent, and stage execution is not modeled as resumable jobs with persisted checkpoints.

**How to avoid:**
Use queued stage execution, explicit run/stage states, durable checkpoints, and recovery-safe job retries.

**Warning signs:**
- Browser refresh loses accurate status.
- Operators have to manually patch DB state to recover a project.
- Users restart full runs to work around stuck stages.

**Phase to address:**
Run lifecycle and worker infrastructure phase.

---

### Pitfall 7: Poor Review and Rerun UX

**What goes wrong:**
Users know something is wrong but cannot express whether the problem is script, character, shot framing, clip motion, or final assembly.

**Why it happens:**
The review surface is too generic, and rerun scope is not aligned with the artifact model.

**How to avoid:**
Design review around concrete artifact types and scopes: project-level, character-level, shot-level, clip-level, merge-level.

**Warning signs:**
- Users leave free-form complaints that require operator interpretation.
- Regeneration often fixes the wrong layer.
- Approval loops take multiple tries for simple corrections.

**Phase to address:**
Review, approval, and targeted rerun UX phase.

---

### Pitfall 8: Asset Storage Sprawl

**What goes wrong:**
Temporary, failed, superseded, and approved outputs all accumulate with unclear ownership and lifecycle.

**Why it happens:**
Binary storage and metadata storage evolve separately, so retention and cleanup are never formalized.

**How to avoid:**
Link every stored object to artifact metadata, version state, and retention policy from the start.

**Warning signs:**
- Storage costs grow faster than active creator usage.
- Engineers hesitate to delete old files because nothing is traceable.
- Final outputs cannot be distinguished cleanly from intermediates.

**Phase to address:**
Asset persistence and cleanup phase.

---

### Pitfall 9: Canvas Performance and Accessibility Debt

**What goes wrong:**
The workspace becomes visually rich but slow, inaccessible, and frustrating as project size grows.

**Why it happens:**
Teams build custom cards quickly without low-zoom rendering rules, culling strategy, keyboard navigation, or descriptive accessibility hooks.

**How to avoid:**
Adopt tldraw’s performance and accessibility patterns early: simplified low-zoom shapes, efficient indicators, asset-backed media, keyboard tab strategy, and descriptive labels.

**Warning signs:**
- Large projects feel laggy well before launch.
- Screen-reader or keyboard-only use is effectively impossible.
- Custom shape UI breaks dragging/selection behavior.

**Phase to address:**
Canvas and workspace interaction phase.

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store only final media URLs | Faster MVP wiring | No rerun lineage, poor debugging, no auditability | Never |
| Run media generation inside API requests | Less infrastructure at first | Timeouts, stuck requests, impossible recovery | Only for tiny local demos |
| Put workflow truth in frontend canvas state | Faster UI iteration | Reload/recovery divergence, fragile approvals | Never |
| Use one generic “regenerate” action everywhere | Simple UX copy | Wrong rerun scope, wasted cost, user confusion | Only before scoped review UX exists |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| LLM / agent runtime | Treating role prompts and provider logic as one thing | Keep role behavior separate from provider/tool adapters |
| Image / video providers | Binding provider-specific fields directly into domain records | Normalize provider outputs behind internal artifact contracts |
| Object storage | Letting binary paths exist without metadata linkage | Store every object via asset metadata and retention rules |
| MCP / tools | Treating allowlists as security boundaries | Use explicit permission policy, hooks, and tool auditability |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Inline media-heavy canvas shapes | UI jank, slow zoom/pan, memory spikes | Asset-backed media, low-zoom simplification, culling | Medium-size projects with many artifacts |
| Single worker pool for all stages | Image/video jobs block lighter orchestration work | Separate worker classes or priority queues by stage type | As soon as long-running media jobs dominate |
| No artifact cleanup policy | Storage growth outpaces user growth | Distinguish temp, superseded, approved, and final outputs | Within early beta if users rerun often |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing raw provider credentials to the browser | Provider abuse, credential leakage | Keep provider access server-side behind controlled config and tools |
| Logging full prompts and private story content indiscriminately | Privacy leakage and audit risk | Redact or scope logs; separate debug logs from user-facing history |
| Unscoped tool permissions for agent roles | Unintended destructive or expensive actions | Enforce role-specific tool permissions and human review checkpoints where needed |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing only “Generating…” | Users do not know what is happening or what is stuck | Expose stage, artifact, and provider-level progress/state |
| Mixing draft and approved outputs visually | Users lose trust in what is final | Distinguish current, approved, superseded, and retry states clearly |
| Generic feedback box for all issues | Users cannot express correction intent precisely | Offer review actions aligned to artifact scope and stage |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Project creation:** Often missing resumable run state — verify refresh/reconnect preserves stage truth.
- [ ] **Character generation:** Often missing approved reference lineage — verify storyboard/video stages consume the approved character state.
- [ ] **Storyboard generation:** Often missing shot-level metadata beyond plain prompt — verify framing, pacing, and intent are persisted.
- [ ] **Video generation:** Often missing targeted rerun scope — verify a single bad clip can be regenerated without invalidating unrelated outputs.
- [ ] **Final assembly:** Often missing provenance and retention rules — verify merged output links back to source clip versions.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Lineage loss | HIGH | Freeze reruns, reconstruct artifact ancestry from logs/provider metadata, backfill schema before continuing |
| Stuck long-running jobs | MEDIUM | Mark stage failed safely, expose resume action, replay idempotent job from last durable checkpoint |
| Character consistency collapse | MEDIUM | Re-anchor to approved character references, invalidate only dependent storyboard/video artifacts, rerun downstream layers |
| Asset storage sprawl | MEDIUM | Add retention classes, backfill metadata links, run cleanup in controlled batches |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Orchestration drift | Phase 1: domain and run model foundation | Downstream stages can explain their inputs and constraints |
| Prompt / asset lineage loss | Phase 1: artifact schema and lineage | Every artifact shows parent, provider, prompt/version metadata |
| Character consistency collapse | Phase 2: character + storyboard workflow | Approved character references are reused downstream |
| Storyboard / video mismatch | Phase 3: video pipeline fidelity | Video outputs can be traced back to approved shot intent |
| Runaway cost | Phase 3: rerun controls and cost telemetry | Rerun scope and per-run cost are visible and bounded |
| Recovery failure | Phase 2: queued execution and resumability | Failed runs can resume without full restart |
| Poor review UX | Phase 4: review and approval surfaces | Users can target corrections at the right artifact level |
| Asset sprawl | Phase 4: asset lifecycle and cleanup | Storage classes and cleanup rules are enforced |
| Canvas performance/accessibility debt | Phase 2: workspace foundation | Large projects remain usable and keyboard/screen-reader friendly |

## Sources

- Anthropic Claude Agent SDK docs and examples
- Model Context Protocol docs and examples
- tldraw official docs, examples, workflow starter kit, and image-pipeline starter kit
- Existing openOii repo capability signals gathered during initialization

---
*Pitfalls research for: AI-agent comic-drama generation platform*
*Researched: 2026-04-11*

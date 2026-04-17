# Feature Landscape: v1.1 Provider Portability Proof

**Domain:** project-scoped provider portability inside a solo-creator AI creation workflow  
**Researched:** 2026-04-17  
**Milestone context:** subsequent milestone focused only on proving `PROJ-02` end-to-end in the shipped v1.0 creator workflow

## Table Stakes

Required creator-facing and operator-facing behaviors for this milestone. Missing any of these means provider portability is not actually proven.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Per-project provider selection for text / image / video** | A creator needs provider choice to belong to the project, not to the whole app or server | Medium | Must live on the project, not only in env/global config |
| **Visible current provider settings before run** | Users need to know what will be used before spending time/money on generation | Low | Show project-level selections clearly in project setup/config surface |
| **Project settings persist across refresh/resume** | Provider choice is part of project intent; it cannot disappear after reload or restart | Low | Must survive page refresh, backend restart, and later reruns |
| **Execution uses the project’s selected providers** | Portability proof fails if UI changes but runtime still uses global/default providers | High | Must be observable in actual generation behavior or run metadata |
| **Stage-appropriate provider routing** | Text provider should affect text stages, image provider image stages, video provider video stages | Medium | Avoid vague “one provider for everything” behavior unless explicitly designed that way |
| **Unsupported/unavailable provider is blocked with a clear message** | Users need deterministic failure, not silent fallback to the wrong provider | Medium | Unsupported path is part of proof, not an edge case |
| **Reruns respect the same project-scoped provider choice** | Provider portability is incomplete if only the first run uses the selection | Medium | Character/shot/clip rerun path should not revert to global defaults |
| **Operator-visible trace of which provider was actually used** | Needed to debug creator reports and prove routing worked | Low | Could be run summary, stage metadata, logs, or admin/debug panel; does not need full observability platform |

## Differentiators

Useful milestone additions that strengthen the experience, but are not required to declare `PROJ-02` complete.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Project template presets for provider bundles** | Lets a solo creator choose “fast draft” or “quality pass” without understanding every provider | Low | Nice-to-have polish, not proof |
| **Inline capability hints per provider** | Reduces misconfiguration by telling users which providers support text/image/video or specific stages | Medium | Helpful, but not mandatory if unsupported cases are blocked well |
| **Estimated cost / speed hints by provider** | Helps creators choose intentionally between cheaper/faster/better options | Medium | Valuable later, not needed for portability proof |
| **Safe project-level “swap and rerun this stage” shortcuts** | Makes portability feel practical rather than just configurable | Medium | Good follow-on once core selection chain is proven |
| **Audit-friendly provider lineage in workspace cards** | Makes it obvious which provider produced current vs superseded assets | Medium | Strong operator/debug value, but beyond minimum proof |

## Anti-Features

Keep these out of scope for v1.1 even if they sound related.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Automatic provider fallback / cascading failover** | Hides whether project-scoped routing actually worked; makes proof ambiguous | Fail explicitly when selected provider is unavailable or unsupported |
| **Per-shot / per-asset provider switching UI** | Too much control for the milestone; turns a project portability proof into a complex routing product | Keep provider choice at project scope only |
| **Multi-user/provider permission models** | Team workflows are out of scope and do not help prove solo-creator value | Assume single creator + operator support model |
| **Bring-your-own-key management overhaul** | Credential administration is adjacent, but not the proof target | Reuse existing credential/config mechanisms where possible |
| **Provider comparison dashboard** | Analytics/reporting is nice, but does not prove end-to-end portability | Show only enough runtime evidence to confirm selected provider was used |
| **Cross-project bulk migration tools** | Operationally useful later, but not needed for one-project proof | Prove one project can select, persist, run, and rerun with its own providers |
| **Invisible fallback to global defaults on error** | Creates false positives: the run may succeed while portability remains broken | Surface a blocking error and force explicit correction |
| **Full universal capability abstraction across every provider quirk** | Too much architecture for a proof milestone | Support only the selected providers/stages needed for the milestone and reject the rest clearly |

## Minimal Proof of Completion

This is the minimum end-to-end proof needed to say `PROJ-02` is actually complete for v1.1.

### Required happy path proof

1. **Create or open a project** in the existing creator workflow.
2. **Set project-scoped providers** for at least text, image, and video through a creator-facing project settings/setup path.
3. **Save and reload the project** and confirm the same provider selections remain visible.
4. **Run real generation work** that touches the affected stages.
   - Text-selected provider is used for text generation work.
   - Image-selected provider is used for image generation work.
   - Video-selected provider is used for video generation work.
5. **Observe proof in-product or in operator evidence** that the chosen providers actually executed.
   - Minimum acceptable proof: stage/run metadata, status panel, or logs tied to the run/project.
   - Not acceptable: “the setting existed in the UI” without runtime evidence.
6. **Trigger at least one selective rerun** after changing a project provider, and confirm the rerun uses the updated project-scoped provider rather than the old/global one.

### Required failure / unsupported path proof

At least one unsupported or unavailable case must be proven.

Expected behavior:

- If a creator selects a provider that is not configured, not supported for that modality, or not available for the requested stage, the product should:
  - block or fail that action clearly,
  - explain what is wrong in creator language,
  - preserve the rest of the project,
  - avoid silently substituting another provider.

Minimum evidence:

1. A creator can reach a clear validation or runtime error for an invalid provider/stage combination.
2. The error identifies the problematic provider or modality.
3. The project remains recoverable by updating settings and retrying.

### What counts as complete vs polish

**Required for completion:**

- Project-scoped provider selection exists.
- Selection persists on the project.
- Real generation honors the project selection.
- Rerun path also honors the project selection.
- Invalid/unsupported selection fails clearly.
- Operator can verify which provider actually ran.

**Nice-to-have polish, not required for completion:**

- Fancy provider comparison UI
- Cost/speed estimates
- Preset bundles like “cheap/fast/high quality”
- Asset-level provider history in the workspace
- Automatic fallback or multi-provider redundancy

### Recommended acceptance wording for PROJ-02

`PROJ-02` is complete when a solo creator can choose project-level text/image/video providers, save those choices, run and rerun generation with those exact providers, and receive a clear error instead of silent fallback when a selected provider is unsupported or unavailable.

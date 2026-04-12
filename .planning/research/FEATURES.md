# Feature Landscape

**Domain:** AI-agent creative workflow — solo creator turns story idea into final comic-drama video
**Researched:** 2026-04-11

## Table Stakes

Features users expect in any idea-to-video creative platform. Missing = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Project creation with story input** | Users need a container for their creative work — title, story premise, style direction | Low | Already exists; needs refinement (style presets, reference image upload) |
| **Script generation from story prompt** | Core input → first artifact. Users expect AI to expand a rough idea into structured scenes | Medium | DirectorAgent + ScriptwriterAgent exist. Needs scene-level breakdown with dialog, action, camera notes |
| **Character design with name + description + reference image** | Characters are the atomic unit of consistency. Users must see and approve them before storyboard generation | Medium | CharacterArtistAgent exists. Missing: manual character upload, character reference sheets (front/side/expressions) |
| **Storyboard generation per shot** | Users need to preview each shot as a still image before committing to expensive video generation | Medium | StoryboardArtistAgent exists. Needs: shot ordering, camera angle specification, shot duration estimates |
| **Video clip generation per shot** | The core value: turning storyboard stills into short video clips | High | VideoGeneratorAgent exists. Must support image-to-video (I2V) for consistency — text-to-video alone produces inconsistent results |
| **Character consistency across shots** | The #1 complaint in AI video tools (every Reddit/forum thread). Without it, product is unusable for narrative content | High | Current approach: character reference images as input to image/video generation. Needs: IP-Adapter or reference-image pipeline, character binding metadata per shot |
| **Selective re-generation per asset** | AI outputs are probabilistic — users expect to retry individual characters, shots, or clips without restarting the whole pipeline | Medium | ReviewAgent exists. Needs: per-shot re-generate with feedback prompt, per-character re-generate |
| **Real-time progress feedback** | Generation takes minutes. Users need to see what's happening, not stare at a spinner | Medium | WebSocket exists. Needs: per-stage progress bars, estimated time remaining, error visibility |
| **Final video merge & export** | The end state: a single playable video file from all clips | Medium | VideoMergerAgent exists. Needs: transition effects, background music, aspect ratio control, download |
| **Infinite canvas workspace** | Users need spatial overview of all project artifacts — script, characters, storyboards, clips, final video | Medium | tldraw canvas exists. Needs: zoom-to-fit on content changes, card status indicators, click-to-preview |
| **AI provider configuration & swapping** | Users bring their own API keys or use platform defaults. Must be able to change providers without code changes | Low | Config management exists. Needs: provider-level fallback (if provider A fails, try B), cost estimates per provider |
| **Generation cost estimation** | AI generation (especially video) is expensive. Users need to know approximate token/credit cost before running | Low | Not yet implemented. Simple heuristic: character count × N + shot count × M |

## Differentiators

Features that set openOii apart from LTX Studio, Komiko AI, Runway, and other competitors. Not expected, but valued by the target user.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Multi-agent orchestration (8 specialized agents)** | Unlike single-prompt tools, openOii has dedicated agents for onboarding, directing, scripting, character art, storyboard art, video generation, video merging, and review — each optimized for its domain | High | Already exists. Key differentiator: the user doesn't need to be the director AND the prompt engineer AND the video editor |
| **Agent conversation log (chat view)** | Users can see what each agent said and did — transparency into the creative process, not just the output | Low | AgentMessage type + chat component exist. Enhance: allow user to reply to agents mid-generation to steer creative direction |
| **Shot-level prompt editing** | Before regenerating, users can edit the image prompt and video prompt for a specific shot — fine-grained creative control | Low | Edit modal exists for shots. Ensure: prompt changes are reflected in re-generation without full pipeline restart |
| **Style persistence across project** | Once a style is chosen (anime, manga, watercolor, etc.), all generated assets maintain that style — no per-shot style drift | Medium | Style field exists on Project. Needs: style propagated to all agent prompts as system constraint |
| **Resumable generation pipeline** | If generation fails or user closes browser, the pipeline can resume from the last successful stage — no lost work | Medium | AgentRun model exists with status tracking. Needs: checkpoint/save state per stage, resume-from-stage API |
| **Reference image upload for characters** | Users can upload their own character reference (sketch, photo, existing art) instead of relying solely on AI generation | Medium | Not yet implemented. Critical for users who already have character designs they want to animate |
| **Shot timeline preview** | A linear timeline view showing all video clips in sequence with durations — users can see pacing before final merge | Medium | Not yet implemented. Complement to canvas view (spatial) with timeline view (temporal) |
| **Script-to-storyboard visual mapping** | Show which script paragraphs map to which shots — lineage trace from text to visual | Medium | Not yet implemented. Helps users understand and debug: "why does shot 3 look wrong? oh, the script paragraph says X" |
| **Batch shot regeneration with variation** | Re-generate all shots with slight variations (different camera angles, lighting) — A/B creative exploration | High | Not yet implemented. Power feature for creators who want to explore alternatives quickly |

## Anti-Features

Features to explicitly NOT build for v1. Tempting but wrong for this product stage.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Multi-user team collaboration** | v1 target is independent creators. Team features add complexity (permissions, real-time sync, conflict resolution) without proving the core loop | Single-user workspace. Add team features only after solo-creator loop is proven and users ask for collaboration |
| **Marketplace / asset store** | No value without user base. Distracts from core pipeline. Adds moderation, payment, and licensing complexity | Focus on making the generation pipeline work well. Marketplace is a v3+ consideration |
| **Social features / sharing / community** | Premature. Users won't share unfinished work. Adds moderation, CDN, and privacy complexity | Simple video export/download. Social sharing is a post-v1 feature |
| **Native mobile app** | Canvas-based creative workflows are inherently desktop-first. Mobile adds a parallel codebase and design effort | Responsive web for tablet viewing only (read-only preview, not creation) |
| **Custom model training / LoRA fine-tuning** | Extremely complex, requires GPU infrastructure, long training times, and ML expertise. Not a v1 concern | Rely on provider-level models (Claude, Doubao, ModelScope). Let providers handle model improvements |
| **Full video editing suite (transitions, effects, color grading)** | Competing with CapCut/Premiere is a losing battle. openOii's value is AI generation, not post-production | Basic merge with simple crossfade transitions. Export to external editor for advanced work |
| **Voice/dialogue generation (TTS)** | Adds a whole new modality with its own consistency problems (voice matching, lip sync, timing). Not required for comic-drama (silent or music-backed) | Optional v2. Many comic-drama creators use background music + subtitles, not voice |
| **Real-time collaborative editing (Google Docs style)** | Conflicts with the AI-generation workflow. The bottleneck is generation time, not editing speed | Lock-step workflow: user reviews → AI generates → user approves. No simultaneous editing needed |
| **Template library / pre-made projects** | Useful but not blocking for v1. Templates require curation and add surface area | One default template ("comic drama") is enough for v1 |
| **Analytics / usage dashboards** | Single-user tool. Usage stats are nice-to-have, not core value. Adds database complexity | Simple per-project generation log is sufficient |

## Feature Dependencies

```
Project Creation → Script Generation → Character Design → Storyboard Generation → Video Clip Generation → Final Video Merge
       ↑                    ↑                  ↑                    ↑                     ↑                      ↑
       │                    │                  │                    │                     │                      │
  Style Config        Scene Breakdown    Character Approval    Shot Ordering        I2V Consistency        Transition/Music
  Story Input         (per-paragraph)    + Reference Upload     + Duration Est.      + Provider Selection   + Export/Download
```

**Hard dependencies:**
- Script Generation REQUIRES Project Creation (needs story text + style)
- Character Design REQUIRES Script Generation (extracts characters from script)
- Storyboard Generation REQUIRES Character Design (needs character reference images for consistency)
- Video Clip Generation REQUIRES Storyboard Generation (needs first-frame images for I2V)
- Final Video Merge REQUIRES Video Clip Generation (needs all clips in order)

**Soft dependencies (can work independently):**
- Selective Re-generation can happen at ANY stage after the initial artifact exists
- AI Provider Configuration is global and can be changed at any time
- Reference Image Upload can happen before or during Character Design

## MVP Recommendation

**v1 must ship these (non-negotiable for idea-to-final-video closure):**

1. Project creation with story input and style selection
2. Full multi-agent pipeline execution (script → characters → storyboards → clips → merge)
3. Real-time progress visibility via WebSocket
4. Character consistency via reference-image-based I2V
5. Selective per-shot re-generation with prompt editing
6. Final merged video playback and download
7. Infinite canvas showing all project artifacts with status indicators

**v1 should include (high value, moderate effort):**

8. Agent conversation log with creative steering
9. Shot timeline preview (linear view complement to canvas)
10. Resumable generation pipeline (checkpoint + resume)
11. Reference image upload for characters
12. Generation cost estimation before running

**Defer to v2:**

- Batch shot regeneration with variations — requires pipeline-level variation control
- Script-to-storyboard visual mapping — nice for debugging but not blocking
- Background music selection and embedding — adds audio workflow complexity
- Provider-level fallback (auto-switch on failure) — nice for reliability but not core
- Tablet-responsive read-only preview — defer until desktop experience is polished

**Defer to v3+:**

- Multi-user collaboration
- Marketplace / asset store
- Social sharing / community
- Voice/TTS generation
- Advanced video editing (transitions, effects, color grading)
- Custom model training / LoRA fine-tuning

## Sources

- [LTX Studio features](https://ltx.studio/platform/ai-video-generator) — integrated creative studio reference
- [Komiko AI multi-shot video generator](https://komiko.app/video/multi-shot-video-generator) — comic-specific AI video tool
- [AI video creation trends 2026](https://aivideobootcamp.com/blog/ai-video-creation-trends-2026/) — solo creator workflow analysis
- [Character consistency across scenes](https://scribehow.com/page/7_Best_AI_Tools_for_Character_Consistency_Across_Scenes_2026_for_Filmmakers_Designers_and_Creators__B8Q63QIWRyKgulaUFjZF3w) — #1 pain point in AI video
- [Komiko AI comic generator comparison](https://komiko.app/blog/i-tested-10-ai-comic-generators-in-2025-heres-why-komikoai-blew-me-away) — feature matrix for comic generation
- [Reddit: AI video tool comparison](https://www.reddit.com/r/runwayml/comments/1g15tb0/comparison_table_for_the_leading_ai_video_gen/) — user-reported feature gaps
- [openOii existing repository](https://github.com/Xeron2000/openOii) — current implementation baseline

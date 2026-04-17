import { describe, expect, it } from "vitest";

import {
  buildWorkspaceStatus,
  getWorkspaceFinalOutputMeta,
  getWorkspaceSectionStatusBadgeClass,
  getWorkspaceSectionStatusLabel,
  toCreatorStageLabel,
  type WorkspaceProjectionInput,
} from "./workspaceStatus";

const baseInput: WorkspaceProjectionInput = {
  project: {
    id: 1,
    title: "示例项目",
    story: null,
    style: null,
    summary: null,
    video_url: null,
    status: "draft",
    created_at: "2026-04-11T00:00:00Z",
    updated_at: "2026-04-11T00:00:00Z",
    provider_settings: {
      text: {
        override_key: null,
        effective_key: "anthropic",
        source: "default",
      },
      image: {
        override_key: null,
        effective_key: "openai",
        source: "default",
      },
      video: {
        override_key: null,
        effective_key: "openai",
        source: "default",
      },
    },
    text_provider_override: null,
    image_provider_override: null,
    video_provider_override: null,
  },
  currentStage: "ideate",
  runState: "idle",
  characters: [],
  shots: [],
};

describe("buildWorkspaceStatus", () => {
  it.each([
    ["ideate", ["script"]],
    ["visualize", ["script", "characters", "storyboards"]],
    ["animate", ["script", "characters", "storyboards", "clips"]],
    ["deploy", ["script", "characters", "storyboards", "clips", "final-output"]],
  ] as const)("reveals only sections available at %s", (currentStage, expectedKeys) => {
    const result = buildWorkspaceStatus({
      ...baseInput,
      currentStage,
    });

    expect(result.sections.map((section) => section.key)).toEqual(expectedKeys);
  });

  it("keeps empty projects visible with explicit placeholder states", () => {
    const result = buildWorkspaceStatus(baseInput);

    expect(result.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "script",
          placeholder: true,
          state: "draft",
        }),
      ])
    );
  });

  it("keeps visible sections' status semantics intact after reveal", () => {
    const result = buildWorkspaceStatus({
      ...baseInput,
      currentStage: "visualize",
      project: {
        ...baseInput.project,
        summary: "一个侦探在雨夜寻找失踪线索",
      },
    });

    expect(result.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "script",
          placeholder: false,
          state: "generating",
        }),
        expect.objectContaining({
          key: "characters",
          placeholder: true,
          state: "blocked",
        }),
        expect.objectContaining({
          key: "storyboards",
          placeholder: true,
          state: "blocked",
        }),
      ])
    );
  });

  it("marks partially generated sections without hiding the missing ones once visualize has started", () => {
    const result = buildWorkspaceStatus({
      ...baseInput,
      currentStage: "visualize",
      project: {
        ...baseInput.project,
        summary: "一个侦探在雨夜寻找失踪线索",
      },
      characters: [
        {
          id: 1,
          project_id: 1,
          name: "阿宁",
          description: "冷静的侦探",
          image_url: null,
          approval_state: "draft",
          approval_version: 1,
          approved_at: null,
          approved_name: null,
          approved_description: null,
          approved_image_url: null,
        },
      ],
    });

    expect(result.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "script",
          placeholder: false,
          state: "generating",
        }),
        expect.objectContaining({
          key: "characters",
          placeholder: false,
          state: "draft",
        }),
        expect.objectContaining({
          key: "storyboards",
          placeholder: true,
          state: "blocked",
        }),
      ])
    );
  });

  it("keeps superseded lineage visible while preserving current section states", () => {
    const result = buildWorkspaceStatus({
      ...baseInput,
      project: {
        ...baseInput.project,
        status: "superseded",
        summary: "一个已经被新版本替代的项目",
      },
      currentStage: "deploy",
      runState: "completed",
      characters: [
        {
          id: 2,
          project_id: 1,
          name: "阿宁",
          description: "冷静的侦探",
          image_url: "/static/characters/2.png",
          approval_state: "approved",
          approval_version: 2,
          approved_at: "2026-04-11T09:00:00Z",
          approved_name: "阿宁",
          approved_description: "冷静的侦探",
          approved_image_url: "/static/characters/2-approved.png",
        },
      ],
      shots: [
        {
          id: 11,
          project_id: 1,
          order: 1,
          description: "镜头 1",
          prompt: "approved prompt",
          image_prompt: "approved image prompt",
          image_url: "/static/shots/11.png",
          video_url: "/static/shots/11.mp4",
          duration: 10,
          camera: "wide",
          motion_note: "slow pan",
          character_ids: [2],
          approval_state: "approved",
          approval_version: 2,
          approved_at: "2026-04-11T09:10:00Z",
          approved_description: "镜头 1",
          approved_prompt: "approved prompt",
          approved_image_prompt: "approved image prompt",
          approved_duration: 10,
          approved_camera: "wide",
          approved_motion_note: "slow pan",
          approved_character_ids: [2],
        },
      ],
    });

    expect(result.stageLabel).toBe("superseded");
    expect(result.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "characters", state: "complete" }),
        expect.objectContaining({ key: "storyboards", state: "complete" }),
        expect.objectContaining({ key: "clips", state: "complete" }),
      ])
    );
  });

  it("labels current and superseded workspace states distinctly", () => {
    expect(getWorkspaceSectionStatusLabel("complete")).toBe("已完成");
    expect(getWorkspaceSectionStatusLabel("superseded")).toBe("已失效");
    expect(getWorkspaceSectionStatusBadgeClass("complete")).toBe("badge-success");
    expect(getWorkspaceSectionStatusBadgeClass("superseded")).toBe("badge-error");
  });

  it("keeps the final output marked as current or stale without losing provenance copy", () => {
    const currentMeta = getWorkspaceFinalOutputMeta({
      ...baseInput,
      project: {
        ...baseInput.project,
        video_url: "/static/videos/final-current.mp4",
      },
      shots: [
        {
          id: 11,
          project_id: 1,
          order: 1,
          description: "镜头 1",
          prompt: null,
          image_prompt: null,
          image_url: null,
          video_url: "/static/shots/11.mp4",
          duration: 6,
          camera: null,
          motion_note: null,
          character_ids: [],
          approval_state: "approved",
          approval_version: 1,
          approved_at: null,
          approved_description: null,
          approved_prompt: null,
          approved_image_prompt: null,
          approved_duration: null,
          approved_camera: null,
          approved_motion_note: null,
          approved_character_ids: [],
        },
      ],
    });

    const staleMeta = getWorkspaceFinalOutputMeta({
      ...baseInput,
      project: {
        ...baseInput.project,
        status: "superseded",
        video_url: "/static/videos/final-stale.mp4",
      },
      shots: [
        {
          id: 11,
          project_id: 1,
          order: 1,
          description: "镜头 1",
          prompt: null,
          image_prompt: null,
          image_url: null,
          video_url: "/static/shots/11.mp4",
          duration: 6,
          camera: null,
          motion_note: null,
          character_ids: [],
          approval_state: "approved",
          approval_version: 1,
          approved_at: null,
          approved_description: null,
          approved_prompt: null,
          approved_image_prompt: null,
          approved_duration: null,
          approved_camera: null,
          approved_motion_note: null,
          approved_character_ids: [],
        },
      ],
    });

    expect(currentMeta.sectionState).toBe("complete");
    expect(currentMeta.statusLabel).toBe("已完成");
    expect(currentMeta.provenanceText).toContain("当前成片");

    expect(staleMeta.sectionState).toBe("superseded");
    expect(staleMeta.statusLabel).toBe("已失效");
    expect(staleMeta.provenanceText).toContain("已被新版本替代");
  });

  it("surfaces blocking copy when the final output is still waiting on clips", () => {
    const meta = getWorkspaceFinalOutputMeta(baseInput);

    expect(meta.sectionState).toBe("blocked");
    expect(meta.blockingText).toContain("分镜");
    expect(meta.downloadUrl).toBe("/api/v1/projects/1/final-video");
  });
});

describe("toCreatorStageLabel", () => {
  it.each([
    [{ runState: "awaiting_confirm" as const }, "waiting-for-review"],
    [{ runState: "blocked" as const }, "blocked"],
    [{ runState: "running" as const }, "generating"],
    [{ runState: "failed" as const }, "failed"],
    [{ runState: "completed" as const }, "complete"],
    [
      {
        runState: "running" as const,
        artifactState: "superseded" as const,
      },
      "superseded",
    ],
  ])("maps %# to %s", (input, expected) => {
    expect(toCreatorStageLabel(input)).toBe(expected);
  });
});

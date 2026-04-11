import { describe, expect, it } from "vitest";

import {
  buildWorkspaceStatus,
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
  },
  currentStage: "ideate",
  runState: "idle",
  characters: [],
  shots: [],
};

describe("buildWorkspaceStatus", () => {
  it("always returns the five canonical sections in order", () => {
    const result = buildWorkspaceStatus(baseInput);

    expect(result.sections.map((section) => section.key)).toEqual([
      "script",
      "characters",
      "storyboards",
      "clips",
      "final-output",
    ]);
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
        expect.objectContaining({
          key: "clips",
          placeholder: true,
          state: "blocked",
        }),
        expect.objectContaining({
          key: "final-output",
          placeholder: true,
          state: "blocked",
        }),
      ])
    );
  });

  it("marks partially generated sections without hiding the missing ones", () => {
    const result = buildWorkspaceStatus({
      ...baseInput,
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

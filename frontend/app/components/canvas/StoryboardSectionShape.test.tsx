import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StoryboardSectionShapeUtil } from "./shapes/StoryboardSectionShape";
import type { StoryboardSectionShape } from "./shapes/types";

vi.mock("~/services/api", () => ({
  getStaticUrl: (path: string | null | undefined) => path,
}));

describe("StoryboardSectionShape", () => {
  const shapeUtil = new StoryboardSectionShapeUtil();

  const createShape = (props: Partial<StoryboardSectionShape["props"]> = {}) =>
    ({
      id: "shot-shape",
      type: "storyboard-section",
      x: 0,
      y: 0,
      props: {
        w: 800,
        h: 500,
        shots: [
          {
            id: 11,
            project_id: 1,
            order: 1,
            description: "阿宁走进雨夜街道",
            prompt: "Wide shot of a detective in the rain",
            image_prompt: "雨夜街道，侦探，电影感",
            image_url: "/static/shots/1.png",
            video_url: "/static/shots/1.mp4",
            duration: 7,
            camera: "wide",
            motion_note: "slow push in",
            character_ids: [1, 2],
            approval_state: "approved",
            approval_version: 3,
            approved_at: "2026-04-11T10:10:00Z",
            approved_description: "阿宁走进雨夜街道",
            approved_prompt: "Wide shot of a detective in the rain",
            approved_image_prompt: "雨夜街道，侦探，电影感",
            approved_duration: 7,
            approved_camera: "wide",
            approved_motion_note: "slow push in",
            approved_character_ids: [1, 2],
          },
        ],
        ...props,
      },
    }) as StoryboardSectionShape;

  it("shows shot approval state, bound cast, intent, and controls", () => {
    render(shapeUtil.component(createShape()));

    expect(screen.getByText("已批准")).toBeInTheDocument();
    expect(screen.getByText(/绑定角色/i)).toBeInTheDocument();
    expect(screen.getByText(/镜头意图/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /批准分镜/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /重新审核/i })).toBeInTheDocument();
  });

  it("keeps only the current approved state visible for superseded shots", () => {
    render(
      shapeUtil.component(
        createShape({
          shots: [
            {
              id: 12,
              project_id: 1,
              order: 2,
              description: "旧镜头",
              prompt: "old prompt",
              image_prompt: "old image prompt",
              image_url: null,
              video_url: null,
              duration: 5,
              camera: "close",
              motion_note: "old motion",
              character_ids: [3],
              approval_state: "superseded",
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
        })
      )
    );

    expect(screen.getByText("已失效")).toBeInTheDocument();
    expect(screen.queryByText(/approval_version/i)).not.toBeInTheDocument();
  });
});

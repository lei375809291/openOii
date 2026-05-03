import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { VideoSectionShape } from "./types";
import { VideoSectionShapeUtil } from "./VideoSectionShape";

vi.mock("~/services/api", () => ({
  getStaticUrl: (path: string | null | undefined) => path,
}));

describe("VideoSectionShape", () => {
  const shapeUtil = new VideoSectionShapeUtil({} as never);

  const createShape = (
    props: Partial<VideoSectionShape["props"]> = {}
  ) =>
    ({
      id: "video-shape",
      type: "video-section",
      x: 0,
      y: 0,
      props: {
        w: 600,
        h: 450,
        projectId: 7,
        videoUrl: "/static/videos/final-current.mp4",
        title: "创意项目",
        downloadUrl: "/api/v1/projects/7/final-video",
        sectionState: "complete",
        placeholder: false,
        statusLabel: "已完成",
        placeholderText: "等待视频合成...",
        provenanceText: "来源：当前成片",
        blockingText: "",
        retryFeedback: "请基于现有镜头重新合成最终视频。",
        retryRunId: 42,
        retryThreadId: "thread_42",
        ...props,
      },
    }) as VideoSectionShape;

  it("shows video element with title", () => {
    render(shapeUtil.component(createShape()));

    expect(screen.getByLabelText("创意项目")).toBeInTheDocument();
  });

  it("shows blocking text when present", () => {
    render(
      shapeUtil.component(
        createShape({
          blockingText: "视频生成中，请稍候...",
        })
      )
    );

    expect(screen.getByText("视频生成中，请稍候...")).toBeInTheDocument();
  });

  it("shows placeholder when no video", () => {
    render(
      shapeUtil.component(
        createShape({
          videoUrl: "",
          placeholder: true,
          placeholderText: "等待视频合成...",
        })
      )
    );

    expect(screen.getByText("等待视频合成...")).toBeInTheDocument();
  });
});

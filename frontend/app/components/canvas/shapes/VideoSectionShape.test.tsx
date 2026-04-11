import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { canvasEvents } from "../canvasEvents";
import { VideoSectionShapeUtil } from "./VideoSectionShape";
import type { VideoSectionShape } from "./types";

vi.mock("~/services/api", () => ({
  getStaticUrl: (path: string | null | undefined) => path,
}));

const emit = vi.spyOn(canvasEvents, "emit");

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
        previewLabel: "预览最终视频",
        downloadLabel: "下载最终视频",
        retryLabel: "重试合成",
        retryFeedback: "请基于现有镜头重新合成最终视频。",
        retryRunId: 42,
        retryThreadId: "thread_42",
        ...props,
      },
    }) as VideoSectionShape;

  it("shows preview, download, and retry controls for the final output", () => {
    render(shapeUtil.component(createShape()));

    expect(screen.getByText("来源：当前成片")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "预览最终视频" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下载最终视频" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试合成" })).toBeInTheDocument();
  });

  it("emits preview and retry events with the final-output recovery context", async () => {
    const { container } = render(shapeUtil.component(createShape()));

    await screen.getByRole("button", { name: "预览最终视频" }).click();
    await screen.getByRole("button", { name: "重试合成" }).click();

    expect(emit).toHaveBeenCalledWith("preview-video", {
      src: "/static/videos/final-current.mp4",
      title: "创意项目",
    });
    expect(emit).toHaveBeenCalledWith("retry-final-output", {
      projectId: 7,
      runId: 42,
      threadId: "thread_42",
      feedback: "请基于现有镜头重新合成最终视频。",
    });
    expect(container).toBeTruthy();
  });

  it("marks stale final output with explicit provenance copy", () => {
    render(
      shapeUtil.component(
        createShape({
          sectionState: "superseded",
          statusLabel: "已失效",
          provenanceText: "来源：上一次合成结果，已被新版本替代",
        })
      )
    );

    expect(
      screen.getByText("来源：上一次合成结果，已被新版本替代")
    ).toBeInTheDocument();
    expect(screen.getByText("已失效")).toBeInTheDocument();
  });
});

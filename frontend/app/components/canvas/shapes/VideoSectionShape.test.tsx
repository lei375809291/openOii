import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { canvasEvents } from "../canvasEvents";
import type { VideoSectionShape } from "./types";
import { VideoSectionShapeUtil } from "./VideoSectionShape";

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
        retryFeedback: "请基于现有镜头重新合成最终视频。",
        retryRunId: 42,
        retryThreadId: "thread_42",
        ...props,
      },
    }) as VideoSectionShape;

  it("shows download and retry controls for the final output", () => {
    render(shapeUtil.component(createShape()));

    expect(screen.getByRole("button", { name: "下载" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });

  it("emits retry event with the final-output recovery context", async () => {
    render(shapeUtil.component(createShape()));

    await screen.getByRole("button", { name: "重试" }).click();

    expect(emit).toHaveBeenCalledWith("retry-final-output", {
      projectId: 7,
      runId: 42,
      threadId: "thread_42",
      feedback: "请基于现有镜头重新合成最终视频。",
    });
  });

  it("falls back to direct download when the controlled final-video route fails", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
      blob: async () => new Blob(["not-found"]),
    } as never);
    const openMock = vi.spyOn(window, "open").mockImplementation(() => null);

    render(shapeUtil.component(createShape()));

    await user.click(screen.getByRole("button", { name: "下载" }));

    expect(openMock).toHaveBeenCalledWith("/api/v1/projects/7/final-video", "_blank");

    fetchMock.mockRestore();
    openMock.mockRestore();
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
});

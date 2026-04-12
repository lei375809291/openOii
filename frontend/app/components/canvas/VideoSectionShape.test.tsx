import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SHAPE_TYPES } from "./shapes";
import { useCanvasLayout } from "~/hooks/useCanvasLayout";

describe("useCanvasLayout", () => {
  it("keeps the final output section visible for an empty workspace", () => {
    const { result } = renderHook(() =>
      useCanvasLayout({
        projectId: 7,
        summary: null,
        characters: [],
        shots: [],
        videoUrl: null,
        videoTitle: "最终视频",
      })
    );

    const finalOutput = result.current.find(
      (shape) => shape.type === SHAPE_TYPES.VIDEO_SECTION
    );

    expect(finalOutput).toMatchObject({
      type: SHAPE_TYPES.VIDEO_SECTION,
      props: expect.objectContaining({
        placeholder: true,
        sectionState: "blocked",
        statusLabel: "待生成",
        placeholderText: "等待最终输出...",
        title: "最终视频",
      }),
    });
  });
});

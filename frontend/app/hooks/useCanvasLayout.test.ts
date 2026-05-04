import { describe, it, expect } from "vitest";
import { useCanvasLayout } from "./useCanvasLayout";
import { renderHook } from "@testing-library/react";
import type { WorkspaceStatus } from "~/utils/workspaceStatus";

const defaultProps = {
  projectId: 1,
  story: "test story",
  summary: "test summary",
  characters: [],
  shots: [],
  videoUrl: null,
  videoTitle: "Video",
};

describe("useCanvasLayout", () => {
  it("returns shapes array", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    expect(Array.isArray(result.current)).toBe(true);
    expect(result.current.length).toBeGreaterThan(0);
  });

  it("includes script shape", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    const scriptShape = result.current.find(s => (s.id as string).includes("script"));
    expect(scriptShape).toBeDefined();
  });

  it("includes characters shape", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    const charShape = result.current.find(s => (s.id as string).includes("characters"));
    expect(charShape).toBeDefined();
  });

  it("includes connector shapes between sections", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    const connectors = result.current.filter(s => (s.id as string).includes("connector"));
    expect(connectors.length).toBeGreaterThan(0);
  });

  it("uses workspace status when provided", () => {
    const status: WorkspaceStatus = {
      stageLabel: "generating",
      sections: [
        { key: "script" as const, title: "剧本", state: "generating" as const, placeholder: false },
        { key: "characters" as const, title: "角色", state: "blocked" as const, placeholder: true },
        { key: "storyboards" as const, title: "分镜", state: "blocked" as const, placeholder: true },
        { key: "clips" as const, title: "片段", state: "blocked" as const, placeholder: true },
        { key: "final-output" as const, title: "最终输出", state: "blocked" as const, placeholder: true },
      ],
    };
    const { result } = renderHook(() =>
      useCanvasLayout({ ...defaultProps, workspaceStatus: status })
    );
    expect(result.current.length).toBeGreaterThan(0);
  });
});

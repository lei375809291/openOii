import { describe, it, expect } from "vitest";
import { useCanvasLayout } from "./useCanvasLayout";
import { renderHook } from "@testing-library/react";
import type { SectionKey } from "./useCanvasLayout";

const defaultProps = {
  projectId: 1,
  story: "test story",
  summary: "test summary",
  characters: [],
  shots: [],
  videoUrl: null,
  videoTitle: "Video",
  visibleSections: ["plan", "character"] as SectionKey[],
  isGenerating: false,
  awaitingConfirm: false,
  currentRunId: null,
  currentStage: "plan" as const,
};

function getBoardProps(result: ReturnType<typeof useCanvasLayout>) {
  const board = result.shapes[0];
  if (!board?.props) throw new Error("Expected storyboard board props");
  return board.props;
}

describe("useCanvasLayout", () => {
  it("returns one storyboard board shape", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    expect(result.current.shapes).toHaveLength(1);
    expect(result.current.shapes[0]?.type).toBe("storyboard-board");
  });

  it("stores visible sections on the board", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    expect(getBoardProps(result.current).visibleSections).toEqual(["plan", "character"]);
  });

  it("keeps the layout as a single board shape", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    expect(result.current.shapes.map((s) => s.type)).toEqual(["storyboard-board"]);
  });

  it("omits sections not in visibleSections", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    const composeShape = result.current.shapes.find((s) => (s.id as string).includes("compose"));
    expect(composeShape).toBeUndefined();
  });

  it("marks generating state correctly", () => {
    const { result } = renderHook(() =>
      useCanvasLayout({
        ...defaultProps,
        isGenerating: true,
        story: null,
        summary: null,
        visibleSections: ["plan"] as SectionKey[],
      }),
    );
    expect(getBoardProps(result.current).sectionStates?.plan).toBe("generating");
  });

  it("marks complete state correctly", () => {
    const { result } = renderHook(() =>
      useCanvasLayout({
        ...defaultProps,
        story: "hello",
        summary: "world",
        visibleSections: ["plan"] as SectionKey[],
      }),
    );
    expect(getBoardProps(result.current).sectionStates?.plan).toBe("complete");
  });
});

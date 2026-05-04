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
  visibleSections: ["script", "characters"] as SectionKey[],
  isGenerating: false,
  awaitingConfirm: false,
  currentRunId: null,
  currentStage: "ideate" as const,
};

describe("useCanvasLayout", () => {
  it("returns shapes array", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    expect(Array.isArray(result.current)).toBe(true);
    expect(result.current.length).toBeGreaterThan(0);
  });

  it("includes script shape", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    const scriptShape = result.current.find((s) => (s.id as string).includes("script"));
    expect(scriptShape).toBeDefined();
  });

  it("includes characters shape when visible", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    const charShape = result.current.find((s) => (s.id as string).includes("characters"));
    expect(charShape).toBeDefined();
  });

  it("includes connector shapes between sections", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    const connectors = result.current.filter((s) => (s.id as string).includes("connector"));
    expect(connectors.length).toBeGreaterThan(0);
  });

  it("omits sections not in visibleSections", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    const finalOutput = result.current.find((s) => (s.id as string).includes("final-output"));
    expect(finalOutput).toBeUndefined();
  });

  it("marks generating state correctly", () => {
    const { result } = renderHook(() =>
      useCanvasLayout({
        ...defaultProps,
        isGenerating: true,
        story: null,
        summary: null,
        visibleSections: ["script"] as SectionKey[],
      }),
    );
    const scriptShape = result.current.find((s) => (s.id as string).includes("script"));
    expect((scriptShape?.props as any).sectionState).toBe("generating");
  });

  it("marks complete state correctly", () => {
    const { result } = renderHook(() =>
      useCanvasLayout({
        ...defaultProps,
        story: "hello",
        summary: "world",
        visibleSections: ["script"] as SectionKey[],
      }),
    );
    const scriptShape = result.current.find((s) => (s.id as string).includes("script"));
    expect((scriptShape?.props as any).sectionState).toBe("complete");
  });
});

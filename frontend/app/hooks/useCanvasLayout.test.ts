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
  visibleSections: ["plan", "render"] as SectionKey[],
  isGenerating: false,
  awaitingConfirm: false,
  currentRunId: null,
  currentStage: "plan" as const,
};

describe("useCanvasLayout", () => {
  it("returns shapes array", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    expect(Array.isArray(result.current)).toBe(true);
    expect(result.current.length).toBeGreaterThan(0);
  });

  it("includes plan shape", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    const planShape = result.current.find((s) => (s.id as string).includes("plan"));
    expect(planShape).toBeDefined();
  });

  it("includes render shape when visible", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    const renderShape = result.current.find((s) => (s.id as string).includes("render"));
    expect(renderShape).toBeDefined();
  });

  it("includes connector shapes between sections", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    const connectors = result.current.filter((s) => (s.id as string).includes("connector"));
    expect(connectors.length).toBeGreaterThan(0);
  });

  it("omits sections not in visibleSections", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    const composeShape = result.current.find((s) => (s.id as string).includes("compose"));
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
    const planShape = result.current.find((s) => (s.id as string).includes("plan"));
    expect((planShape?.props as any).sectionState).toBe("generating");
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
    const planShape = result.current.find((s) => (s.id as string).includes("plan"));
    expect((planShape?.props as any).sectionState).toBe("complete");
  });
});

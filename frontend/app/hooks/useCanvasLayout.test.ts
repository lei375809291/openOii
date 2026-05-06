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

describe("useCanvasLayout", () => {
  it("returns layout with shapes and bindings", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    expect(result.current.shapes.length).toBeGreaterThan(0);
  });

  it("includes plan shape", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    const planShape = result.current.shapes.find((s) => (s.id as string).includes("plan"));
    expect(planShape).toBeDefined();
  });

  it("includes character shape when visible", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    const characterShape = result.current.shapes.find((s) => (s.id as string).includes("character"));
    expect(characterShape).toBeDefined();
  });

  it("creates section shapes without arrows", () => {
    const { result } = renderHook(() => useCanvasLayout(defaultProps));
    const arrows = result.current.shapes.filter((s) => s.type === "arrow");
    expect(arrows.length).toBe(0);
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
    const planShape = result.current.shapes.find((s) => (s.id as string).includes("plan"));
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
    const planShape = result.current.shapes.find((s) => (s.id as string).includes("plan"));
    expect((planShape?.props as any).sectionState).toBe("complete");
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScriptSectionShapeUtil } from "./shapes/ScriptSectionShape";
import type { ScriptSectionShape, ReviewedCharacter, ReviewedShot } from "./shapes/types";

vi.mock("~/services/api", () => ({
  getStaticUrl: (path: string | null | undefined) => path,
}));

describe("ScriptSectionShape", () => {
  const shapeUtil = new ScriptSectionShapeUtil({} as never);

  const createShape = (props: Partial<ScriptSectionShape["props"]> = {}) =>
    ({
      id: "script-shape",
      type: "script-section",
      x: 0,
      y: 0,
      props: {
        w: 800,
        h: 600,
        story: "阿宁走进雨夜的街道，霓虹灯映在积水中。",
        summary: "侦探在雨夜调查案件",
        characters: [],
        shots: [],
        sectionState: "complete",
        placeholder: false,
        statusLabel: "已完成",
        placeholderText: "等待编剧生成...",
        ...props,
      },
    }) as ScriptSectionShape;

  it("renders story text when present", () => {
    render(shapeUtil.component(createShape()));
    expect(screen.getByText(/阿宁走进雨夜的街道/)).toBeInTheDocument();
  });

  it("renders summary below story when both present", () => {
    render(shapeUtil.component(createShape()));
    expect(screen.getByText("侦探在雨夜调查案件")).toBeInTheDocument();
  });

  it("renders summary alone when story is empty", () => {
    render(shapeUtil.component(createShape({ story: "", summary: "仅摘要" })));
    expect(screen.getByText("仅摘要")).toBeInTheDocument();
  });

  it("renders character and shot counts when no story/summary", () => {
    const chars = [{ id: 1, name: "阿宁" }] as unknown as ReviewedCharacter[];
    const shotsList = [{ id: 1 }, { id: 2 }, { id: 3 }] as unknown as ReviewedShot[];
    render(
      shapeUtil.component(
        createShape({
          story: "",
          summary: "",
          characters: chars,
          shots: shotsList,
        })
      )
    );
    expect(screen.getByText(/阿宁/)).toBeInTheDocument();
    expect(screen.getByText(/3 个镜头/)).toBeInTheDocument();
  });

  it("renders placeholder when no content", () => {
    render(
      shapeUtil.component(
        createShape({
          story: "",
          summary: "",
          placeholder: true,
          placeholderText: "等待编剧生成...",
        })
      )
    );
    expect(screen.getByText("等待编剧生成...")).toBeInTheDocument();
  });

  it("returns null indicator", () => {
    expect(shapeUtil.indicator()).toBeNull();
  });

  it("has correct static type", () => {
    expect(ScriptSectionShapeUtil.type).toBe("script-section");
  });

  it("cannot edit or resize", () => {
    expect(shapeUtil.canEdit()).toBe(false);
    expect(shapeUtil.canResize()).toBe(false);
  });
});

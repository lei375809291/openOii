import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CharacterSectionShapeUtil } from "./shapes/CharacterSectionShape";
import type { CharacterSectionShape } from "./shapes/types";

vi.mock("~/services/api", () => ({
  getStaticUrl: (path: string | null | undefined) => path,
}));

describe("CharacterSectionShape", () => {
  const shapeUtil = new CharacterSectionShapeUtil({} as never);

  const createShape = (props: Partial<CharacterSectionShape["props"]> = {}) =>
    ({
      id: "char-shape",
      type: "character-section",
      x: 0,
      y: 0,
      props: {
        w: 800,
        h: 400,
        characters: [
          {
            id: 1,
            project_id: 1,
            name: "阿宁",
            description: "冷静的侦探",
            image_url: "/static/characters/aning.png",
            approval_state: "approved",
            approval_version: 2,
            approved_at: "2026-04-11T10:00:00Z",
            approved_name: "阿宁",
            approved_description: "冷静的侦探",
            approved_image_url: "/static/characters/aning-approved.png",
          },
        ],
        ...props,
      },
    }) as CharacterSectionShape;

  it("shows approval state dot and character info", () => {
    render(shapeUtil.component(createShape()));

    expect(screen.getByText("阿宁")).toBeInTheDocument();
    expect(screen.getByText("冷静的侦探")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
  });

  it("marks superseded characters with neutral dot", () => {
    render(
      shapeUtil.component(
        createShape({
          characters: [
            {
              id: 2,
              project_id: 1,
              name: "旧阿宁",
              description: "旧版本",
              image_url: "/static/characters/old.png",
              approval_state: "superseded",
              approval_version: 1,
              approved_at: null,
              approved_name: null,
              approved_description: null,
              approved_image_url: null,
            },
          ],
        })
      )
    );

    expect(screen.getByText("旧阿宁")).toBeInTheDocument();
    expect(screen.queryByText(/version/i)).not.toBeInTheDocument();
  });
});

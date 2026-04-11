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

  it("shows the current approval state and review controls", () => {
    render(shapeUtil.component(createShape()));

    expect(screen.getByText("已批准")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /批准角色/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /重新审核/i })).toBeInTheDocument();
  });

  it("marks superseded characters without exposing version history", () => {
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

    expect(screen.getByText("已失效")).toBeInTheDocument();
    expect(screen.queryByText(/version/i)).not.toBeInTheDocument();
  });
});

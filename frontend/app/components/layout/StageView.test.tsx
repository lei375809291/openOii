import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StageView } from "./StageView";

vi.mock("~/stores/editorStore", () => ({
  useEditorStore: () => ({
    currentStage: "ideate",
    shots: [],
    characters: [],
  }),
}));

vi.mock("~/components/canvas/Canvas", () => ({
  Canvas: ({ projectId }: { projectId: number }) => (
    <div data-testid="projected-canvas">project:{projectId}</div>
  ),
}));

describe("StageView projected shell", () => {
  it("opens empty ideate projects into the projected canvas shell", () => {
    render(<StageView projectId={42} />);

    expect(screen.getByTestId("projected-canvas")).toHaveTextContent("project:42");
    expect(screen.queryByText("构思你的故事")).not.toBeInTheDocument();
  });
});

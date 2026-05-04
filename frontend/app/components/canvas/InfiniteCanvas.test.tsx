import { render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InfiniteCanvas } from "./InfiniteCanvas";

const useCanvasLayoutMock = vi.hoisted(() =>
  vi.fn((args: any) =>
    (args.visibleSections ?? []).map((key: string, index: number) => ({
      id: `shape:${key}`,
      type: "mock-shape",
      x: 0,
      y: index * 100,
      props: { w: 100, h: 100 },
    }))
  )
);

const mockEditor = vi.hoisted(() => {
  let shapes: Array<{ id: string }> = [];

  const editor: any = {
    createShapes: vi.fn((nextShapes: Array<{ id: string }>) => {
      shapes = nextShapes.map((shape) => ({ ...shape }));
    }),
    updateShapes: vi.fn((nextShapes: Array<{ id: string }>) => {
      for (const shape of nextShapes) {
        shapes = shapes.map((current) => (current.id === shape.id ? { ...current, ...shape } : current));
      }
    }),
    deleteShapes: vi.fn((ids: string[]) => {
      shapes = shapes.filter((shape) => !ids.includes(shape.id));
    }),
    getCurrentPageShapes: vi.fn(() => shapes.map((shape) => ({ ...shape }))),
    zoomToFit: vi.fn(),
    reset() {
      shapes = [];
      editor.createShapes.mockClear();
      editor.updateShapes.mockClear();
      editor.deleteShapes.mockClear();
      editor.getCurrentPageShapes.mockClear();
      editor.zoomToFit.mockClear();
    },
  };

  return editor;
});

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: {
      id: 1,
      title: "测试项目",
      story: "一个侦探在雨夜的城市中寻找真相",
      style: null,
      summary: "创作了3个角色和8个镜头的剧本",
      video_url: null,
      status: "active",
      created_at: "2026-04-11T00:00:00Z",
      updated_at: "2026-04-11T00:00:00Z",
    },
  }),
}));

vi.mock("tldraw", () => ({
  Tldraw: ({ children, onMount }: { children: React.ReactNode; onMount: (editor: any) => void }) => {
    useEffect(() => {
      onMount(mockEditor);
    }, [onMount]);

    return <div>{children}</div>;
  },
}));

vi.mock("./CanvasToolbar", () => ({
  CanvasToolbar: () => <div data-testid="canvas-toolbar" />,
}));

vi.mock("./shapes", () => ({
  customShapeUtils: [],
}));

vi.mock("~/hooks/useCanvasLayout", () => ({
  useCanvasLayout: useCanvasLayoutMock,
}));

beforeEach(() => {
  mockEditor.reset();
  vi.clearAllMocks();
});

vi.mock("~/stores/editorStore", () => ({
  useEditorStore: () => ({
    characters: [
      {
        id: 1,
        project_id: 1,
        name: "阿宁",
        description: "冷静的侦探",
        image_url: null,
        approval_state: "draft",
        approval_version: 1,
        approved_at: null,
        approved_name: null,
        approved_description: null,
        approved_image_url: null,
      },
    ],
    shots: [
      {
        id: 11,
        project_id: 1,
        order: 1,
        description: "阿宁走进雨夜街道",
        prompt: "prompt",
        image_prompt: "image prompt",
        image_url: null,
        video_url: null,
        duration: 7,
        camera: "wide",
        motion_note: "slow push in",
        scene: null, action: null, expression: null, lighting: null, dialogue: null, sfx: null,
        character_ids: [1],
        approval_state: "draft",
        approval_version: 1,
        approved_at: null,
        approved_description: null,
        approved_prompt: null,
        approved_image_prompt: null,
        approved_duration: null,
        approved_camera: null,
        approved_motion_note: null,
        approved_scene: null, approved_action: null, approved_expression: null,
        approved_lighting: null, approved_dialogue: null, approved_sfx: null,
        approved_character_ids: [],
      },
    ],
    projectVideoUrl: null,
    currentStage: "render",
    recoverySummary: null,
  }),
}));

vi.mock("~/services/api", () => ({
  projectsApi: {
    get: () => Promise.resolve({}),
  },
  getStaticUrl: (path: string | null | undefined) => path,
}));

describe("InfiniteCanvas", () => {
  it("only mounts sections that are revealed for the current stage", async () => {
    render(<InfiniteCanvas projectId={1} />);

    await waitFor(() => {
      expect(useCanvasLayoutMock).toHaveBeenCalled();
    });

    expect(useCanvasLayoutMock.mock.calls[0]?.[0].visibleSections).toEqual([
      "plan",
      "render",
    ]);
    expect(mockEditor.createShapes).toHaveBeenCalledWith([
      expect.objectContaining({ id: "shape:plan" }),
      expect.objectContaining({ id: "shape:render" }),
    ]);
  });

  it("passes story and summary to canvas layout", async () => {
    render(<InfiniteCanvas projectId={1} />);

    await waitFor(() => {
      expect(useCanvasLayoutMock).toHaveBeenCalled();
    });

    expect(useCanvasLayoutMock.mock.calls[0]?.[0].story).toBe("一个侦探在雨夜的城市中寻找真相");
    expect(useCanvasLayoutMock.mock.calls[0]?.[0].summary).toBe("创作了3个角色和8个镜头的剧本");
  });

  it("does not rewrite the projected canvas when backend data is unchanged", async () => {
    const { rerender } = render(<InfiniteCanvas projectId={1} />);

    await waitFor(() => {
      expect(mockEditor.createShapes).toHaveBeenCalled();
    });

    mockEditor.createShapes.mockClear();
    mockEditor.updateShapes.mockClear();
    mockEditor.deleteShapes.mockClear();

    rerender(<InfiniteCanvas projectId={1} />);

    expect(mockEditor.createShapes).not.toHaveBeenCalled();
    expect(mockEditor.updateShapes).not.toHaveBeenCalled();
    expect(mockEditor.deleteShapes).not.toHaveBeenCalled();
  });
});

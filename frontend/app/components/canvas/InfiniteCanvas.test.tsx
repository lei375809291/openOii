import { render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { canvasEvents } from "./canvasEvents";
import { InfiniteCanvas } from "./InfiniteCanvas";
import { charactersApi, shotsApi } from "~/services/api";

const updateCharacter = vi.fn();
const updateShot = vi.fn();

const mockEditor = vi.hoisted(() => {
  let shapes: Array<{ id: string }> = [];

  const editor: any = {
    createShapes: vi.fn((nextShapes: Array<{ id: string }>) => {
      shapes = nextShapes.map((shape) => ({ ...shape }));
    }),
    createShape: vi.fn((shape: { id: string }) => {
      shapes = [...shapes, { ...shape }];
    }),
    updateShape: vi.fn((shape: { id: string }) => {
      shapes = shapes.map((current) => (current.id === shape.id ? { ...current, ...shape } : current));
    }),
    deleteShapes: vi.fn((ids: string[]) => {
      shapes = shapes.filter((shape) => !ids.includes(shape.id));
    }),
    getCurrentPageShapes: vi.fn(() => shapes.map((shape) => ({ ...shape }))),
    zoomToFit: vi.fn(),
    reset() {
      shapes = [];
      editor.createShapes.mockClear();
      editor.createShape.mockClear();
      editor.updateShape.mockClear();
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
      story: null,
      style: null,
      summary: "故事摘要",
      video_url: null,
      status: "active",
      created_at: "2026-04-11T00:00:00Z",
      updated_at: "2026-04-11T00:00:00Z",
    },
  }),
  useMutation: (config: any) => {
    const mutate = vi.fn((variables: any, callbacks?: any) => {
      const result = config?.mutationFn?.(variables);

      if (result && typeof result.then === "function") {
        return result.then((value: any) => {
          config?.onSuccess?.(value, variables, undefined);
          callbacks?.onSuccess?.(value);
          return value;
        });
      }

      config?.onSuccess?.(result, variables, undefined);
      callbacks?.onSuccess?.(result);
      return result;
    });

    return {
      mutate,
      mutateAsync: async (variables: any) => {
        const value = await config?.mutationFn?.(variables);
        config?.onSuccess?.(value, variables, undefined);
        return value;
      },
      isPending: false,
    };
  },
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
  useCanvasLayout: () => [
    {
      id: "shape:script",
      type: "mock-shape",
      x: 0,
      y: 0,
      props: { w: 100, h: 100 },
    },
  ],
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
        approved_character_ids: [],
      },
    ],
    projectVideoUrl: null,
    updateCharacter,
    updateShot,
    removeCharacter: vi.fn(),
    removeShot: vi.fn(),
  }),
}));

vi.mock("~/services/api", () => ({
  projectsApi: {
    get: () => Promise.resolve({}),
  },
  charactersApi: {
    approve: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn(),
    regenerate: vi.fn(),
    delete: vi.fn(),
  },
  shotsApi: {
    approve: vi.fn().mockResolvedValue({ id: 11 }),
    update: vi.fn(),
    regenerate: vi.fn(),
    delete: vi.fn(),
  },
  getStaticUrl: (path: string | null | undefined) => path,
}));

describe("InfiniteCanvas approve wiring", () => {
  it("routes approve-character and approve-shot events to backend mutations", async () => {
    render(<InfiniteCanvas projectId={1} />);

    canvasEvents.emit("approve-character", { id: 1 });
    canvasEvents.emit("approve-shot", { id: 11 });

    await waitFor(() => {
      expect(charactersApi.approve).toHaveBeenCalledWith(1);
      expect(shotsApi.approve).toHaveBeenCalledWith(11);
    });
  });

  it("does not rewrite the projected canvas when backend data is unchanged", async () => {
    const { rerender } = render(<InfiniteCanvas projectId={1} />);

    await waitFor(() => {
      expect(mockEditor.createShapes).toHaveBeenCalled();
    });

    mockEditor.createShapes.mockClear();
    mockEditor.createShape.mockClear();
    mockEditor.updateShape.mockClear();
    mockEditor.deleteShapes.mockClear();

    rerender(<InfiniteCanvas projectId={1} />);

    expect(mockEditor.createShapes).not.toHaveBeenCalled();
    expect(mockEditor.createShape).not.toHaveBeenCalled();
    expect(mockEditor.updateShape).not.toHaveBeenCalled();
    expect(mockEditor.deleteShapes).not.toHaveBeenCalled();
  });
});

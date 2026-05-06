import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, type TLShapeId } from "tldraw";
import { projectsApi } from "~/services/api";
import { useEditorStore } from "~/stores/editorStore";
import { toast } from "~/utils/toast";
import { SHAPE_TYPES, type StoryboardBoardShape } from "./shapes/types";

interface MenuPosition {
  x: number;
  y: number;
}

interface ShapeContext {
  shapeType: string;
  shapeId: string;
  feedbackType: "plan" | "compose";
}

const ACTIONS: Record<string, { label: string; action: string }[]> = {
  [SHAPE_TYPES.STORYBOARD_BOARD]: [
    { label: "重新规划", action: "regenerate" },
    { label: "修改故事", action: "edit" },
  ],
  [SHAPE_TYPES.SCRIPT_SECTION]: [
    { label: "重新规划", action: "regenerate" },
    { label: "修改故事", action: "edit" },
  ],
  [SHAPE_TYPES.VIDEO_SECTION]: [
    { label: "重新合成视频", action: "regenerate" },
  ],
};

const SHAPE_TO_ENTITY: Record<string, { feedbackType: "plan" | "compose" }> = {
  [SHAPE_TYPES.STORYBOARD_BOARD]: { feedbackType: "plan" },
  [SHAPE_TYPES.SCRIPT_SECTION]: { feedbackType: "plan" },
  [SHAPE_TYPES.VIDEO_SECTION]: { feedbackType: "compose" },
};

export function ShapeContextMenu() {
  const editor = useEditor();
  const currentRunId = useEditorStore((state) => state.currentRunId);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [context, setContext] = useState<ShapeContext | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    const selectedShapes = editor.getSelectedShapes();
    if (selectedShapes.length !== 1) return;

    const shape = selectedShapes[0];
    const mapping = SHAPE_TO_ENTITY[shape.type];
    if (!mapping) return;

    e.preventDefault();
    e.stopPropagation();

    setContext({
      shapeType: shape.type,
      shapeId: shape.id,
      feedbackType: mapping.feedbackType,
    });
    setPosition({ x: e.clientX, y: e.clientY });
  }, [editor]);

  const handleAction = useCallback((action: string) => {
    if (!context) return;

    if (action === "regenerate") {
      const labelMap: Record<string, string> = {
        [SHAPE_TYPES.STORYBOARD_BOARD]: "重新规划会覆盖当前故事板内容",
        [SHAPE_TYPES.SCRIPT_SECTION]: "重新规划会覆盖当前内容",
        [SHAPE_TYPES.VIDEO_SECTION]: "重新合成会覆盖当前视频",
      };
      const msg = labelMap[context.shapeType] || "重新生成会覆盖当前内容，确定？";
      if (!window.confirm(msg)) return;
    }

    const shape = editor.getShape(context.shapeId as TLShapeId);
    const shapeProjectId = shape?.type === SHAPE_TYPES.STORYBOARD_BOARD
      ? (shape as StoryboardBoardShape).props.projectId
      : null;
    if (!shapeProjectId) {
      toast.error({ title: "画布操作", message: "无法确定项目" });
      return;
    }

    const content = action === "regenerate" ? "请重新生成当前阶段" : window.prompt("请输入修改意见", "")?.trim();
    if (!content) return;

    projectsApi.feedback(shapeProjectId, content, currentRunId ?? undefined, context.feedbackType)
      .then(() => toast.success({ title: "画布操作", message: "已提交" }))
      .catch(() => toast.error({ title: "画布操作", message: "提交失败" }));

    setPosition(null);
    setContext(null);
  }, [context, currentRunId, editor]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setPosition(null);
      setContext(null);
    }
  }, []);

  useEffect(() => {
    const canvasEl = editor.getContainer();
    canvasEl.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      canvasEl.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [editor, handleContextMenu, handleClickOutside]);

  if (!position || !context) return null;

  const actions = ACTIONS[context.shapeType] || [];

  return (
    <div
      ref={menuRef}
      className="fixed z-[999] min-w-[160px] py-1 rounded-lg bg-base-100 border-2 border-base-content/20 shadow-brutal"
      style={{ left: position.x, top: position.y }}
    >
      {actions.map(({ label, action }) => (
        <button
          key={action}
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-base-200 transition-colors"
          onClick={() => handleAction(action)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

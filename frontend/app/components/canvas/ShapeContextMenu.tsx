import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor } from "tldraw";
import { canvasEvents } from "./canvasEvents";

interface MenuPosition {
  x: number;
  y: number;
}

interface ShapeContext {
  shapeType: string;
  shapeId: string;
  entityType: string;
  entityId: number | null;
  feedbackType: string;
}

const ACTIONS: Record<string, { label: string; action: string }[]> = {
  "script-section": [
    { label: "重新规划", action: "regenerate" },
    { label: "修改故事", action: "edit" },
  ],
  "character-section": [
    { label: "重新生成角色", action: "regenerate" },
    { label: "修改角色描述", action: "edit" },
  ],
  "storyboard-section": [
    { label: "重新生成分镜", action: "regenerate" },
    { label: "修改分镜描述", action: "edit" },
  ],
  "video-section": [
    { label: "重新合成视频", action: "regenerate" },
  ],
};

const SHAPE_TO_ENTITY: Record<string, { entityType: string; feedbackType: string }> = {
  "script-section": { entityType: "script", feedbackType: "plan" },
  "character-section": { entityType: "character", feedbackType: "character" },
  "storyboard-section": { entityType: "shot", feedbackType: "shot" },
  "video-section": { entityType: "video", feedbackType: "compose" },
};

export function ShapeContextMenu() {
  const editor = useEditor();
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
      entityType: mapping.entityType,
      entityId: null,
      feedbackType: mapping.feedbackType,
    });
    setPosition({ x: e.clientX, y: e.clientY });
  }, [editor]);

  const handleAction = useCallback((action: string) => {
    if (!context) return;

    if (action === "regenerate") {
      const labelMap: Record<string, string> = {
        "script-section": "重新规划会覆盖当前内容",
        "character-section": "重新生成会覆盖当前角色",
        "storyboard-section": "重新生成会覆盖当前分镜",
        "video-section": "重新合成会覆盖当前视频",
      };
      const msg = labelMap[context.shapeType] || "重新生成会覆盖当前内容，确定？";
      if (!window.confirm(msg)) return;
    }

    canvasEvents.emit("shape-action", {
      shapeId: context.shapeId,
      action,
      entityType: context.entityType,
      entityId: context.entityId,
      feedbackType: context.feedbackType,
    });

    setPosition(null);
    setContext(null);
  }, [context]);

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

import type { Editor, TLShape, TLShapeId } from "tldraw";
import { SECTION_ORDER, SECTION_FALLBACK_H } from "~/hooks/useCanvasLayout";
import { getShapeSize } from "~/hooks/useDomSize";
import { SHAPE_TYPES } from "~/components/canvas/shapes/types";

const SECTION_GAP = 40;
const SECTION_SHAPE_IDS: TLShapeId[] = SECTION_ORDER.map(
  (s) => `shape:${s}` as TLShapeId
);

const SECTION_TYPES = new Set(Object.values(SHAPE_TYPES));

function isSectionShape(shape: TLShape): boolean {
  return SECTION_TYPES.has(shape.type as any);
}

function getShapeHeight(editor: Editor, shape: TLShape): number {
  const size = getShapeSize(editor, shape.id);
  return size?.height ?? (shape.props as any).h ?? SECTION_FALLBACK_H[SECTION_ORDER.find((_, i) => SECTION_SHAPE_IDS[i] === shape.id) ?? "plan"] ?? 200;
}

function getShapeBounds(shape: TLShape, h: number) {
  return {
    left: shape.x,
    top: shape.y,
    right: shape.x + (shape.props as any).w,
    bottom: shape.y + h,
  };
}

function aabbOverlap(a: ReturnType<typeof getShapeBounds>, b: ReturnType<typeof getShapeBounds>): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function layoutAllSections(editor: Editor, animate = false) {
  const ordered = SECTION_SHAPE_IDS
    .map((id) => editor.getShape(id))
    .filter(Boolean) as TLShape[];

  let currentY = 100;
  const startX = 100;

  for (const shape of ordered) {
    const h = getShapeHeight(editor, shape);
    const targetY = currentY;

    if (animate && Math.abs(shape.y - targetY) > 1) {
      editor.animateShape(
        { id: shape.id, type: shape.type, y: targetY } as any,
        { animation: { duration: 200 } }
      );
    } else if (Math.abs(shape.y - targetY) > 1 || Math.abs(shape.x - startX) > 1) {
      editor.updateShape({ id: shape.id, type: shape.type, x: startX, y: targetY } as any);
    }

    currentY += h + SECTION_GAP;
  }
}

export function registerCollisionSystem(editor: Editor): () => void {
  const disposals: (() => void)[] = [];

  const beforeChangeDispose = editor.sideEffects.registerBeforeChangeHandler(
    "shape",
    (prev: TLShape, next: TLShape) => {
      if (!isSectionShape(next)) return next;
      if (next.x === prev.x && next.y === prev.y) return next;

      const movedH = getShapeHeight(editor, next);
      const movedBounds = getShapeBounds(next, movedH);

      const others = editor.getCurrentPageShapes().filter(
        (s) => isSectionShape(s) && s.id !== next.id
      );

      for (const other of others) {
        const otherH = getShapeHeight(editor, other);
        const otherBounds = getShapeBounds(other, otherH);

        if (aabbOverlap(movedBounds, otherBounds)) {
          const movedIdx = SECTION_SHAPE_IDS.indexOf(next.id);
          const otherIdx = SECTION_SHAPE_IDS.indexOf(other.id);
          const resolvedY = movedIdx < otherIdx
            ? otherBounds.top - SECTION_GAP - movedH
            : otherBounds.bottom + SECTION_GAP;

          return { ...next, y: resolvedY };
        }
      }

      return next;
    }
  );
  disposals.push(beforeChangeDispose);

  const afterChangeDispose = editor.sideEffects.registerAfterChangeHandler(
    "shape",
    (prev: TLShape, next: TLShape) => {
      if (!isSectionShape(next)) return;
      if ((next.props as any).h === (prev.props as any).h && next.y === prev.y) return;

      requestAnimationFrame(() => {
        if (!editor.getShape(next.id)) return;
        layoutAllSections(editor, true);
      });
    }
  );
  disposals.push(afterChangeDispose);

  return () => {
    disposals.forEach((d) => d());
  };
}

export { layoutAllSections, SECTION_GAP };

import {
  ShapeUtil,
  T,
  type Geometry2d,
  type RecordProps,
  Polyline2d,
  Vec,
  type TLShapeId,
  useEditor,
  useValue,
} from "tldraw";
import { type ConnectorShape } from "./types";

export class ConnectorShapeUtil extends ShapeUtil<ConnectorShape> {
  static override type = "connector" as const;

  static override props: RecordProps<ConnectorShape> = {
    fromId: T.string,
    toId: T.string,
  };

  getDefaultProps(): ConnectorShape["props"] {
    return { fromId: "", toId: "" };
  }

  override canEdit() { return false; }
  override canResize() { return false; }
  override canBind() { return false; }

  getGeometry(shape: ConnectorShape): Geometry2d {
    const fromShape = this.editor.getShape(shape.props.fromId as TLShapeId);
    const toShape = this.editor.getShape(shape.props.toId as TLShapeId);

    if (!fromShape || !toShape) {
      return new Polyline2d({ points: [new Vec(0, 0), new Vec(0, 100)] });
    }

    const fromBounds = this.editor.getShapeGeometry(fromShape).bounds;
    const toBounds = this.editor.getShapeGeometry(toShape).bounds;

    return new Polyline2d({
      points: [
        new Vec(fromShape.x + fromBounds.w / 2, fromShape.y + fromBounds.h),
        new Vec(toShape.x + toBounds.w / 2, toShape.y),
      ],
    });
  }

  component(shape: ConnectorShape) {
    return <ConnectorLine shape={shape} />;
  }

  indicator() { return null; }
}

function ConnectorLine({ shape }: { shape: ConnectorShape }) {
  const editor = useEditor();

  const fromShape = useValue("fromShape", () => editor.getShape(shape.props.fromId as TLShapeId), [shape.props.fromId]);
  const toShape = useValue("toShape", () => editor.getShape(shape.props.toId as TLShapeId), [shape.props.toId]);

  if (!fromShape || !toShape) return null;

  const fromBounds = editor.getShapeGeometry(fromShape).bounds;
  const toBounds = editor.getShapeGeometry(toShape).bounds;

  const x1 = fromShape.x + fromBounds.w / 2;
  const y1 = fromShape.y + fromBounds.h;
  const x2 = toShape.x + toBounds.w / 2;
  const y2 = toShape.y;

  return (
    <svg style={{ position: "absolute", top: 0, left: 0, overflow: "visible", pointerEvents: "none" }}>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="oklch(var(--bc) / 0.15)"
        strokeWidth={2}
        strokeDasharray="6 4"
      />
      <circle cx={x1} cy={y1} r={3} fill="oklch(var(--p) / 0.5)" />
      <circle cx={x2} cy={y2} r={3} fill="oklch(var(--s) / 0.5)" />
    </svg>
  );
}

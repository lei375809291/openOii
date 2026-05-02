import {
  HTMLContainer,
  Rectangle2d,
  ShapeUtil,
  T,
  type Geometry2d,
  type RecordProps,
} from "tldraw";
import { type ScriptSectionShape } from "./types";
import {
  getWorkspaceSectionPlaceholderText,
  getWorkspaceSectionStatusBadgeClass,
  getWorkspaceSectionStatusLabel,
} from "~/utils/workspaceStatus";

export class ScriptSectionShapeUtil extends ShapeUtil<ScriptSectionShape> {
  static override type = "script-section" as const;

  static override props: RecordProps<ScriptSectionShape> = {
    w: T.number,
    h: T.number,
    summary: T.string,
    characters: T.any,
    shots: T.any,
    sectionState: T.string,
    placeholder: T.boolean,
    statusLabel: T.string,
    placeholderText: T.string,
  };

  getDefaultProps(): ScriptSectionShape["props"] {
    return {
      w: 800,
      h: 600,
      summary: "",
      characters: [],
      shots: [],
      sectionState: "draft",
      placeholder: true,
      statusLabel: getWorkspaceSectionStatusLabel("draft"),
      placeholderText: getWorkspaceSectionPlaceholderText("script"),
    };
  }

  override canEdit() {
    return false;
  }

  override canResize() {
    return false;
  }

  override hideSelectionBoundsFg() {
    return true;
  }

  override hideSelectionBoundsBg() {
    return true;
  }

  getGeometry(shape: ScriptSectionShape): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  component(shape: ScriptSectionShape) {
    const { summary, placeholder, placeholderText, statusLabel, sectionState, w, h } = shape.props;

    return (
      <HTMLContainer
        style={{
          width: w,
          height: h,
          pointerEvents: "all",
          overflow: "hidden",
        }}
      >
        <ScriptSectionContent
          summary={summary}
          placeholder={placeholder}
          placeholderText={placeholderText}
          statusLabel={statusLabel}
          sectionState={sectionState}
          width={w}
          height={h}
        />
      </HTMLContainer>
    );
  }

  indicator() {
    return null;
  }
}

function ScriptSectionContent({
  summary,
  placeholder,
  placeholderText,
  statusLabel,
  sectionState,
  width,
  height,
}: {
  summary: string;
  placeholder: boolean;
  placeholderText: string;
  statusLabel: string;
  sectionState: ScriptSectionShape["props"]["sectionState"];
  width: number;
  height: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width, height, overflow: "hidden", borderRadius: 12, background: "var(--fallback-b1,oklch(var(--b1)))", clipPath: "inset(0 round 12px)" }}>
      {/* 标题栏 — 固定高度 */}
      <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1 flex-shrink-0">
        <h2 className="text-sm font-bold text-base-content">编剧</h2>
        <span className={`badge badge-xs ${getWorkspaceSectionStatusBadgeClass(sectionState)}`}>
          {statusLabel}
        </span>
      </div>

      {/* 内容 — 固定像素高度 */}
      <div className="overflow-y-auto px-3 pb-2" style={{ height: height - 32 - 8 }}>
        {summary ? (
          <div className="bg-base-200 rounded-lg p-3 border-l-4 border-secondary">
            <p className="text-sm text-base-content/80 whitespace-pre-wrap leading-relaxed">{summary}</p>
          </div>
        ) : placeholder ? (
          <div className="text-center py-8 text-base-content/50">
            <p className="text-sm">{placeholderText}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

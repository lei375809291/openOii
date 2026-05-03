import {
  HTMLContainer,
  Rectangle2d,
  ShapeUtil,
  T,
  type Geometry2d,
  type RecordProps,
} from "tldraw";
import { type ScriptSectionShape } from "./types";
import { SectionShell } from "./SectionShell";
import {
  getWorkspaceSectionPlaceholderText,
  getWorkspaceSectionStatusLabel,
} from "~/utils/workspaceStatus";

export class ScriptSectionShapeUtil extends ShapeUtil<ScriptSectionShape> {
  static override type = "script-section" as const;

  static override props: RecordProps<ScriptSectionShape> = {
    w: T.number,
    h: T.number,
    story: T.string,
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
      story: "",
      summary: "",
      characters: [],
      shots: [],
      sectionState: "draft",
      placeholder: true,
      statusLabel: getWorkspaceSectionStatusLabel("draft"),
      placeholderText: getWorkspaceSectionPlaceholderText("script"),
    };
  }

  override canEdit() { return false; }
  override canResize() { return false; }
  override hideSelectionBoundsFg() { return true; }
  override hideSelectionBoundsBg() { return true; }

  getGeometry(shape: ScriptSectionShape): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  component(shape: ScriptSectionShape) {
    const { story, summary, characters, shots, placeholder, placeholderText, statusLabel, w, h } = shape.props;

    return (
      <HTMLContainer style={{ width: w, pointerEvents: "all", overflow: "visible" }}>
        <SectionShell
          sectionTitle="编剧"
          statusLabel={statusLabel}
          placeholder={placeholder}
          placeholderText={placeholderText}
        >
          {story ? (
            <div className="rounded-lg p-3 border-l-[3px] border-secondary bg-base-200">
              <p className="text-sm text-base-content/80 whitespace-pre-wrap leading-relaxed">{story}</p>
              {summary && (
                <p className="text-xs text-base-content/50 mt-2 pt-2 border-t border-base-content/10">{summary}</p>
              )}
            </div>
          ) : summary ? (
            <div className="rounded-lg p-3 border-l-[3px] border-secondary bg-base-200">
              <p className="text-sm text-base-content/80 whitespace-pre-wrap leading-relaxed">{summary}</p>
            </div>
          ) : characters.length > 0 || shots.length > 0 ? (
            <div className="space-y-2">
              {characters.length > 0 && (
                <div className="text-xs text-base-content/60">
                  <span className="font-medium text-base-content/80">角色：</span>
                  {characters.map((c) => c.name).join("、")}
                </div>
              )}
              {shots.length > 0 && (
                <div className="text-xs text-base-content/60">
                  <span className="font-medium text-base-content/80">分镜：</span>
                  {shots.length} 个镜头
                </div>
              )}
            </div>
          ) : null}
        </SectionShell>
      </HTMLContainer>
    );
  }

  indicator() {
    return null;
  }
}

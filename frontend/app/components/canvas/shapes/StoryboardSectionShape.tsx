import {
  HTMLContainer,
  Rectangle2d,
  ShapeUtil,
  T,
  type Geometry2d,
  type RecordProps,
} from "tldraw";
import type { StoryboardSectionShape } from "./types";
import { SectionShell } from "./SectionShell";
import { getStaticUrl } from "~/services/api";
import {
  getWorkspaceSectionPlaceholderText,
  getWorkspaceSectionStatusLabel,
} from "~/utils/workspaceStatus";

export class StoryboardSectionShapeUtil extends ShapeUtil<StoryboardSectionShape> {
  static override type = "storyboard-section" as const;

  static override props: RecordProps<StoryboardSectionShape> = {
    w: T.number,
    h: T.number,
    shots: T.any,
    sectionTitle: T.string,
    sectionState: T.string,
    placeholder: T.boolean,
    statusLabel: T.string,
    placeholderText: T.string,
  };

  getDefaultProps(): StoryboardSectionShape["props"] {
    return {
      w: 800,
      h: 500,
      shots: [],
      sectionTitle: "分镜",
      sectionState: "blocked",
      placeholder: true,
      statusLabel: getWorkspaceSectionStatusLabel("blocked"),
      placeholderText: getWorkspaceSectionPlaceholderText("storyboards"),
    };
  }

  override canEdit() { return false; }
  override canResize() { return false; }
  override hideSelectionBoundsFg() { return true; }
  override hideSelectionBoundsBg() { return true; }

  getGeometry(shape: StoryboardSectionShape): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  component(shape: StoryboardSectionShape) {
    const { shots, sectionTitle, placeholder, placeholderText, statusLabel, w } = shape.props;

    return (
      <HTMLContainer style={{ width: w, pointerEvents: "all", overflow: "visible" }}>
        <SectionShell
          sectionTitle={sectionTitle}
          statusLabel={statusLabel}
          placeholder={placeholder}
          placeholderText={placeholderText}
        >
          <div className="grid grid-cols-4 gap-2">
            {shots.map((shot) => {
              const isApproved = shot.approval_state === "approved";
              const imageUrl = getStaticUrl(shot.image_url);

              return (
                <div
                  key={shot.id}
                  className={`card card-compact bg-base-200 border-2 border-base-content/15 ${
                    isApproved ? "ring-1 ring-success/20" : ""
                  }`}
                >
                  {imageUrl ? (
                    <figure className="relative">
                      <img src={imageUrl} alt={`Shot ${shot.order}`} className="w-full object-cover" />
                      <span className="badge badge-xs absolute top-1 right-1 bg-base-100/80">{shot.duration}s</span>
                    </figure>
                  ) : (
                    <div className="h-28 flex items-center justify-center bg-base-300">
                      <span className="text-xs opacity-40">生成中...</span>
                    </div>
                  )}
                  <div className="card-body p-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${isApproved ? "bg-success" : "bg-warning"}`} />
                      <span className="text-xs font-medium">镜头 {shot.order}</span>
                      {shot.camera && (
                        <span className="badge badge-ghost badge-xs ml-auto">{shot.camera}</span>
                      )}
                    </div>
                    <p className="text-xs text-base-content/50">{shot.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionShell>
      </HTMLContainer>
    );
  }

  indicator() {
    return null;
  }
}

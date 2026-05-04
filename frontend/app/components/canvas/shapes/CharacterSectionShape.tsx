import {
  HTMLContainer,
  Rectangle2d,
  ShapeUtil,
  T,
  type Geometry2d,
  type RecordProps,
} from "tldraw";
import type { CharacterSectionShape } from "./types";
import { SectionShell } from "./SectionShell";
import { getStaticUrl } from "~/services/api";
import {
  getWorkspaceSectionPlaceholderText,
  getWorkspaceSectionStatusLabel,
} from "~/utils/workspaceStatus";

export class CharacterSectionShapeUtil extends ShapeUtil<CharacterSectionShape> {
  static override type = "character-section" as const;

  static override props: RecordProps<CharacterSectionShape> = {
    w: T.number,
    h: T.number,
    characters: T.any,
    sectionState: T.string,
    placeholder: T.boolean,
    statusLabel: T.string,
    placeholderText: T.string,
  };

  getDefaultProps(): CharacterSectionShape["props"] {
    return {
      w: 800,
      h: 400,
      characters: [],
      sectionState: "blocked",
      placeholder: true,
      statusLabel: getWorkspaceSectionStatusLabel("blocked"),
      placeholderText: getWorkspaceSectionPlaceholderText("characters"),
    };
  }

  override canEdit() { return false; }
  override canResize() { return false; }
  override hideSelectionBoundsFg() { return true; }
  override hideSelectionBoundsBg() { return true; }

  getGeometry(shape: CharacterSectionShape): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  component(shape: CharacterSectionShape) {
    const { characters, placeholder, placeholderText, statusLabel, w } = shape.props;

    return (
      <HTMLContainer style={{ width: w, pointerEvents: "all", overflow: "visible" }}>
        <SectionShell
          sectionTitle="角色"
          statusLabel={statusLabel}
          placeholder={placeholder}
          placeholderText={placeholderText}
        >
          <div className="grid grid-cols-2 gap-2">
            {characters.map((char) => {
              const isApproved = char.approval_state === "approved";
              const currentImage = getStaticUrl(char.image_url);
              const approvedImage = getStaticUrl(char.approved_image_url);
              const displayImage = isApproved && approvedImage ? approvedImage : currentImage;

              return (
                <div
                  key={char.id}
                  className={`card card-compact bg-base-200 border-2 border-base-content/15 ${
                    isApproved ? "ring-1 ring-success/20" : ""
                  }`}
                >
                  {displayImage && (
                    <figure>
                      <img src={displayImage} alt={char.name} className="w-full object-cover" />
                    </figure>
                  )}
                  <div className="card-body p-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${isApproved ? "bg-success" : "bg-warning"}`} />
                      <span className="font-semibold text-xs">{char.name}</span>
                      <span className="badge badge-ghost badge-xs ml-auto">v{char.approval_version}</span>
                    </div>
                    {char.description && (
                      <p className="text-xs text-base-content/50">{char.description}</p>
                    )}
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

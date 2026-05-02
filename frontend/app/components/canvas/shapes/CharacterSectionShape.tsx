import {
  HTMLContainer,
  Rectangle2d,
  ShapeUtil,
  T,
  type Geometry2d,
  type RecordProps,
} from "tldraw";
import { type CharacterSectionShape } from "./types";
import {
  TrashIcon,
  UserIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";
import { getStaticUrl } from "~/services/api";
import type { Character } from "~/types";
import { canvasEvents } from "../canvasEvents";
import {
  getWorkspaceSectionPlaceholderText,
  getWorkspaceSectionStatusBadgeClass,
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

  getGeometry(shape: CharacterSectionShape): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  component(shape: CharacterSectionShape) {
    const { characters, placeholder, placeholderText, statusLabel, sectionState, w, h } = shape.props;

    return (
      <HTMLContainer
        style={{
          width: w,
          height: h,
          pointerEvents: "all",
          overflow: "hidden",
        }}
      >
        <CharacterSectionContent
          characters={characters}
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

function CharacterCard({ character }: { character: Character }) {
  const imageUrl = getStaticUrl(character.image_url);
  const isApproved = character.approval_state === "approved";

  const handleApprove = () => {
    canvasEvents.emit("approve-character", { id: character.id });
  };

  const handleDelete = () => {
    canvasEvents.emit("delete-character", character);
  };

  const handlePreview = () => {
    if (imageUrl) {
      canvasEvents.emit("preview-image", { src: imageUrl, alt: character.name });
    }
  };

  return (
    <div className="group bg-base-200 rounded-lg overflow-hidden relative">
      {/* 图片 */}
      {imageUrl ? (
        <button type="button" className="block w-full text-left" onClick={handlePreview} onPointerDown={(e) => e.stopPropagation()} aria-label={`预览 ${character.name}`}>
          <img src={imageUrl} alt={character.name} className="w-full h-20 object-cover cursor-zoom-in hover:opacity-90 transition-opacity" />
        </button>
      ) : (
        <div className="w-full h-20 bg-base-300 flex items-center justify-center">
          <UserIcon className="w-6 h-6 text-base-content/20" />
        </div>
      )}

      {/* 名称 + 状态圆点 */}
      <div className="px-2 py-1 flex items-center gap-1">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isApproved ? "bg-success" : "bg-base-content/30"}`} title={isApproved ? "已批准" : "待审核"} />
        <h4 className="font-bold text-xs text-base-content truncate flex-1">{character.name}</h4>
      </div>

      {/* 操作栏 — hover 显示 */}
      <div className="flex items-center justify-end gap-0.5 px-1 pb-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" className="btn btn-xs btn-circle btn-success" onClick={(e) => { e.stopPropagation(); handleApprove(); }} onPointerDown={(e) => e.stopPropagation()} title={isApproved ? "重新审核" : "批准角色"}>
          <CheckBadgeIcon className="w-3 h-3" />
        </button>
        <button type="button" className="btn btn-xs btn-circle btn-error" onClick={(e) => { e.stopPropagation(); handleDelete(); }} onPointerDown={(e) => e.stopPropagation()} title="删除">
          <TrashIcon className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function CharacterSectionContent({
  characters,
  placeholder,
  placeholderText,
  statusLabel,
  sectionState,
  width,
  height,
}: {
  characters: Character[];
  placeholder: boolean;
  placeholderText: string;
  statusLabel: string;
  sectionState: CharacterSectionShape["props"]["sectionState"];
  width: number;
  height: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width, height, overflow: "hidden", borderRadius: 12, background: "var(--fallback-b1,oklch(var(--b1)))", clipPath: "inset(0 round 12px)" }}>
      {/* 标题栏 — 固定高度 */}
      <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1 flex-shrink-0">
        <h2 className="text-sm font-bold text-base-content">角色设计师</h2>
        <span className={`badge badge-xs ${getWorkspaceSectionStatusBadgeClass(sectionState)}`}>
          {statusLabel}
        </span>
      </div>

      {/* 角色网格 — 固定像素高度 */}
      {characters.length > 0 ? (
        <div
          className="grid grid-cols-2 gap-3 overflow-y-auto px-4 pb-3"
          style={{ height: height - 32 - 8 }}
        >
          {characters.map((char) => (
            <CharacterCard key={char.id} character={char} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-base-content/50">
          <UserIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{placeholder ? placeholderText : "等待角色图生成..."}</p>
        </div>
      )}
    </div>
  );
}

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
  SparklesIcon,
  PencilIcon,
  ArrowPathIcon,
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

function getReviewStateMeta(state: Character["approval_state"]) {
  if (state === "approved") {
    return { label: "已批准", badge: "badge-success" };
  }

  if (state === "superseded") {
    return { label: "已失效", badge: "badge-error" };
  }

  return { label: "待审核", badge: "badge-ghost" };
}

function getApprovalActionLabel(state: Character["approval_state"]) {
  const primary = state === "approved" ? "重新审核" : "批准角色";

  return `${primary} / 批准角色 / 重新审核`;
}

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
    const { characters, placeholder, placeholderText, statusLabel, sectionState } = shape.props;

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          pointerEvents: "all",
        }}
        className="h-full"
      >
        <CharacterSectionContent
          characters={characters}
          placeholder={placeholder}
          placeholderText={placeholderText}
          statusLabel={statusLabel}
          sectionState={sectionState}
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
  const reviewMeta = getReviewStateMeta(character.approval_state);
  const approveLabel = getApprovalActionLabel(character.approval_state);

  const handleEdit = () => {
    canvasEvents.emit("edit-character", character);
  };

  const handleApprove = () => {
    canvasEvents.emit("approve-character", { id: character.id });
  };

  const handleRegenerate = () => {
    canvasEvents.emit("regenerate-character", character.id);
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
    <div
      className="group bg-base-200 rounded-lg p-3 relative"
    >
      {/* 操作栏 */}
      <div
        className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-lg bg-base-100/90 p-1 backdrop-blur-sm"
      >
        <button
          type="button"
          className="btn btn-xs btn-circle btn-ghost text-base-content"
          onClick={(e) => { e.stopPropagation(); handleEdit(); }}
          onPointerDown={(e) => e.stopPropagation()}
          title="编辑"
        >
          <PencilIcon className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="btn btn-xs btn-circle btn-secondary"
          onClick={(e) => { e.stopPropagation(); handleRegenerate(); }}
          onPointerDown={(e) => e.stopPropagation()}
          title="重新生成"
        >
          <ArrowPathIcon className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="btn btn-xs btn-circle btn-success"
          onClick={(e) => { e.stopPropagation(); handleApprove(); }}
          onPointerDown={(e) => e.stopPropagation()}
          title={approveLabel}
          aria-label={approveLabel}
        >
          <CheckBadgeIcon className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="btn btn-xs btn-circle btn-error"
          onClick={(e) => { e.stopPropagation(); handleDelete(); }}
          onPointerDown={(e) => e.stopPropagation()}
          title="删除"
        >
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 角色信息 */}
      <div className="flex items-start gap-2 mb-2">
        <h4 className="font-bold text-base-content flex-1">{character.name}</h4>
        <span className={`badge badge-xs ${reviewMeta.badge}`}>{reviewMeta.label}</span>
      </div>
      {character.description && (
        <p className="text-xs text-base-content/70 mb-3 line-clamp-2">
          {character.description}
        </p>
      )}

      {/* 角色图片 */}
      {imageUrl ? (
        <button
          type="button"
          className="block w-full text-left"
          onClick={handlePreview}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`预览 ${character.name}`}
        >
          <img
            src={imageUrl}
            alt={character.name}
            className="w-full h-48 object-cover rounded-lg cursor-zoom-in hover:opacity-90 transition-opacity"
          />
        </button>
      ) : (
        <div className="w-full h-48 bg-base-300 rounded-lg flex items-center justify-center">
          <UserIcon className="w-12 h-12 text-base-content/20" />
        </div>
      )}
    </div>
  );
}

function CharacterSectionContent({
  characters,
  placeholder,
  placeholderText,
  statusLabel,
  sectionState,
}: {
  characters: Character[];
  placeholder: boolean;
  placeholderText: string;
  statusLabel: string;
  sectionState: CharacterSectionShape["props"]["sectionState"];
}) {
  return (
    <div className="card-doodle bg-base-100 p-5 h-full flex flex-col overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between gap-2 mb-4 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center">
            <SparklesIcon className="w-4 h-4 text-warning" />
          </div>
          <h2 className="text-lg font-heading font-bold text-base-content">角色设计师</h2>
        </div>
        <span className={`badge badge-sm ${getWorkspaceSectionStatusBadgeClass(sectionState)}`}>
          {statusLabel}
        </span>
      </div>

      {/* 角色网格 */}
      {characters.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 overflow-y-auto flex-1 min-h-0 pr-1">
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

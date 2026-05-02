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
    <div className="group bg-base-200 rounded-lg overflow-hidden relative">
      {/* 操作按钮 — hover 显示 */}
      <div className="absolute top-1 right-1 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" className="btn btn-xs btn-circle btn-ghost bg-base-100/80 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); handleEdit(); }} onPointerDown={(e) => e.stopPropagation()} title="编辑">
          <PencilIcon className="w-3 h-3" />
        </button>
        <button type="button" className="btn btn-xs btn-circle btn-secondary" onClick={(e) => { e.stopPropagation(); handleRegenerate(); }} onPointerDown={(e) => e.stopPropagation()} title="重新生成">
          <ArrowPathIcon className="w-3 h-3" />
        </button>
        <button type="button" className="btn btn-xs btn-circle btn-success" onClick={(e) => { e.stopPropagation(); handleApprove(); }} onPointerDown={(e) => e.stopPropagation()} title={approveLabel} aria-label={approveLabel}>
          <CheckBadgeIcon className="w-3 h-3" />
        </button>
        <button type="button" className="btn btn-xs btn-circle btn-error" onClick={(e) => { e.stopPropagation(); handleDelete(); }} onPointerDown={(e) => e.stopPropagation()} title="删除">
          <TrashIcon className="w-3 h-3" />
        </button>
      </div>

      {/* 图片 */}
      {imageUrl ? (
        <button type="button" className="block w-full text-left" onClick={handlePreview} onPointerDown={(e) => e.stopPropagation()} aria-label={`预览 ${character.name}`}>
          <img src={imageUrl} alt={character.name} className="w-full h-40 object-cover cursor-zoom-in hover:opacity-90 transition-opacity" />
        </button>
      ) : (
        <div className="w-full h-40 bg-base-300 flex items-center justify-center">
          <UserIcon className="w-10 h-10 text-base-content/20" />
        </div>
      )}

      {/* 名称 + 状态 */}
      <div className="px-2 pt-2 pb-1 flex items-center gap-1">
        <h4 className="font-bold text-sm text-base-content truncate flex-1">{character.name}</h4>
        <span className={`badge badge-xs ${reviewMeta.badge}`}>{reviewMeta.label}</span>
      </div>

      {/* 描述 */}
      {character.description && (
        <p className="px-2 pb-2 text-xs text-base-content/70 line-clamp-2">{character.description}</p>
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
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 flex-shrink-0">
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

      {/* 角色网格 — 固定像素高度 */}
      {characters.length > 0 ? (
        <div
          className="grid grid-cols-2 gap-3 overflow-y-auto px-4 pb-3"
          style={{ height: height - 52 - 12 }}
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

import {
  HTMLContainer,
  Rectangle2d,
  ShapeUtil,
  T,
  type Geometry2d,
  type RecordProps,
} from "tldraw";
import { type StoryboardSectionShape } from "./types";
import {
  FilmIcon,
  PencilIcon,
  PhotoIcon,
  VideoCameraIcon,
  TrashIcon,
  RectangleStackIcon,
} from "@heroicons/react/24/outline";
import { getStaticUrl } from "~/services/api";
import type { Shot } from "~/types";
import { canvasEvents } from "../canvasEvents";
import {
  getWorkspaceSectionPlaceholderText,
  getWorkspaceSectionStatusBadgeClass,
  getWorkspaceSectionStatusLabel,
} from "~/utils/workspaceStatus";

function getReviewStateMeta(state: Shot["approval_state"]) {
  if (state === "approved") {
    return { label: "已批准", badge: "badge-success" };
  }

  if (state === "superseded") {
    return { label: "已失效", badge: "badge-error" };
  }

  return { label: "待审核", badge: "badge-ghost" };
}

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
      sectionTitle: "分镜图",
      sectionState: "blocked",
      placeholder: true,
      statusLabel: getWorkspaceSectionStatusLabel("blocked"),
      placeholderText: getWorkspaceSectionPlaceholderText("storyboards"),
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

  getGeometry(shape: StoryboardSectionShape): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  component(shape: StoryboardSectionShape) {
    const { shots, sectionTitle, placeholder, placeholderText, statusLabel, sectionState, w, h } = shape.props;

    return (
      <HTMLContainer
        style={{
          width: w,
          height: h,
          pointerEvents: "all",
          overflow: "hidden",
        }}
      >
        <StoryboardSectionContent
          shots={shots}
          sectionTitle={sectionTitle}
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

function ShotCard({ shot }: { shot: Shot }) {
  const imageUrl = getStaticUrl(shot.image_url);
  const videoUrl = getStaticUrl(shot.video_url);
  const reviewMeta = getReviewStateMeta(shot.approval_state);

  const handleApprove = () => {
    canvasEvents.emit("approve-shot", { id: shot.id });
  };

  const handleEdit = () => {
    canvasEvents.emit("edit-shot", shot);
  };

  const handleRegenerateImage = () => {
    canvasEvents.emit("regenerate-shot", { id: shot.id, type: "image" });
  };

  const handleRegenerateVideo = () => {
    canvasEvents.emit("regenerate-shot", { id: shot.id, type: "video" });
  };

  const handleDelete = () => {
    canvasEvents.emit("delete-shot", shot);
  };

  const handlePreviewImage = () => {
    if (imageUrl) {
      canvasEvents.emit("preview-image", { src: imageUrl, alt: `镜头 ${shot.order}` });
    }
  };

  const handlePreviewVideo = () => {
    if (videoUrl) {
      canvasEvents.emit("preview-video", { src: videoUrl, title: `镜头 ${shot.order}` });
    }
  };

  const duration = shot.duration != null ? `${shot.duration}s` : null;

  return (
    <div
      className="group bg-base-200 rounded-lg overflow-hidden relative"
      style={{ height: 250, maxHeight: 250, boxSizing: "border-box", clipPath: "inset(0 round 8px)" }}
    >
      {/* 图片预览 */}
      {imageUrl ? (
        <button
          type="button"
          className="block w-full text-left"
          onClick={handlePreviewImage}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`预览镜头 ${shot.order} 图片`}
        >
          <img
            src={imageUrl}
            alt={`镜头 ${shot.order}`}
            className="w-full h-[110px] object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
          />
        </button>
      ) : (
        <div className="w-full h-[110px] bg-base-300 flex items-center justify-center">
          <RectangleStackIcon className="w-6 h-6 text-base-content/20" />
        </div>
      )}

      {/* 视频播放按钮 */}
      {videoUrl && (
        <button
          type="button"
          className="absolute top-2 right-2 btn btn-xs btn-circle btn-primary shadow"
          onClick={handlePreviewVideo}
          onPointerDown={(e) => e.stopPropagation()}
          title="播放视频"
        >
          <span className="text-xs">▶</span>
        </button>
      )}

      {/* 内容区 - 固定 140px */}
      <div className="px-2 py-1.5" style={{ height: 140, overflow: "hidden" }}>
        {/* 标题行 */}
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-bold text-base-content">#{shot.order}</span>
          <span className={`badge badge-xs ${reviewMeta.badge}`}>{reviewMeta.label}</span>
          {duration && (
            <span className="badge badge-xs badge-outline">{duration}</span>
          )}
        </div>

        {/* 描述 - 2行截断 */}
        <div style={{ height: 64, overflow: "hidden" }}>
          <p className="text-xs text-base-content/80 leading-relaxed">
            {shot.description}
          </p>
        </div>

        {/* 操作按钮 - hover 显示 */}
        <div className="flex items-center justify-end gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            className="btn btn-xs btn-circle btn-ghost text-base-content"
            onClick={(e) => { e.stopPropagation(); handleEdit(); }}
            onPointerDown={(e) => e.stopPropagation()}
            title="编辑"
          >
            <PencilIcon className="w-3 h-3" />
          </button>
          <button
            type="button"
            className="btn btn-xs btn-circle btn-secondary"
            onClick={(e) => { e.stopPropagation(); handleRegenerateImage(); }}
            onPointerDown={(e) => e.stopPropagation()}
            title="重新生成图片"
          >
            <PhotoIcon className="w-3 h-3" />
          </button>
          <button
            type="button"
            className="btn btn-xs btn-circle btn-accent"
            onClick={(e) => { e.stopPropagation(); handleRegenerateVideo(); }}
            onPointerDown={(e) => e.stopPropagation()}
            title="重新生成视频"
          >
            <VideoCameraIcon className="w-3 h-3" />
          </button>
          <button
            type="button"
            className="btn btn-xs btn-circle btn-success"
            onClick={(e) => { e.stopPropagation(); handleApprove(); }}
            onPointerDown={(e) => e.stopPropagation()}
            title={shot.approval_state === "approved" ? "重新审核" : "批准分镜"}
          >
            <svg className="w-3 h-3" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </button>
          <button
            type="button"
            className="btn btn-xs btn-circle btn-error"
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            onPointerDown={(e) => e.stopPropagation()}
            title="删除"
          >
            <TrashIcon className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StoryboardSectionContent({
  shots,
  sectionTitle,
  placeholder,
  placeholderText,
  statusLabel,
  sectionState,
  width,
  height,
}: {
  shots: Shot[];
  sectionTitle: string;
  placeholder: boolean;
  placeholderText: string;
  statusLabel: string;
  sectionState: StoryboardSectionShape["props"]["sectionState"];
  width: number;
  height: number;
}) {
  const sortedShots = [...shots].sort((a, b) => a.order - b.order);

  return (
    <div style={{ display: "flex", flexDirection: "column", width, height, overflow: "hidden", borderRadius: 12, background: "var(--fallback-b1,oklch(var(--b1)))", clipPath: "inset(0 round 12px)" }}>
      {/* 标题栏 — 固定高度 */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
            <FilmIcon className="w-4 h-4 text-accent" />
          </div>
          <h2 className="text-lg font-heading font-bold text-base-content">{sectionTitle}</h2>
        </div>
        <span className={`badge badge-sm ${getWorkspaceSectionStatusBadgeClass(sectionState)}`}>
          {statusLabel}
        </span>
        {shots.length > 0 && (
          <span className="badge badge-ghost text-base-content/60">
            {shots.length} 个镜头
          </span>
        )}
      </div>

      {/* 分镜网格 — 固定像素高度 */}
      {sortedShots.length > 0 ? (
        (() => {
          const padX = 16;
          const gap = 12;
          const cols = 4;
          const cellW = Math.floor((width - padX * 2 - gap * (cols - 1)) / cols);
          return (
            <div
              style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${cellW}px)`, gap, padding: `0 ${padX}px 12px`, height: height - 52 - 12, overflowY: "auto", minWidth: 0 }}
            >
              {sortedShots.map((shot) => (
                <div key={shot.id} style={{ minWidth: 0, overflow: "hidden", borderRadius: 8, clipPath: "inset(0 round 8px)" }}>
                  <ShotCard shot={shot} />
                </div>
              ))}
            </div>
          );
        })()
      ) : (
        <div className="text-center py-8 text-base-content/50">
          <RectangleStackIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{placeholder ? placeholderText : "等待分镜图生成..."}</p>
        </div>
      )}
    </div>
  );
}

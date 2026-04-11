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

function getReviewStateMeta(state: Shot["approval_state"]) {
  if (state === "approved") {
    return { label: "已批准", badge: "badge-success" };
  }

  if (state === "superseded") {
    return { label: "已失效", badge: "badge-error" };
  }

  return { label: "待审核", badge: "badge-ghost" };
}

function getApprovalActionLabel(state: Shot["approval_state"]) {
  const primary = state === "approved" ? "重新审核" : "批准分镜";

  return `${primary} / 批准分镜 / 重新审核`;
}

export class StoryboardSectionShapeUtil extends ShapeUtil<StoryboardSectionShape> {
  static override type = "storyboard-section" as const;

  static override props: RecordProps<StoryboardSectionShape> = {
    w: T.number,
    h: T.number,
    shots: T.any,
  };

  getDefaultProps(): StoryboardSectionShape["props"] {
    return {
      w: 800,
      h: 500,
      shots: [],
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
    const { shots } = shape.props;

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          pointerEvents: "all",
        }}
        className="h-full"
      >
        <StoryboardSectionContent shots={shots} />
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
  const approveLabel = getApprovalActionLabel(shot.approval_state);
  const boundCharacterIds =
    shot.approval_state === "approved" && shot.approved_character_ids.length > 0
      ? shot.approved_character_ids
      : shot.character_ids;

  const intentSummary = [
    { label: "时长", value: `${shot.duration} 秒` },
    { label: "镜头", value: shot.camera || "未填写" },
    { label: "动作", value: shot.motion_note || "未填写" },
    { label: "提示词", value: shot.prompt || "未填写" },
    { label: "图像提示词", value: shot.image_prompt || "未填写" },
  ];

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

  return (
    <div
      className="group bg-base-200 rounded-lg p-2 relative"
    >
      {/* 操作栏 */}
      <div
        className="absolute top-1 right-1 z-10 flex items-center gap-0.5 rounded-lg bg-base-100/90 p-0.5 backdrop-blur-sm opacity-0 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
      >
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
          title={approveLabel}
          aria-label={approveLabel}
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

      {/* 镜头序号 */}
      <div className="flex items-center gap-1 mb-1">
        <span className="text-xs font-bold text-base-content">#{shot.order}</span>
        <span className={`badge badge-xs ${reviewMeta.badge}`}>{reviewMeta.label}</span>
        {videoUrl && (
          <span className="badge badge-success badge-xs">视频</span>
        )}
      </div>

      <div className="mb-2 space-y-2 text-[11px] text-base-content/70">
        <div>
          <p className="font-semibold text-base-content/60">绑定角色</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {boundCharacterIds.length > 0 ? (
              boundCharacterIds.map((characterId) => (
                <span key={characterId} className="badge badge-outline badge-xs">
                  角色 #{characterId}
                </span>
              ))
            ) : (
              <span className="text-base-content/40">未绑定角色</span>
            )}
          </div>
        </div>

        <div>
          <p className="font-semibold text-base-content/60">镜头意图</p>
          <div className="mt-1 grid grid-cols-1 gap-0.5">
            {intentSummary.map((item) => (
              <div key={item.label} className="flex items-start gap-1">
                <span className="w-16 shrink-0 text-base-content/50">{item.label}</span>
                <span className="flex-1 text-base-content/80 line-clamp-2">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 图片/视频 */}
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
            className="w-full h-24 object-cover rounded cursor-zoom-in hover:opacity-90 transition-opacity"
          />
        </button>
      ) : (
        <div className="w-full h-24 bg-base-300 rounded flex items-center justify-center">
          <RectangleStackIcon className="w-6 h-6 text-base-content/20" />
        </div>
      )}

      {/* 视频预览按钮 */}
      {videoUrl && (
        <button
          type="button"
          className="absolute bottom-8 right-3 btn btn-xs btn-circle btn-primary"
          onClick={handlePreviewVideo}
          onPointerDown={(e) => e.stopPropagation()}
          title="播放视频"
        >
          <span className="text-xs">▶</span>
        </button>
      )}

      {/* 描述 */}
      <p className="text-xs text-base-content/70 mt-1 line-clamp-2">
        {shot.description}
      </p>
    </div>
  );
}

function StoryboardSectionContent({ shots }: { shots: Shot[] }) {
  const sortedShots = [...shots].sort((a, b) => a.order - b.order);

  return (
    <div className="card-doodle bg-base-100 p-5 h-full">
      {/* 标题栏 */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
          <FilmIcon className="w-4 h-4 text-accent" />
        </div>
        <h2 className="text-lg font-heading font-bold text-base-content">分镜图</h2>
        {shots.length > 0 && (
          <span className="badge badge-ghost text-base-content/60">
            {shots.length} 个镜头
          </span>
        )}
      </div>

      {/* 分镜网格 */}
      {sortedShots.length > 0 ? (
        <div className="grid grid-cols-4 gap-3">
          {sortedShots.map((shot) => (
            <ShotCard key={shot.id} shot={shot} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-base-content/50">
          <RectangleStackIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">等待分镜图生成...</p>
        </div>
      )}
    </div>
  );
}

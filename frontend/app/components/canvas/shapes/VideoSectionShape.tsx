import {
  HTMLContainer,
  Rectangle2d,
  ShapeUtil,
  T,
  type Geometry2d,
  type RecordProps,
} from "tldraw";
import type { VideoSectionShape } from "./types";
import { FireIcon, VideoCameraIcon } from "@heroicons/react/24/outline";
import { canvasEvents } from "../canvasEvents";
import { getStaticUrl } from "~/services/api";
import {
  getWorkspaceSectionPlaceholderText,
  getWorkspaceSectionStatusBadgeClass,
  getWorkspaceSectionStatusLabel,
} from "~/utils/workspaceStatus";

export class VideoSectionShapeUtil extends ShapeUtil<VideoSectionShape> {
  static override type = "video-section" as const;

  static override props: RecordProps<VideoSectionShape> = {
    w: T.number,
    h: T.number,
    projectId: T.number,
    videoUrl: T.string,
    title: T.string,
    downloadUrl: T.string,
    previewLabel: T.string,
    downloadLabel: T.string,
    retryLabel: T.string,
    provenanceText: T.string,
    blockingText: T.string,
    retryFeedback: T.string,
    retryRunId: T.any,
    retryThreadId: T.any,
    sectionState: T.string,
    placeholder: T.boolean,
    statusLabel: T.string,
    placeholderText: T.string,
  };

  getDefaultProps(): VideoSectionShape["props"] {
    return {
      w: 600,
      h: 450,
      projectId: 0,
      videoUrl: "",
      title: "最终视频",
      downloadUrl: "",
      previewLabel: "预览最终视频",
      downloadLabel: "下载最终视频",
      retryLabel: "重试合成",
      provenanceText: "来源：等待分镜片段完成后生成最终视频",
      blockingText: "",
      retryFeedback: "请基于当前最终视频重新合成。",
      retryRunId: null,
      retryThreadId: null,
      sectionState: "blocked",
      placeholder: true,
      statusLabel: getWorkspaceSectionStatusLabel("blocked"),
      placeholderText: getWorkspaceSectionPlaceholderText("final-output"),
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

  getGeometry(shape: VideoSectionShape): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  component(shape: VideoSectionShape) {
    const {
      projectId,
      videoUrl,
      title,
      downloadUrl,
      provenanceText,
      blockingText,
      retryFeedback,
      retryRunId,
      retryThreadId,
      placeholder,
      placeholderText,
      statusLabel,
      sectionState,
    } = shape.props;

    const handlePreview = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (videoUrl) {
        canvasEvents.emit("preview-video", { src: videoUrl, title });
      }
    };

    const handleDownload = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
		const resolvedDownloadUrl = getStaticUrl(downloadUrl) || downloadUrl || videoUrl;
		try {
			const response = await fetch(resolvedDownloadUrl);
			if (!response.ok) {
				throw new Error(`download failed: ${response.status}`);
			}
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
        a.href = url;
        a.download = `${title || "video"}.mp4`;
        document.body.appendChild(a);
        a.click();
			setTimeout(() => window.URL.revokeObjectURL(url), 0);
        document.body.removeChild(a);
      } catch (err) {
        console.error("下载失败:", err);
			window.open(resolvedDownloadUrl, "_blank");
      }
    };

    const handleRetry = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      canvasEvents.emit("retry-final-output", {
        projectId,
        feedback: retryFeedback,
        runId: retryRunId ?? null,
        threadId: retryThreadId ?? null,
      });
    };

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          pointerEvents: "all",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: shape.props.w, height: shape.props.h, overflow: "hidden", borderRadius: 12, background: "var(--fallback-b1,oklch(var(--b1)))", clipPath: "inset(0 round 12px)" }}>
          {/* 标题栏 — 固定高度 */}
          <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-error/20 flex items-center justify-center">
                <FireIcon className="w-4 h-4 text-error" />
              </div>
              <h2 className="text-lg font-heading font-bold text-base-content">艺术总监</h2>
            </div>
            <span className={`badge badge-sm ${getWorkspaceSectionStatusBadgeClass(sectionState)}`}>
              {statusLabel}
            </span>
          </div>

          {/* 内容 — flex 剩余空间 */}
          {videoUrl ? (
            <div className="overflow-y-auto px-4 pb-3" style={{ height: shape.props.h - 52 - 12 }}>
              <video
                className="w-full rounded-lg bg-black"
                src={videoUrl}
                controls
                onPointerDown={(e) => e.stopPropagation()}
                aria-label={title}
              >
                <track
                  kind="captions"
                  label="中文"
                  srcLang="zh"
                  default
                  src={`data:text/vtt;charset=utf-8,${encodeURIComponent(
                    `WEBVTT\n\n00:00:00.000 --> 00:00:05.000\n${title || "最终视频"}`
                  )}`}
                />
              </video>
              <div className="mt-3 space-y-2">
                <p className="text-xs text-base-content/70">{provenanceText}</p>
                {blockingText && <p className="text-xs text-warning-content">{blockingText}</p>}
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={handlePreview} onPointerDown={(e) => e.stopPropagation()} className="btn btn-sm btn-outline btn-secondary">预览</button>
                  <button type="button" onClick={handleDownload} onPointerDown={(e) => e.stopPropagation()} className="btn btn-sm btn-outline btn-primary">下载</button>
                  <button type="button" onClick={handleRetry} onPointerDown={(e) => e.stopPropagation()} className="btn btn-sm btn-outline btn-warning">重试</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-base-content/50">
              <VideoCameraIcon className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{placeholder ? placeholderText : "等待视频合成..."}</p>
            </div>
          )}
        </div>
      </HTMLContainer>
    );
  }

  indicator() {
    return null;
  }
}

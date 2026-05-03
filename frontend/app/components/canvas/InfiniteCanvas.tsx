import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type Editor,
	type TLComponents,
	type TLShapePartial,
	Tldraw,
} from "tldraw";
import "tldraw/tldraw.css";
import { useQuery } from "@tanstack/react-query";
import { useCanvasLayout } from "~/hooks/useCanvasLayout";
import {
	getStaticUrl,
	projectsApi,
} from "~/services/api";
import { useEditorStore } from "~/stores/editorStore";
import {
	buildWorkspaceStatus,
	deriveWorkspaceRunState,
	getWorkspaceFinalOutputMeta,
} from "~/utils/workspaceStatus";
import { CanvasToolbar } from "./CanvasToolbar";
import { canvasEvents } from "./canvasEvents";
import { ImagePreviewModal, VideoPreviewModal } from "./PreviewModals";
import { customShapeUtils } from "./shapes";

interface InfiniteCanvasProps {
	projectId: number;
}

// 隐藏 tldraw 默认 UI
const components: TLComponents = {
	PageMenu: null,
	MainMenu: null,
	Toolbar: null,
	StylePanel: null,
	NavigationPanel: null,
	HelpMenu: null,
	DebugPanel: null,
	DebugMenu: null,
	MenuPanel: null,
	TopPanel: null,
	SharePanel: null,
	ActionsMenu: null,
	QuickActions: null,
	KeyboardShortcutsDialog: null,
	HelperButtons: null,
	ZoomMenu: null,
};

export function InfiniteCanvas({ projectId }: InfiniteCanvasProps) {
	const editorRef = useRef<Editor | null>(null);
	const [isInitialized, setIsInitialized] = useState(false);
	const lastAppliedShapesSignatureRef = useRef<string | null>(null);
	const shapesRef = useRef<TLShapePartial[]>([]);
	const shapesSignatureRef = useRef("");

	// Store 数据
	const {
		characters,
		shots,
		projectVideoUrl,
		currentStage,
		isGenerating,
		awaitingConfirm,
		recoverySummary,
		currentRunProviderSnapshot,
		currentRunId,
	} = useEditorStore();

	// 项目数据
	const { data: project } = useQuery({
		queryKey: ["project", projectId],
		queryFn: () => projectsApi.get(projectId),
	});

	// Modal 状态
	const [previewImage, setPreviewImage] = useState<{
		src: string;
		alt: string;
	} | null>(null);
	const [previewVideo, setPreviewVideo] = useState<{
		src: string;
		title: string;
	} | null>(null);

	// 视频 URL
	const rawVideoUrl = projectVideoUrl || project?.video_url;
	const finalVideoUrl = rawVideoUrl ? getStaticUrl(rawVideoUrl) : null;
	const finalOutputProject = useMemo(() => {
		if (!project) {
			return null;
		}

		return {
			...project,
			video_url: rawVideoUrl || null,
		};
	}, [project, rawVideoUrl]);

	const videoProviderValid = currentRunProviderSnapshot?.video?.valid;
	const finalOutputMeta = useMemo(() => {
		if (!finalOutputProject) {
			return null;
		}

		return getWorkspaceFinalOutputMeta({
			project: finalOutputProject,
			currentStage: recoverySummary?.current_stage ?? currentStage,
			runState: deriveWorkspaceRunState({
				projectStatus: finalOutputProject.status,
				isGenerating,
				awaitingConfirm,
				currentRunId,
			}),
			characters,
			shots,
			recoverySummary,
			videoProviderValid,
		});
	}, [
		finalOutputProject,
		recoverySummary,
		currentStage,
		isGenerating,
		awaitingConfirm,
		characters,
		shots,
		videoProviderValid,
		currentRunId,
	]);

	// 计算布局
	const shapes = useCanvasLayout({
		projectId,
		story: project?.story || null,
		summary: project?.summary || null,
		characters,
		shots,
		videoUrl: finalVideoUrl,
		videoTitle: project?.title || "最终视频",
		workspaceStatus: useMemo(() => {
			if (!project) {
				return undefined;
			}

			return buildWorkspaceStatus({
				project,
				currentStage: recoverySummary?.current_stage ?? currentStage,
				runState: deriveWorkspaceRunState({
					projectStatus: project.status,
					isGenerating,
					awaitingConfirm,
					currentRunId,
				}),
				characters,
				shots,
				recoverySummary,
				videoProviderValid,
			});
		}, [
			project,
			recoverySummary,
			currentStage,
			isGenerating,
			awaitingConfirm,
			characters,
			shots,
			videoProviderValid,
			currentRunId,
		]),
		finalOutputMeta,
	});
	const shapesSignature = useMemo(() => JSON.stringify(shapes), [shapes]);
	shapesRef.current = shapes;
	shapesSignatureRef.current = shapesSignature;

	// 监听画布事件
	useEffect(() => {
		const unsubscribers = [
			canvasEvents.on("preview-image", setPreviewImage),
			canvasEvents.on("preview-video", setPreviewVideo),
		];

		return () => {
			unsubscribers.forEach((unsub) => {
				unsub();
			});
		};
	}, []);

	// 初始化画布
	const handleMount = useCallback((editor: Editor) => {
		editorRef.current = editor;
		const currentShapes = shapesRef.current;
		const currentSignature = shapesSignatureRef.current;

		// 创建初始 shapes
		if (currentShapes.length > 0) {
			editor.createShapes(currentShapes);
			lastAppliedShapesSignatureRef.current = currentSignature;

			// 缩放到适合视图
			setTimeout(() => {
				editor.zoomToFit({ animation: { duration: 300 } });
			}, 100);
		} else {
			lastAppliedShapesSignatureRef.current = currentSignature;
		}

		setIsInitialized(true);
	}, []);

	// 数据变化时更新画布
	useEffect(() => {
		const editor = editorRef.current;
		if (!editor || !isInitialized) return;
		if (lastAppliedShapesSignatureRef.current === shapesSignature) return;

		// 获取当前所有 shape
		const currentShapes = editor.getCurrentPageShapes();
		const currentIds = new Set(currentShapes.map((s) => s.id));
		const newIds = new Set(shapes.map((s) => s.id));

		// 删除不再存在的 shapes
		const toDelete = currentShapes.filter((s) => !newIds.has(s.id));
		if (toDelete.length > 0) {
			editor.deleteShapes(toDelete.map((s) => s.id));
		}

		// 更新或创建 shapes
		shapes.forEach((shape) => {
			if (currentIds.has(shape.id)) {
				editor.updateShapes([shape]);
			} else {
				editor.createShapes([shape]);
			}
		});

		lastAppliedShapesSignatureRef.current = shapesSignature;
	}, [shapes, shapesSignature, isInitialized]);

	return (
		<>
			<div className="h-full w-full infinite-canvas-container relative">
				<Tldraw
					shapeUtils={customShapeUtils}
					components={components}
					onMount={handleMount}
					hideUi
				>
					<CanvasToolbar />
				</Tldraw>
			</div>

			{/* 图片预览 Modal */}
			{previewImage && (
				<ImagePreviewModal
					src={previewImage.src}
					alt={previewImage.alt}
					onClose={() => setPreviewImage(null)}
				/>
			)}

			{/* 视频预览 Modal */}
			{previewVideo && (
				<VideoPreviewModal
					src={previewVideo.src}
					title={previewVideo.title}
					onClose={() => setPreviewVideo(null)}
					showDownload={false}
				/>
			)}
		</>
	);
}

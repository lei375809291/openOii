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
import type { SectionKey } from "~/hooks/useCanvasLayout";
import { getStaticUrl, projectsApi } from "~/services/api";
import { useEditorStore } from "~/stores/editorStore";
import { CanvasToolbar } from "./CanvasToolbar";
import { canvasEvents } from "./canvasEvents";
import { ImagePreviewModal, VideoPreviewModal } from "./PreviewModals";
import { customShapeUtils } from "./shapes";
import { getPipelineStageIndex } from "~/utils/pipeline";

interface InfiniteCanvasProps {
	projectId: number;
}

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

const SECTION_ORDER: SectionKey[] = ["plan", "render", "compose"];

export function InfiniteCanvas({ projectId }: InfiniteCanvasProps) {
	const editorRef = useRef<Editor | null>(null);
	const [isInitialized, setIsInitialized] = useState(false);
	const lastAppliedShapesSignatureRef = useRef<string | null>(null);
	const shapesRef = useRef<TLShapePartial[]>([]);
	const shapesSignatureRef = useRef("");

	const {
		characters,
		shots,
		projectVideoUrl,
		currentStage,
		isGenerating,
		awaitingConfirm,
		recoverySummary,
		currentRunId,
	} = useEditorStore();

	const { data: project } = useQuery({
		queryKey: ["project", projectId],
		queryFn: () => projectsApi.get(projectId),
	});

	const [previewImage, setPreviewImage] = useState<{
		src: string;
		alt: string;
	} | null>(null);
	const [previewVideo, setPreviewVideo] = useState<{
		src: string;
		title: string;
	} | null>(null);

	const rawVideoUrl = projectVideoUrl || project?.video_url;
	const finalVideoUrl = rawVideoUrl ? getStaticUrl(rawVideoUrl) : null;

	const currentStageIndex = useMemo(
		() => getPipelineStageIndex(recoverySummary?.current_stage ?? currentStage),
		[recoverySummary, currentStage]
	);

	const visibleSections = useMemo((): SectionKey[] => {
		const sectionIndex = Math.max(
			currentStageIndex >= 0 ? currentStageIndex : 0,
			recoverySummary?.preserved_stages?.reduce(
				(max, s) => Math.max(max, getPipelineStageIndex(s)),
				0
			) ?? 0
		);

		return SECTION_ORDER.filter((section) => {
		if (section === "plan") return true;
		if (section === "render") return characters.length > 0 || shots.length > 0 || sectionIndex >= 1;
		if (section === "compose") return Boolean(finalVideoUrl) || shots.some((s) => Boolean(s.video_url)) || sectionIndex >= 2;
		return false;
	});
	}, [characters, shots, finalVideoUrl, currentStageIndex, recoverySummary]);

	const shapes = useCanvasLayout({
		projectId,
		story: project?.story || null,
		summary: project?.summary || null,
		characters,
		shots,
		videoUrl: finalVideoUrl,
		videoTitle: project?.title || "最终视频",
		visibleSections,
		isGenerating,
		awaitingConfirm,
		currentRunId,
		currentStage,
	});

	const shapesSignature = useMemo(() => JSON.stringify(shapes), [shapes]);
	shapesRef.current = shapes;
	shapesSignatureRef.current = shapesSignature;

	useEffect(() => {
		const unsubscribers = [
			canvasEvents.on("preview-image", setPreviewImage),
			canvasEvents.on("preview-video", setPreviewVideo),
		];
		return () => {
			unsubscribers.forEach((unsub) => unsub());
		};
	}, []);

	const handleMount = useCallback((editor: Editor) => {
		editorRef.current = editor;
		const currentShapes = shapesRef.current;
		const currentSignature = shapesSignatureRef.current;

		if (currentShapes.length > 0) {
			editor.createShapes(currentShapes);
			lastAppliedShapesSignatureRef.current = currentSignature;
			setTimeout(() => {
				editor.zoomToFit({ animation: { duration: 300 } });
			}, 100);
		} else {
			lastAppliedShapesSignatureRef.current = currentSignature;
		}

		setIsInitialized(true);
	}, []);

	useEffect(() => {
		const editor = editorRef.current;
		if (!editor || !isInitialized) return;
		if (lastAppliedShapesSignatureRef.current === shapesSignature) return;

		const currentShapes = editor.getCurrentPageShapes();
		const currentIds = new Set(currentShapes.map((s) => s.id));
		const newIds = new Set(shapes.map((s) => s.id));

		const toDelete = currentShapes.filter((s) => !newIds.has(s.id));
		if (toDelete.length > 0) {
			editor.deleteShapes(toDelete.map((s) => s.id));
		}

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

			{previewImage && (
				<ImagePreviewModal
					src={previewImage.src}
					alt={previewImage.alt}
					onClose={() => setPreviewImage(null)}
				/>
			)}

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

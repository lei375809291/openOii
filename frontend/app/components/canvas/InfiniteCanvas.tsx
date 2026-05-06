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
import { SECTION_ORDER } from "~/hooks/useCanvasLayout";
import { registerCollisionSystem, layoutAllSections } from "~/hooks/useCollisionSystem";
import { getStaticUrl, projectsApi, assetsApi } from "~/services/api";
import { useEditorStore, useShallow } from "~/stores/editorStore";
import { CanvasToolbar } from "./CanvasToolbar";
import { canvasEvents, type CanvasEvents } from "./canvasEvents";
import { ImagePreviewModal, VideoPreviewModal } from "./PreviewModals";
import { customShapeUtils } from "./shapes";
import { getPipelineStageIndex } from "~/utils/pipeline";
import { toast } from "~/utils/toast";
import { ShapeContextMenu } from "./ShapeContextMenu";

interface InfiniteCanvasProps {
	projectId: number;
}

const components: TLComponents = {
	PageMenu: null,
	MainMenu: null,
	Toolbar: null,
	StylePanel: null,
	NavigationPanel: undefined,
	Minimap: undefined,
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
	ContextMenu: null,
};

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
	} = useEditorStore(useShallow((s) => ({
		characters: s.characters,
		shots: s.shots,
		projectVideoUrl: s.projectVideoUrl,
		currentStage: s.currentStage,
		isGenerating: s.isGenerating,
		awaitingConfirm: s.awaitingConfirm,
		recoverySummary: s.recoverySummary,
		currentRunId: s.currentRunId,
	})));

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
		if (section === "character") return characters.length > 0 || sectionIndex >= 1;
		if (section === "shot") return shots.length > 0 || sectionIndex >= 2;
		if (section === "compose") return Boolean(finalVideoUrl) || shots.some((s) => Boolean(s.video_url)) || sectionIndex >= 3;
		return false;
		});
	}, [characters, shots, finalVideoUrl, currentStageIndex, recoverySummary]);

	const layout = useCanvasLayout({
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

	const shapesSignature = useMemo(() => JSON.stringify(layout), [layout]);
	shapesRef.current = layout.shapes;
	shapesSignatureRef.current = shapesSignature;

	const handleShapeAction = useCallback((data: CanvasEvents["shape-action"]) => {
		if (data.action === "add-to-assets" && data.entityType === "character" && data.entityId) {
			assetsApi.createFromCharacter(data.entityId).then(() => {
				toast.success({ title: "资产库", message: "已添加到资产库" });
			}).catch(() => {
				toast.error({ title: "资产库", message: "添加失败" });
			});
			return;
		}
		const feedbackMap: Record<string, string> = {
			regenerate: `请重新生成`,
			edit: `请修改内容`,
			approve: `批准通过`,
		};
		const content = feedbackMap[data.action] || "请修改";
		projectsApi.feedback(projectId, content, currentRunId ?? undefined, data.feedbackType, data.entityType, data.entityId ?? undefined);
	}, [projectId, currentRunId]);

	useEffect(() => {
		const unsubscribers = [
			canvasEvents.on("preview-image", setPreviewImage),
			canvasEvents.on("preview-video", setPreviewVideo),
			canvasEvents.on("shape-action", handleShapeAction),
		];
		return () => {
			unsubscribers.forEach((unsub) => unsub());
		};
	}, [handleShapeAction]);

	const handleMount = useCallback((editor: Editor) => {
		editorRef.current = editor;

		if (typeof indexedDB !== "undefined" && indexedDB.databases) {
			indexedDB.databases().then((dbs) => {
				for (const db of dbs) {
					if (db.name && db.name.startsWith("TLDRAW_")) {
						indexedDB.deleteDatabase(db.name);
					}
				}
			});
		}

		const allShapes = editor.getCurrentPageShapes();
		const staleTypes = new Set(["connector", "ConnectorShape", "arrow"]);
		const staleShapeIds = allShapes
			.filter((s) => staleTypes.has(s.type))
			.map((s) => s.id);
		if (staleShapeIds.length > 0) {
			editor.deleteShapes(staleShapeIds);
		}

		registerCollisionSystem(editor);

		const currentShapes = shapesRef.current;
		const currentSignature = shapesSignatureRef.current;

		if (currentShapes.length > 0) {
			editor.run(() => {
				editor.createShapes(currentShapes);
			});
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

		const sectionShapes = layout.shapes;
		const currentShapes = editor.getCurrentPageShapes();
		const currentIds = new Set(currentShapes.map((s) => s.id));
		const newSectionIds = new Set(sectionShapes.map((s) => s.id));

		editor.run(() => {
			const toDelete = currentShapes.filter((s) => !newSectionIds.has(s.id));
			if (toDelete.length > 0) {
				editor.deleteShapes(toDelete.map((s) => s.id));
			}

			for (const shape of sectionShapes) {
				if (currentIds.has(shape.id)) {
					const { h: _h, ...propsWithoutH } = shape.props as any;
					editor.updateShape({ id: shape.id, type: shape.type, props: propsWithoutH } as any);
				} else {
					editor.createShapes([shape]);
				}
			}

			layoutAllSections(editor, false);
		});

		const newlyCreated = sectionShapes.filter((s) => !currentIds.has(s.id));
		if (newlyCreated.length > 0) {
			const lastShape = newlyCreated[newlyCreated.length - 1];
			if (lastShape.id) {
				const shapeOnPage = editor.getShape(lastShape.id as any);
				if (shapeOnPage) {
					const bounds = editor.getShapeGeometry(shapeOnPage).bounds;
					editor.zoomToBounds(
						{ x: shapeOnPage.x + bounds.x, y: shapeOnPage.y + bounds.y, w: bounds.w, h: bounds.h },
						{ animation: { duration: 400 }, targetZoom: editor.getZoomLevel() }
					);
				}
			}
		}

		lastAppliedShapesSignatureRef.current = shapesSignature;
	}, [layout, shapesSignature, isInitialized]);

	return (
		<>
			<div className="h-full w-full infinite-canvas-container relative">
				<Tldraw
					shapeUtils={customShapeUtils}
					components={components}
					onMount={handleMount}
					persistenceKey="openoii-canvas-v8"
				>
					<CanvasToolbar />
					<ShapeContextMenu />
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

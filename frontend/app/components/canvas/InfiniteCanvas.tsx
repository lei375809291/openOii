import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type Editor,
	type TLComponents,
	Tldraw,
	type TLShape,
	type TLShapePartial,
} from "tldraw";
import "tldraw/tldraw.css";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCanvasLayout } from "~/hooks/useCanvasLayout";
import type { SectionKey } from "~/hooks/useCanvasLayout";
import { SECTION_ORDER } from "~/hooks/useCanvasLayout";
import {
	getStaticUrl,
	projectsApi,
	assetsApi,
	charactersApi,
	shotsApi,
} from "~/services/api";
import { useEditorStore, useShallow } from "~/stores/editorStore";
import { CanvasToolbar } from "./CanvasToolbar";
import { canvasEvents, type CanvasEvents } from "./canvasEvents";
import { ImagePreviewModal, VideoPreviewModal } from "./PreviewModals";
import { customShapeUtils } from "./shapes";
import { getPipelineStageIndex } from "~/utils/pipeline";
import { toast } from "~/utils/toast";
import { ApiError } from "~/types/errors";
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

const PROJECTED_SHAPE_TYPES = new Set([
	"storyboard-board",
]);

const STALE_SHAPE_TYPES = new Set([
	"connector",
	"ConnectorShape",
	"script-section",
	"plan-section",
	"character-section",
	"storyboard-section",
	"video-section",
	"compose-section",
]);

const WORKFLOW_ARROW_META = "openoii-workflow-arrow";

function isProjectedCanvasShape(shape: TLShape): boolean {
	return (
		PROJECTED_SHAPE_TYPES.has(shape.type) ||
		STALE_SHAPE_TYPES.has(shape.type) ||
		(shape.type === "arrow" && shape.meta?.[WORKFLOW_ARROW_META] === true)
	);
}

function shapesEqual(existing: TLShape, desired: TLShapePartial): boolean {
	return (
		existing.type === desired.type &&
		existing.x === (desired.x ?? 0) &&
		existing.y === (desired.y ?? 0) &&
		JSON.stringify(existing.props ?? {}) === JSON.stringify(desired.props ?? {}) &&
		JSON.stringify(existing.meta ?? {}) === JSON.stringify(desired.meta ?? {})
	);
}

function errorMessage(error: unknown, fallback: string): string {
	if (error instanceof ApiError) return error.message;
	if (error instanceof Error) return error.message;
	return fallback;
}

export function InfiniteCanvas({ projectId }: InfiniteCanvasProps) {
	const queryClient = useQueryClient();
	const editorRef = useRef<Editor | null>(null);
	const [isInitialized, setIsInitialized] = useState(false);
	const lastAppliedShapesSignatureRef = useRef<string | null>(null);
	const shapesRef = useRef<TLShapePartial[]>([]);
	const shapesSignatureRef = useRef("");

	const {
		characters,
		shots,
		projectVideoUrl,
		projectTitle,
		projectSummary,
		projectStory,
		currentStage,
		isGenerating,
		awaitingConfirm,
		recoverySummary,
		currentRunId,
		blockingClips,
		updateCharacter,
		updateShot,
	} = useEditorStore(
		useShallow((s) => ({
			characters: s.characters,
			shots: s.shots,
			projectVideoUrl: s.projectVideoUrl,
			projectTitle: s.projectTitle,
			projectSummary: s.projectSummary,
			projectStory: s.projectStory,
			currentStage: s.currentStage,
			isGenerating: s.isGenerating,
			awaitingConfirm: s.awaitingConfirm,
			recoverySummary: s.recoverySummary,
			currentRunId: s.currentRunId,
			blockingClips: s.blockingClips,
			updateCharacter: s.updateCharacter,
			updateShot: s.updateShot,
		})),
	);

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

	const rawVideoUrl = projectVideoUrl;
	const finalVideoUrl = rawVideoUrl ? getStaticUrl(rawVideoUrl) : null;
	const story = projectStory ?? project?.story ?? null;
	const summary = projectSummary ?? project?.summary ?? null;
	const videoTitle = projectTitle ?? project?.title ?? "最终视频";

	const currentStageIndex = useMemo(
		() => getPipelineStageIndex(recoverySummary?.current_stage ?? currentStage),
		[recoverySummary, currentStage],
	);

	const visibleSections = useMemo((): SectionKey[] => {
		const sectionIndex = Math.max(
			currentStageIndex >= 0 ? currentStageIndex : 0,
			recoverySummary?.preserved_stages?.reduce(
				(max, s) => Math.max(max, getPipelineStageIndex(s)),
				0,
			) ?? 0,
		);

		return SECTION_ORDER.filter((section) => {
			if (section === "plan") return true;
			if (section === "render")
				return (
					characters.length > 0 ||
					shots.some((s) => Boolean(s.image_url)) ||
					sectionIndex >= 1
				);
			if (section === "compose")
				return (
					Boolean(finalVideoUrl) ||
					shots.some((s) => Boolean(s.video_url)) ||
					sectionIndex >= 2
				);
			return false;
		});
	}, [characters, shots, finalVideoUrl, currentStageIndex, recoverySummary]);

	const layout = useCanvasLayout({
		projectId,
		story,
		summary,
		characters,
		shots,
		videoUrl: finalVideoUrl,
		videoTitle,
		visibleSections,
		isGenerating,
		awaitingConfirm,
		currentRunId,
		currentStage,
		blockingClips,
	});

	const shapesSignature = useMemo(() => JSON.stringify(layout.shapes), [layout.shapes]);
	shapesRef.current = layout.shapes;
	shapesSignatureRef.current = shapesSignature;

	const invalidateProjectData = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ["project", projectId] });
		queryClient.invalidateQueries({ queryKey: ["projects"] });
		queryClient.invalidateQueries({ queryKey: ["characters", projectId] });
		queryClient.invalidateQueries({ queryKey: ["shots", projectId] });
	}, [projectId, queryClient]);

	const handleShapeAction = useCallback(
		(data: CanvasEvents["shape-action"]) => {
			if (data.action === "history") {
				canvasEvents.emit("version-history", {
					entityType: data.entityType,
					entityId: data.entityId,
				});
				return;
			}

			if (data.action === "add-to-assets" && data.entityId) {
				const request = data.entityType === "character"
					? assetsApi.createFromCharacter(data.entityId)
					: assetsApi.createFromShot(data.entityId);
				request
					.then(() => {
						queryClient.invalidateQueries({ queryKey: ["assets"] });
						toast.success({ title: "资产库", message: data.entityType === "character" ? "已添加到资产库" : "已保存为场景资产" });
					})
					.catch((error) => toast.error({ title: "资产库", message: errorMessage(error, "保存失败") }));
				return;
			}

			if (data.action === "approve") {
				const request = data.entityType === "character"
					? charactersApi.approve(data.entityId)
					: shotsApi.approve(data.entityId);
				request
					.then((entity) => {
						if (data.entityType === "character") updateCharacter(entity as typeof characters[number]);
						else updateShot(entity as typeof shots[number]);
						invalidateProjectData();
						toast.success({ title: "审批", message: "已批准" });
					})
					.catch((error) => toast.error({ title: "审批", message: errorMessage(error, "批准失败") }));
				return;
			}

			if (data.action === "regenerate") {
				const request = data.entityType === "character"
					? charactersApi.regenerate(data.entityId)
					: shotsApi.regenerate(data.entityId, "image");
				request
					.then(() => {
						invalidateProjectData();
						toast.success({ title: "重新生成", message: "任务已启动" });
					})
					.catch((error) => toast.error({ title: "重新生成", message: errorMessage(error, "启动失败") }));
				return;
			}

			if (data.action === "edit" && data.entityType === "shot" && data.shotPatch) {
				shotsApi.update(data.entityId, data.shotPatch)
					.then((shot) => {
						updateShot(shot);
						invalidateProjectData();
						toast.success({ title: "镜头", message: "已保存修改" });
					})
					.catch((error) => toast.error({ title: "镜头", message: errorMessage(error, "保存失败") }));
				return;
			}

			if (data.action === "edit") {
				const content = data.feedbackContent?.trim();
				if (!content) return;
				projectsApi.feedback(projectId, content, currentRunId ?? undefined, data.feedbackType, data.entityType, data.entityId)
					.then(() => {
						invalidateProjectData();
						toast.success({ title: "修改意见", message: "已提交" });
					})
					.catch((error) => toast.error({ title: "修改意见", message: errorMessage(error, "提交失败") }));
			}
		},
		[projectId, currentRunId, queryClient, updateCharacter, updateShot, invalidateProjectData],
	);

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


		// Delete any stale shapes from previous layout architectures.
		const allShapes = editor.getCurrentPageShapes();
		const staleShapeIds = allShapes
			.filter(
				(s) =>
					STALE_SHAPE_TYPES.has(s.type) ||
					(s.type === "arrow" && s.meta?.[WORKFLOW_ARROW_META] === true),
			)
			.map((s) => s.id);
		if (staleShapeIds.length > 0) {
			editor.deleteShapes(staleShapeIds);
		}

		const currentShapes = shapesRef.current;
		const currentSignature = shapesSignatureRef.current;
		if (currentShapes.length === 0) {
			const projectedShapeIds = editor
				.getCurrentPageShapes()
				.filter(isProjectedCanvasShape)
				.map((shape) => shape.id);
			if (projectedShapeIds.length > 0) {
				editor.deleteShapes(projectedShapeIds);
			}
			lastAppliedShapesSignatureRef.current = currentSignature;
			setIsInitialized(true);
			return;
		}

		if (currentShapes.length > 0) {
			const existingMap = new Map(
				editor.getCurrentPageShapes().map((shape) => [shape.id, shape]),
			);
			const toCreate: TLShapePartial[] = [];
			const toUpdate: TLShapePartial[] = [];
			for (const desired of currentShapes) {
				const existing = existingMap.get(desired.id);
				if (!existing) {
					toCreate.push(desired);
				} else if (!shapesEqual(existing, desired)) {
					toUpdate.push(desired);
				}
			}

			editor.run(() => {
				if (toCreate.length > 0) editor.createShapes(toCreate);
				if (toUpdate.length > 0) editor.updateShapes(toUpdate);
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

	// Sync the projected storyboard board when backend data changes.
	useEffect(() => {
		const editor = editorRef.current;
		if (!editor || !isInitialized) return;
		if (lastAppliedShapesSignatureRef.current === shapesSignature) return;

		const desiredShapes = layout.shapes;
		const existingShapes = editor.getCurrentPageShapes();
		if (desiredShapes.length === 0) {
			const toDelete = existingShapes
				.filter(isProjectedCanvasShape)
				.map((shape) => shape.id);
			if (toDelete.length > 0) {
				editor.deleteShapes(toDelete);
			}
			lastAppliedShapesSignatureRef.current = shapesSignature;
			return;
		}

		const desiredIds = new Set(desiredShapes.map((s) => s.id));
		const existingMap = new Map(existingShapes.map((s) => [s.id, s]));

		editor.run(() => {
			const toDelete = existingShapes.filter((s) => {
				if (s.type === "arrow" && s.meta?.[WORKFLOW_ARROW_META] === true) {
					return true;
				}
				return (
					STALE_SHAPE_TYPES.has(s.type) ||
					(PROJECTED_SHAPE_TYPES.has(s.type) && !desiredIds.has(s.id))
				);
			});
			if (toDelete.length > 0) {
				editor.deleteShapes(toDelete.map((s) => s.id));
			}

			const toCreate: TLShapePartial[] = [];
			const toUpdate: TLShapePartial[] = [];
			for (const desired of desiredShapes) {
				if (!existingMap.has(desired.id)) {
					toCreate.push(desired);
				} else {
					const existing = existingMap.get(desired.id);
					if (existing && !shapesEqual(existing, desired)) toUpdate.push(desired);
				}
			}

			if (toCreate.length > 0) editor.createShapes(toCreate);
			if (toUpdate.length > 0) editor.updateShapes(toUpdate);
		});

		// If this is the first time we're adding shapes, zoom to fit
		if (existingShapes.length === 0 && desiredShapes.length > 0) {
			setTimeout(() => {
				editor.zoomToFit({ animation: { duration: 400 } });
			}, 100);
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
					persistenceKey={`openoii-canvas-v13-project-${projectId}`}
				>
					<CanvasToolbar projectId={projectId} />
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

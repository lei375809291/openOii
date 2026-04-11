import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type Editor,
	type TLComponents,
	type TLShapePartial,
	Tldraw,
} from "tldraw";
import "tldraw/tldraw.css";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ConfirmModal } from "~/components/ui/ConfirmModal";
import { EditModal } from "~/components/ui/EditModal";
import { useCanvasLayout } from "~/hooks/useCanvasLayout";
import {
	charactersApi,
	getStaticUrl,
	projectsApi,
	shotsApi,
} from "~/services/api";
import { useEditorStore } from "~/stores/editorStore";
import type {
	Character,
	CharacterUpdatePayload,
	Shot,
	ShotUpdatePayload,
} from "~/types";
import { buildWorkspaceStatus } from "~/utils/workspaceStatus";
import { CanvasToolbar } from "./CanvasToolbar";
import { canvasEvents } from "./canvasEvents";
import { ImagePreviewModal, VideoPreviewModal } from "./PreviewModals";
import { customShapeUtils } from "./shapes";

interface InfiniteCanvasProps {
	projectId: number;
}

function parseNumberField(value: string) {
	const trimmed = value.trim();
	if (!trimmed) return null;

	const parsed = Number(trimmed);
	return Number.isFinite(parsed) ? parsed : null;
}

function parseNumberList(value: string) {
	const trimmed = value.trim();
	if (!trimmed) return null;

	const parsed = trimmed
		.split(/[,\s]+/)
		.map((entry) => Number(entry.trim()))
		.filter((entry) => Number.isFinite(entry));

	return parsed.length > 0 ? parsed : null;
}

function getCharacterEditData(character: Character): Record<string, string> {
	const isSuperseded = character.approval_state === "superseded";

	return {
		description: isSuperseded
			? character.approved_description || character.description || ""
			: character.description || "",
		image_url: isSuperseded
			? character.approved_image_url || character.image_url || ""
			: character.image_url || "",
	};
}

function getShotEditData(shot: Shot): Record<string, string> {
	const isSuperseded = shot.approval_state === "superseded";

	return {
		description: isSuperseded
			? shot.approved_description || shot.description
			: shot.description,
		prompt: isSuperseded
			? shot.approved_prompt || shot.prompt || ""
			: shot.prompt || "",
		image_prompt: isSuperseded
			? shot.approved_image_prompt || shot.image_prompt || ""
			: shot.image_prompt || "",
		duration: String(
			isSuperseded
				? (shot.approved_duration ?? shot.duration ?? "")
				: (shot.duration ?? ""),
		),
		camera: isSuperseded
			? shot.approved_camera || shot.camera || ""
			: shot.camera || "",
		motion_note: isSuperseded
			? shot.approved_motion_note || shot.motion_note || ""
			: shot.motion_note || "",
		character_ids: String(
			(isSuperseded ? shot.approved_character_ids : shot.character_ids).join(
				",",
			),
		),
	};
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
		recoverySummary,
		updateCharacter,
		updateShot,
		removeCharacter,
		removeShot,
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
	const [editingCharacter, setEditingCharacter] = useState<Character | null>(
		null,
	);
	const [editingShot, setEditingShot] = useState<Shot | null>(null);
	const [deletingCharacter, setDeletingCharacter] = useState<Character | null>(
		null,
	);
	const [deletingShot, setDeletingShot] = useState<Shot | null>(null);

	// Mutations
	const updateCharacterMutation = useMutation({
		mutationFn: async ({
			id,
			data,
		}: {
			id: number;
			data: CharacterUpdatePayload;
		}) => {
			const updatedChar = await charactersApi.update(id, data);
			updateCharacter(updatedChar);
			await charactersApi.regenerate(id);
			return updatedChar;
		},
		onSuccess: () => {
			setEditingCharacter(null);
		},
	});

	const approveCharacterMutation = useMutation({
		mutationFn: (id: number) => charactersApi.approve(id),
		onSuccess: (approvedCharacter) => {
			updateCharacter(approvedCharacter);
		},
	});

	const deleteCharacterMutation = useMutation({
		mutationFn: (id: number) => charactersApi.delete(id),
		onSuccess: (_, deletedId) => {
			removeCharacter(deletedId);
			setDeletingCharacter(null);
		},
	});

	const updateShotMutation = useMutation({
		mutationFn: async ({
			id,
			data,
		}: {
			id: number;
			data: ShotUpdatePayload;
		}) => {
			const updatedShot = await shotsApi.update(id, data);
			updateShot(updatedShot);
			await shotsApi.regenerate(id, "video");
			return updatedShot;
		},
		onSuccess: () => {
			setEditingShot(null);
		},
	});

	const approveShotMutation = useMutation({
		mutationFn: (id: number) => shotsApi.approve(id),
		onSuccess: (approvedShot) => {
			updateShot(approvedShot);
		},
	});

	const deleteShotMutation = useMutation({
		mutationFn: (id: number) => shotsApi.delete(id),
		onSuccess: (_, deletedId) => {
			removeShot(deletedId);
			setDeletingShot(null);
		},
	});

	// 视频 URL
	const rawVideoUrl = projectVideoUrl || project?.video_url;
	const finalVideoUrl = rawVideoUrl ? getStaticUrl(rawVideoUrl) : null;

	// 计算布局
	const shapes = useCanvasLayout({
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
				runState: project.status || (isGenerating ? "running" : "draft"),
				characters,
				shots,
				recoverySummary,
			});
		}, [
			project,
			recoverySummary,
			currentStage,
			isGenerating,
			characters,
			shots,
		]),
	});
	const shapesSignature = useMemo(() => JSON.stringify(shapes), [shapes]);
	shapesRef.current = shapes;
	shapesSignatureRef.current = shapesSignature;

	// 监听类型安全的画布事件
	useEffect(() => {
		const unsubscribers = [
			canvasEvents.on("preview-image", setPreviewImage),
			canvasEvents.on("preview-video", setPreviewVideo),
			canvasEvents.on("edit-character", setEditingCharacter),
			canvasEvents.on("approve-character", (data) => {
				approveCharacterMutation.mutate(data.id);
			}),
			canvasEvents.on("regenerate-character", (id) => {
				const character = characters.find((item) => item.id === id);
				if (character) {
					setEditingCharacter(character);
				}
			}),
			canvasEvents.on("delete-character", setDeletingCharacter),
			canvasEvents.on("edit-shot", setEditingShot),
			canvasEvents.on("approve-shot", (data) => {
				approveShotMutation.mutate(data.id);
			}),
			canvasEvents.on("regenerate-shot", (data) => {
				const shot = shots.find((item) => item.id === data.id);
				if (shot) {
					setEditingShot(shot);
				}
			}),
			canvasEvents.on("delete-shot", setDeletingShot),
		];

		return () => {
			unsubscribers.forEach((unsub) => {
				unsub();
			});
		};
	}, [approveCharacterMutation, approveShotMutation, characters, shots]);

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
				editor.updateShape({
					id: shape.id,
					type: shape.type,
					x: shape.x,
					y: shape.y,
					props: shape.props,
				});
			} else {
				editor.createShape(shape);
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

			{/* 角色编辑 Modal */}
			{editingCharacter && (
				<EditModal
					isOpen={true}
					onClose={() => setEditingCharacter(null)}
					onSave={async (data) => {
						await updateCharacterMutation.mutateAsync({
							id: editingCharacter.id,
							data: {
								description: data.description || null,
								image_url: data.image_url || null,
							},
						});
					}}
					title="编辑角色并重新生成"
					fields={[
						{ name: "description", label: "角色描述", type: "textarea" },
						{ name: "image_url", label: "主参考图像", type: "text" },
					]}
					initialData={getCharacterEditData(editingCharacter)}
					isLoading={updateCharacterMutation.isPending}
				/>
			)}

			{/* 分镜编辑 Modal */}
			{editingShot && (
				<EditModal
					isOpen={true}
					onClose={() => setEditingShot(null)}
					onSave={async (data) => {
						await updateShotMutation.mutateAsync({
							id: editingShot.id,
							data: {
								description: data.description || null,
								prompt: data.prompt || null,
								image_prompt: data.image_prompt || null,
								duration: parseNumberField(data.duration),
								camera: data.camera || null,
								motion_note: data.motion_note || null,
								character_ids: parseNumberList(data.character_ids),
							},
						});
					}}
					title="编辑分镜并重新生成"
					fields={[
						{ name: "description", label: "分镜描述", type: "textarea" },
						{ name: "prompt", label: "视频提示词", type: "textarea" },
						{ name: "image_prompt", label: "图片提示词", type: "textarea" },
						{ name: "duration", label: "时长(秒)", type: "text" },
						{ name: "camera", label: "镜头语言", type: "textarea" },
						{ name: "motion_note", label: "运动说明", type: "textarea" },
						{ name: "character_ids", label: "角色ID列表", type: "text" },
					]}
					initialData={getShotEditData(editingShot)}
					isLoading={updateShotMutation.isPending}
				/>
			)}

			{/* 删除确认 Modals */}
			{deletingCharacter && (
				<ConfirmModal
					isOpen={true}
					onClose={() => setDeletingCharacter(null)}
					onConfirm={async () => {
						await deleteCharacterMutation.mutateAsync(deletingCharacter.id);
					}}
					title="删除角色"
					message={`确定要删除角色「${deletingCharacter.name}」吗？此操作不可撤销。`}
					confirmText="删除"
					variant="danger"
					isLoading={deleteCharacterMutation.isPending}
				/>
			)}

			{deletingShot && (
				<ConfirmModal
					isOpen={true}
					onClose={() => setDeletingShot(null)}
					onConfirm={async () => {
						await deleteShotMutation.mutateAsync(deletingShot.id);
					}}
					title="删除分镜"
					message={`确定要删除「镜头 ${deletingShot.order}」吗？此操作不可撤销。`}
					confirmText="删除"
					variant="danger"
					isLoading={deleteShotMutation.isPending}
				/>
			)}
		</>
	);
}

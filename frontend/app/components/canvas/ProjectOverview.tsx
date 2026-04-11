import {
	ArrowPathIcon,
	BookOpenIcon,
	ClipboardDocumentListIcon,
	FilmIcon,
	PencilIcon,
	PhotoIcon,
	RectangleStackIcon,
	TrashIcon,
	UserIcon,
	UsersIcon,
	VideoCameraIcon,
} from "@heroicons/react/24/outline";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ConfirmModal } from "~/components/ui/ConfirmModal";
import { EditModal } from "~/components/ui/EditModal";
import {
	type ActionItem,
	HoverActionBar,
} from "~/components/ui/HoverActionBar";
import { LoadingOverlay } from "~/components/ui/LoadingOverlay";
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
import {
	ImagePreviewModal,
	PreviewableImage,
	VideoPreviewModal,
} from "./PreviewModals";

interface ProjectOverviewProps {
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

interface SectionProps {
	title: string;
	icon: React.ReactNode;
	children: React.ReactNode;
	isEmpty?: boolean;
	emptyText?: string;
}

function Section({ title, icon, children, isEmpty, emptyText }: SectionProps) {
	return (
		<div className="mb-6">
			<h3 className="text-lg font-heading font-bold mb-3 flex items-center gap-2">
				<span className="inline-flex items-center justify-center">{icon}</span>
				<span className="underline-sketch">{title}</span>
			</h3>
			{isEmpty ? (
				<div className="text-base-content/60 text-sm italic">
					{emptyText || "暂无内容"}
				</div>
			) : (
				children
			)}
		</div>
	);
}

export function ProjectOverview({ projectId }: ProjectOverviewProps) {
	const {
		characters,
		shots,
		projectVideoUrl,
		updateCharacter,
		updateShot,
		removeCharacter,
		removeShot,
	} = useEditorStore();
	const [previewImage, setPreviewImage] = useState<{
		src: string;
		alt: string;
	} | null>(null);
	const [previewVideo, setPreviewVideo] = useState<{
		src: string;
		title: string;
	} | null>(null);

	// 编辑状态
	const [editingCharacter, setEditingCharacter] = useState<Character | null>(
		null,
	);
	const [editingShot, setEditingShot] = useState<Shot | null>(null);
	const [deletingCharacter, setDeletingCharacter] = useState<Character | null>(
		null,
	);
	const [deletingShot, setDeletingShot] = useState<Shot | null>(null);

	// 加载状态
	const [regeneratingShotId, setRegeneratingShotId] = useState<number | null>(
		null,
	);
	const [regeneratingShotType, setRegeneratingShotType] = useState<
		"image" | "video" | null
	>(null);

	const { data: project } = useQuery({
		queryKey: ["project", projectId],
		queryFn: () => projectsApi.get(projectId),
	});

	// 监听分镜更新，清除加载状态
	useEffect(() => {
		if (regeneratingShotId) {
			const shot = shots.find((s) => s.id === regeneratingShotId);
			// 根据重生成类型检查是否完成
			if (regeneratingShotType === "image" && shot?.image_url) {
				setRegeneratingShotId(null);
				setRegeneratingShotType(null);
			} else if (regeneratingShotType === "video" && shot?.video_url) {
				setRegeneratingShotId(null);
				setRegeneratingShotType(null);
			}
		}
	}, [shots, regeneratingShotId, regeneratingShotType]);

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

	const regenerateShotMutation = useMutation({
		mutationFn: ({ id, type }: { id: number; type: "image" | "video" }) =>
			shotsApi.regenerate(id, type),
		onMutate: ({ id, type }) => {
			setRegeneratingShotId(id);
			setRegeneratingShotType(type);
		},
		onSuccess: () => {
			// 不立即清除加载状态，等待 WebSocket 事件更新
			// 加载状态会在分镜更新后自动清除
		},
		onError: () => {
			// 只在错误时清除加载状态
			setRegeneratingShotId(null);
			setRegeneratingShotType(null);
		},
	});

	const deleteCharacterMutation = useMutation({
		mutationFn: (id: number) => charactersApi.delete(id),
		onSuccess: (_, deletedId) => {
			removeCharacter(deletedId);
			setDeletingCharacter(null);
		},
	});

	const deleteShotMutation = useMutation({
		mutationFn: (id: number) => shotsApi.delete(id),
		onSuccess: (_, deletedId) => {
			removeShot(deletedId);
			setDeletingShot(null);
		},
	});

	// 使用 store 中的 videoUrl 或 project 中的 video_url，并转换为完整 URL
	const rawVideoUrl = projectVideoUrl || project?.video_url;
	// 只有当 URL 存在且不为空字符串时才显示最终视频
	const finalVideoUrl = rawVideoUrl ? getStaticUrl(rawVideoUrl) : null;

	const orderedShots = [...shots].sort((a, b) => a.order - b.order);

	const hasContent =
		project?.summary || characters.length > 0 || shots.length > 0;

	const handleImagePreview = (src: string, alt: string) => {
		setPreviewImage({ src, alt });
	};

	const handleVideoPreview = (src: string, title: string) => {
		setPreviewVideo({ src, title });
	};

	const closeImagePreview = () => {
		setPreviewImage(null);
	};

	const closeVideoPreview = () => {
		setPreviewVideo(null);
	};

	// 角色操作
	const getCharacterActions = (char: Character): ActionItem[] => [
		{
			icon: PencilIcon,
			label: "编辑",
			onClick: () => setEditingCharacter(char),
			variant: "ghost",
		},
		{
			icon: ArrowPathIcon,
			label: "重新生成",
			onClick: () => setEditingCharacter(char),
			variant: "secondary",
		},
		{
			icon: TrashIcon,
			label: "删除",
			onClick: () => setDeletingCharacter(char),
			variant: "error",
		},
	];

	// 分镜操作
	const getShotActions = (shot: Shot): ActionItem[] => [
		{
			icon: PencilIcon,
			label: "编辑",
			onClick: () => setEditingShot(shot),
			variant: "ghost",
		},
		{
			icon: PhotoIcon,
			label: "重新生成图片",
			onClick: () =>
				regenerateShotMutation.mutate({ id: shot.id, type: "image" }),
			variant: "secondary",
			loading:
				regeneratingShotId === shot.id && regeneratingShotType === "image",
		},
		{
			icon: VideoCameraIcon,
			label: "重新生成视频",
			onClick: () => setEditingShot(shot),
			variant: "accent",
			loading:
				regeneratingShotId === shot.id && regeneratingShotType === "video",
		},
		{
			icon: TrashIcon,
			label: "删除",
			onClick: () => setDeletingShot(shot),
			variant: "error",
		},
	];

	if (!hasContent) {
		return (
			<div className="h-full flex items-center justify-center">
				<div className="text-center text-base-content/70 max-w-sm">
					<div className="w-20 h-20 rounded-full bg-base-300/70 flex items-center justify-center mx-auto mb-4">
						<ClipboardDocumentListIcon className="w-6 h-6" aria-hidden="true" />
					</div>
					<p className="text-lg font-medium mb-2">项目概览</p>
					<p className="text-sm">开始生成后，故事内容将显示在这里</p>
				</div>
			</div>
		);
	}

	return (
		<>
			<div className="h-full overflow-auto p-6">
				{/* 故事简介 - 显示 AI 总结 */}
				{project?.summary && (
					<Section
						title="故事简介"
						icon={<BookOpenIcon className="w-5 h-5" aria-hidden="true" />}
					>
						<div className="card-doodle p-4 bg-base-100">
							<p className="text-base-content/90 whitespace-pre-wrap">
								{project.summary}
							</p>
						</div>
					</Section>
				)}

				{/* 角色列表 */}
				<Section
					title={`角色设计 (${characters.length})`}
					icon={<UsersIcon className="w-5 h-5" aria-hidden="true" />}
					isEmpty={characters.length === 0}
					emptyText="角色正在生成中..."
				>
					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
						{characters.map((char) => {
							const charImageUrl = getStaticUrl(char.image_url);
							return (
								<HoverActionBar
									key={char.id}
									actions={getCharacterActions(char)}
								>
									<div className="card-doodle p-3 bg-base-100 relative">
										{charImageUrl ? (
											<PreviewableImage
												src={charImageUrl}
												alt={char.name}
												className="w-full max-h-64 object-contain rounded-lg mb-2"
												onPreview={handleImagePreview}
											/>
										) : (
											<div className="w-full h-32 bg-base-200 rounded-lg flex items-center justify-center mb-2">
												<UserIcon className="w-6 h-6" aria-hidden="true" />
											</div>
										)}
										<h4 className="font-bold text-sm">{char.name}</h4>
										{char.description && (
											<p className="text-xs text-base-content/70 mt-1">
												{char.description}
											</p>
										)}
									</div>
								</HoverActionBar>
							);
						})}
					</div>
				</Section>

				{/* 分镜脚本 */}
				<Section
					title={`分镜脚本 (${shots.length} 镜头)`}
					icon={<FilmIcon className="w-5 h-5" aria-hidden="true" />}
					isEmpty={shots.length === 0}
					emptyText="分镜正在生成中..."
				>
					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
						{orderedShots.map((shot) => {
							const shotImageUrl = getStaticUrl(shot.image_url);
							const shotVideoUrl = getStaticUrl(shot.video_url);
							return (
								<HoverActionBar key={shot.id} actions={getShotActions(shot)}>
									<div className="bg-base-200 rounded-lg p-2 hover:bg-base-300 transition-colors relative">
										{regeneratingShotId === shot.id && (
											<LoadingOverlay
												text={
													regeneratingShotType === "image"
														? "生成图片..."
														: "生成视频..."
												}
											/>
										)}
										{shotImageUrl && (
											<PreviewableImage
												src={shotImageUrl}
												alt={`镜头 ${shot.order}`}
												className="w-full h-24 object-cover rounded"
												onPreview={handleImagePreview}
											/>
										)}
										{shotVideoUrl && (
											<button
												type="button"
												className="relative mt-2 cursor-pointer w-full text-left"
												onClick={() =>
													handleVideoPreview(shotVideoUrl, `镜头 ${shot.order}`)
												}
											>
												<video
													src={shotVideoUrl}
													className="w-full h-24 object-cover rounded"
													muted
													loop
													onMouseEnter={(e) => e.currentTarget.play()}
													onMouseLeave={(e) => {
														e.currentTarget.pause();
														e.currentTarget.currentTime = 0;
													}}
												>
													<track kind="captions" label="中文字幕" src="" />
												</video>
												<span className="absolute top-1 right-1 badge badge-success badge-xs text-success-content">
													视频
												</span>
												<div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30 rounded">
													<span className="text-primary-content text-2xl">
														▶
													</span>
												</div>
											</button>
										)}
										{!shotImageUrl && !shotVideoUrl && (
											<div className="w-full h-24 bg-base-300 rounded flex items-center justify-center">
												<RectangleStackIcon
													className="w-6 h-6"
													aria-hidden="true"
												/>
											</div>
										)}
										<div className="mt-1">
											<span className="text-xs font-bold">#{shot.order}</span>
											<p className="text-xs text-base-content/70">
												{shot.description}
											</p>
										</div>
									</div>
								</HoverActionBar>
							);
						})}
					</div>
				</Section>

				{/* 最终视频 */}
				{finalVideoUrl && (
					<Section
						title="最终视频"
						icon={<VideoCameraIcon className="w-5 h-5" aria-hidden="true" />}
					>
						<div className="card-doodle bg-base-100 overflow-hidden max-w-2xl">
							{/* 视频容器 - 内嵌下载按钮 */}
							<div className="relative aspect-video bg-black">
								<video
									className="w-full h-full object-contain"
									src={finalVideoUrl}
									controls
								>
									<track kind="captions" label="中文字幕" src="" />
								</video>
								{/* 底部下载栏 */}
								<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 py-3 pt-10 pointer-events-none">
									<div className="flex items-center justify-between pointer-events-auto">
										<div className="min-w-0 flex-1 mr-4">
											<p className="font-bold text-sm truncate text-white">
												{project?.title || "我的视频"}
											</p>
										</div>
										<button
											type="button"
											onClick={async (e) => {
												e.preventDefault();
												try {
													const response = await fetch(finalVideoUrl);
													const blob = await response.blob();
													const url = window.URL.createObjectURL(blob);
													const a = document.createElement("a");
													a.href = url;
													a.download = `${project?.title || "video"}.mp4`;
													document.body.appendChild(a);
													a.click();
													window.URL.revokeObjectURL(url);
													document.body.removeChild(a);
												} catch (err) {
													console.error("下载失败:", err);
													// 降级为直接打开链接
													window.open(finalVideoUrl, "_blank");
												}
											}}
											className="btn btn-primary btn-sm gap-2 border-2 border-black shadow-brutal-sm hover:shadow-brutal hover:-translate-y-0.5 active:translate-y-0 transition-all font-bold shrink-0"
										>
											<svg
												aria-hidden="true"
												xmlns="http://www.w3.org/2000/svg"
												viewBox="0 0 20 20"
												fill="currentColor"
												className="w-4 h-4"
											>
												<path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
												<path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
											</svg>
											下载
										</button>
									</div>
								</div>
							</div>
						</div>
					</Section>
				)}
			</div>

			{/* 图片预览 Modal */}
			{previewImage && (
				<ImagePreviewModal
					src={previewImage.src}
					alt={previewImage.alt}
					onClose={closeImagePreview}
				/>
			)}

			{/* 视频预览 Modal */}
			{previewVideo && (
				<VideoPreviewModal
					src={previewVideo.src}
					title={previewVideo.title}
					onClose={closeVideoPreview}
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

			{/* 删除角色确认 Modal */}
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

			{/* 删除分镜确认 Modal */}
			{deletingShot && (
				<ConfirmModal
					isOpen={true}
					onClose={() => setDeletingShot(null)}
					onConfirm={async () => {
						await deleteShotMutation.mutateAsync(deletingShot.id);
					}}
					title="删除分镜"
					message={`确定要删除「镜头 ${deletingShot.order}」吗？此操作不可撤销，且会清除项目最终视频。`}
					confirmText="删除"
					variant="danger"
					isLoading={deleteShotMutation.isPending}
				/>
			)}
		</>
	);
}

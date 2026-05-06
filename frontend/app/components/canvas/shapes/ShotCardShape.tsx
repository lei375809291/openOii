import { useState } from "react";
import {
	HTMLContainer,
	Rectangle2d,
	ShapeUtil,
	T,
	type Geometry2d,
	type RecordProps,
} from "tldraw";
import { SvgIcon } from "~/components/ui/SvgIcon";
import { getStaticUrl } from "~/services/api";
import { getShapeSize, useDomSize } from "~/hooks/useDomSize";
import { canvasEvents } from "../canvasEvents";
import type { ShapeActionName, ShapeActionPayload } from "../canvasEvents";
import type { ShotCardShape, ReviewedShot } from "./types";

function stopCanvasDrag(e: React.PointerEvent<HTMLElement>) {
	e.stopPropagation();
}

function emitEntityAction({
	action,
	entityType,
	entityId,
	feedbackType,
	shotPatch,
	feedbackContent,
}: {
	action: ShapeActionName;
	entityType: "character" | "shot";
	entityId: number;
	feedbackType: "render";
	shotPatch?: ShapeActionPayload["shotPatch"];
	feedbackContent?: string;
}) {
	canvasEvents.emit("shape-action", {
		shapeId: "",
		action,
		entityType,
		entityId,
		feedbackType,
		shotPatch,
		feedbackContent,
	});
}

function ShotCardContent({ shot }: { shot: ReviewedShot }) {
	const isApproved = shot.approval_state === "approved";
	const imageUrl = getStaticUrl(shot.image_url);
	const videoUrl = getStaticUrl(shot.video_url);
	const [isEditing, setIsEditing] = useState(false);
	const [editDialogue, setEditDialogue] = useState(shot.dialogue || "");
	const [editAction, setEditAction] = useState(shot.action || "");

	const handleAction = (action: ShapeActionName) => {
		if (action === "edit") {
			setIsEditing(true);
			return;
		}
		emitEntityAction({
			action,
			entityType: "shot",
			entityId: shot.id,
			feedbackType: "render",
		});
	};

	const handleSaveEdit = () => {
		setIsEditing(false);
		if (
			editDialogue !== (shot.dialogue || "") ||
			editAction !== (shot.action || "")
		) {
			emitEntityAction({
				action: "edit",
				entityType: "shot",
				entityId: shot.id,
				feedbackType: "render",
				shotPatch: {
					action: editAction || null,
					dialogue: editDialogue || null,
				},
			});
		}
	};

	return (
		<article
			className={`group overflow-hidden card-comic ${isApproved ? "ring-2 ring-success/50" : ""}`}
		>
			<div className="relative aspect-video bg-base-300">
				{imageUrl ? (
					<img
						src={imageUrl}
						alt={`Shot ${shot.order}`}
						className="h-full w-full object-cover"
					/>
				) : (
					<div className="flex h-full items-center justify-center text-xs text-base-content/40">
						等待分镜图
					</div>
				)}
				<span className="badge badge-xs absolute right-2 top-2 bg-base-100/80">
					{shot.duration ? `${shot.duration}s` : "未定时长"}
				</span>
				{shot.expression && (
					<span className="badge badge-xs badge-primary absolute bottom-2 left-2">
						{shot.expression}
					</span>
				)}
				{isApproved && (
					<span className="absolute left-2 top-2 badge badge-xs badge-success gap-1">
						<SvgIcon name="check" size={10} />
						已批准
					</span>
				)}
				<div className="absolute inset-0 flex items-center justify-center gap-1 bg-base-content/0 opacity-0 transition group-hover:bg-base-content/25 group-hover:opacity-100">
					<button
						type="button"
						className="btn btn-sm btn-circle btn-ghost text-base-100 hover:bg-base-100/30 touch-target"
						title="重新生成"
						onPointerDown={stopCanvasDrag}
						onClick={() => handleAction("regenerate")}
					>
						<SvgIcon name="refresh-cw" size={14} />
					</button>
					<button
						type="button"
						className="btn btn-sm btn-circle btn-ghost text-base-100 hover:bg-base-100/30 touch-target"
						title="编辑"
						onPointerDown={stopCanvasDrag}
						onClick={() => handleAction("edit")}
					>
						<SvgIcon name="pencil" size={14} />
					</button>
					{videoUrl && (
						<button
							type="button"
							className="btn btn-sm btn-circle btn-ghost text-base-100 hover:bg-base-100/30 touch-target"
							title="预览片段"
							onPointerDown={stopCanvasDrag}
							onClick={() =>
								canvasEvents.emit("preview-video", {
									src: videoUrl,
									title: `镜头 ${shot.order}`,
								})
							}
						>
							<SvgIcon name="play" size={14} />
						</button>
					)}
					{!isApproved && (
						<button
							type="button"
							className="btn btn-sm btn-circle btn-ghost text-success hover:bg-success/30 touch-target"
							title="批准"
							onPointerDown={stopCanvasDrag}
							onClick={() => handleAction("approve")}
						>
							<SvgIcon name="check" size={14} />
						</button>
					)}
				</div>
			</div>
			<div className="space-y-1.5 p-3">
				<div className="flex items-center gap-2">
					<span
						className={`h-2 w-2 shrink-0 rounded-full ${isApproved ? "bg-success" : "bg-warning"}`}
					/>
					<h3 className="m-0 text-sm font-heading font-bold">
						镜头 {shot.order}
					</h3>
					{shot.camera && (
						<span className="badge badge-ghost badge-xs ml-auto">
							{shot.camera}
						</span>
					)}
				</div>
				{shot.scene && (
					<p className="m-0 text-xs font-semibold text-base-content/75">
						{shot.scene}
					</p>
				)}
				{shot.description && (
					<p className="m-0 text-xs leading-relaxed text-base-content/60">
						{shot.description}
					</p>
				)}
				{isEditing ? (
					<div className="space-y-1.5 pt-1">
						<input
							type="text"
							className="input-doodle w-full text-xs p-2"
							placeholder="动作"
							value={editAction}
							onPointerDown={stopCanvasDrag}
							onChange={(e) => setEditAction(e.currentTarget.value)}
						/>
						<input
							type="text"
							className="input-doodle w-full text-xs p-2"
							placeholder="对话"
							value={editDialogue}
							onPointerDown={stopCanvasDrag}
							onChange={(e) => setEditDialogue(e.currentTarget.value)}
							onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
						/>
						<div className="flex gap-1">
							<button
								type="button"
								className="btn btn-xs btn-doodle btn-primary"
								onPointerDown={stopCanvasDrag}
								onClick={handleSaveEdit}
							>
								保存
							</button>
							<button
								type="button"
								className="btn btn-xs btn-ghost"
								onPointerDown={stopCanvasDrag}
								onClick={() => setIsEditing(false)}
							>
								取消
							</button>
						</div>
					</div>
				) : (
					<>
						{shot.action && (
							<p className="m-0 flex items-center gap-1 text-xs text-accent/75">
								<SvgIcon name="chevron-right" size={10} />
								{shot.action}
							</p>
						)}
						{shot.dialogue && (
							<p className="m-0 text-xs italic text-primary/80">
								"{shot.dialogue}"
							</p>
						)}
					</>
				)}
				<div className="flex flex-wrap gap-1 pt-0.5">
					{shot.lighting && (
						<span className="badge badge-ghost badge-xs inline-flex items-center gap-1 opacity-70">
							<SvgIcon name="lightbulb" size={10} />
							{shot.lighting}
						</span>
					)}
					{shot.sfx && (
						<span className="badge badge-ghost badge-xs inline-flex items-center gap-1 opacity-70">
							<SvgIcon name="volume-2" size={10} />
							{shot.sfx}
						</span>
					)}
				</div>
			</div>
		</article>
	);
}

export class ShotCardShapeUtil extends ShapeUtil<ShotCardShape> {
	static override type = "shot-card" as const;

	static override props: RecordProps<ShotCardShape> = {
		w: T.number,
		h: T.number,
		shot: T.any,
	};

	getDefaultProps(): ShotCardShape["props"] {
		return {
			w: 440,
			h: 380,
			shot: {
				id: 0,
				project_id: 0,
				order: 0,
				description: "",
				prompt: "",
				image_prompt: "",
				image_url: null,
				video_url: null,
				seed: null,
				duration: null,
				camera: null,
				motion_note: null,
				scene: null,
				action: null,
				expression: null,
				lighting: null,
				dialogue: null,
				sfx: null,
				character_ids: [],
				approval_state: "draft",
				approval_version: 0,
				approved_at: null,
				approved_description: null,
				approved_prompt: null,
				approved_image_prompt: null,
				approved_duration: null,
				approved_camera: null,
				approved_motion_note: null,
				approved_scene: null,
				approved_action: null,
				approved_expression: null,
				approved_lighting: null,
				approved_dialogue: null,
				approved_sfx: null,
				approved_character_ids: [],
			},
		};
	}

	override canEdit() {
		return true;
	}
	override canResize() {
		return false;
	}
	override canCull() {
		return false;
	}

	getGeometry(shape: ShotCardShape): Geometry2d {
		const size = this.editor ? getShapeSize(this.editor, shape.id) : undefined;
		return new Rectangle2d({
			width: shape.props.w,
			height: size?.height ?? shape.props.h,
			isFilled: true,
		});
	}

	component(shape: ShotCardShape) {
		const { w, shot } = shape.props;
		const ref = useDomSize(shape, this.editor ?? null);
		const typedShot = shot as ReviewedShot;

		return (
			<HTMLContainer
				style={{ width: w, pointerEvents: "all", overflow: "visible" }}
			>
				<div ref={ref} style={{ width: w }}>
					<ShotCardContent shot={typedShot} />
				</div>
			</HTMLContainer>
		);
	}

	indicator(shape: ShotCardShape) {
		const size = this.editor ? getShapeSize(this.editor, shape.id) : undefined;
		return (
			<rect
				width={shape.props.w}
				height={size?.height ?? shape.props.h}
				rx={12}
			/>
		);
	}
}

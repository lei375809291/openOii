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
import type { ShapeActionName } from "../canvasEvents";
import type { CharacterCardShape, ReviewedCharacter } from "./types";

function stopCanvasDrag(e: React.PointerEvent<HTMLElement>) {
	e.stopPropagation();
}

function emitEntityAction({
	action,
	entityType,
	entityId,
	feedbackType,
	feedbackContent,
}: {
	action: ShapeActionName;
	entityType: "character" | "shot";
	entityId: number;
	feedbackType: "render";
	feedbackContent?: string;
}) {
	canvasEvents.emit("shape-action", {
		shapeId: "",
		action,
		entityType,
		entityId,
		feedbackType,
		feedbackContent,
	});
}

function CharacterCardContent({ character }: { character: ReviewedCharacter }) {
	const isApproved = character.approval_state === "approved";
	const currentImage = getStaticUrl(character.image_url);
	const approvedImage = getStaticUrl(character.approved_image_url);
	const displayImage =
		isApproved && approvedImage ? approvedImage : currentImage;
	const [isEditing, setIsEditing] = useState(false);
	const [feedbackText, setFeedbackText] = useState(character.description || "");

	const handleAction = (action: ShapeActionName) => {
		if (action === "edit") {
			setIsEditing(true);
			return;
		}
		emitEntityAction({
			action,
			entityType: "character",
			entityId: character.id,
			feedbackType: "render",
		});
	};

	const handleSaveEdit = () => {
		setIsEditing(false);
		const content = feedbackText.trim();
		if (content) {
			emitEntityAction({
				action: "edit",
				entityType: "character",
				entityId: character.id,
				feedbackType: "render",
				feedbackContent: content,
			});
		}
	};

	return (
		<article className="group overflow-hidden card-doodle">
			<div className="relative aspect-[4/3] bg-base-300">
				{displayImage ? (
					<img
						src={displayImage}
						alt={character.name}
						className="h-full w-full object-cover"
					/>
				) : (
					<div className="flex h-full items-center justify-center text-xs text-base-content/40">
						等待角色图
					</div>
				)}
				<div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-base-content/0 opacity-0 transition group-hover:bg-base-content/25 group-hover:opacity-100">
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
					<button
						type="button"
						className="btn btn-sm btn-circle btn-ghost text-primary hover:bg-primary/30 touch-target"
						title="添加到资产库"
						onPointerDown={stopCanvasDrag}
						onClick={() => handleAction("add-to-assets")}
					>
						<SvgIcon name="star" size={14} />
					</button>
				</div>
				{isApproved && (
					<span className="absolute right-2 top-2 badge badge-xs badge-success gap-1">
						<SvgIcon name="check" size={10} />
						已批准
					</span>
				)}
			</div>
			<div className="space-y-1.5 p-3">
				<div className="flex items-center gap-2">
					<span
						className={`h-2 w-2 rounded-full ${isApproved ? "bg-success" : "bg-warning"}`}
					/>
					<h3 className="m-0 text-sm font-heading font-bold">
						{character.name}
					</h3>
					<span className="badge badge-ghost badge-xs ml-auto">
						v{character.approval_version}
					</span>
				</div>
				{isEditing ? (
					<div className="space-y-1.5 pt-1">
						<textarea
							className="input-doodle w-full text-xs p-2 resize-none"
							rows={2}
							placeholder="修改意见"
							value={feedbackText}
							onPointerDown={stopCanvasDrag}
							onChange={(e) => setFeedbackText(e.currentTarget.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();
									handleSaveEdit();
								}
							}}
						/>
						<div className="flex gap-1">
							<button
								type="button"
								className="btn btn-xs btn-doodle btn-primary"
								onPointerDown={stopCanvasDrag}
								onClick={handleSaveEdit}
							>
								提交
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
					character.description && (
						<p className="m-0 text-xs leading-relaxed text-base-content/60">
							{character.description}
						</p>
					)
				)}
			</div>
		</article>
	);
}

export class CharacterCardShapeUtil extends ShapeUtil<CharacterCardShape> {
	static override type = "character-card" as const;

	static override props: RecordProps<CharacterCardShape> = {
		w: T.number,
		h: T.number,
		character: T.any,
	};

	getDefaultProps(): CharacterCardShape["props"] {
		return {
			w: 440,
			h: 320,
			character: {
				id: 0,
				project_id: 0,
				name: "",
				description: "",
				image_url: null,
				approval_state: "draft",
				approval_version: 0,
				approved_at: null,
				approved_name: null,
				approved_description: null,
				approved_image_url: null,
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

	getGeometry(shape: CharacterCardShape): Geometry2d {
		const size = this.editor ? getShapeSize(this.editor, shape.id) : undefined;
		return new Rectangle2d({
			width: shape.props.w,
			height: size?.height ?? shape.props.h,
			isFilled: true,
		});
	}

	component(shape: CharacterCardShape) {
		const { w, character } = shape.props;
		const ref = useDomSize(shape, this.editor ?? null);
		const typedCharacter = character as ReviewedCharacter;

		return (
			<HTMLContainer
				style={{ width: w, pointerEvents: "all", overflow: "visible" }}
			>
				<div ref={ref} style={{ width: w }}>
					<CharacterCardContent character={typedCharacter} />
				</div>
			</HTMLContainer>
		);
	}

	indicator(shape: CharacterCardShape) {
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

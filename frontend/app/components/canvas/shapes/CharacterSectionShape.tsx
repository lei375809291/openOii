import {
	HTMLContainer,
	Rectangle2d,
	ShapeUtil,
	T,
	type Geometry2d,
	type RecordProps,
} from "tldraw";
import type { CharacterSectionShape, ReviewedCharacter } from "./types";
import { SectionShell } from "./SectionShell";
import { getStaticUrl } from "~/services/api";
import {
	getWorkspaceSectionPlaceholderText,
	getWorkspaceSectionStatusLabel,
} from "~/utils/workspaceStatus";
import { canvasEvents } from "../canvasEvents";
import type { ShapeActionName } from "../canvasEvents";
import { SvgIcon } from "~/components/ui/SvgIcon";
import { useDomSize, getShapeSize } from "~/hooks/useDomSize";

function CharacterCard({ char }: { char: ReviewedCharacter }) {
	const isApproved = char.approval_state === "approved";
	const currentImage = getStaticUrl(char.image_url);
	const approvedImage = getStaticUrl(char.approved_image_url);
	const displayImage =
		isApproved && approvedImage ? approvedImage : currentImage;

	const handleAction = (action: ShapeActionName) => {
		if (
			action === "regenerate" &&
			!window.confirm(`重新生成角色 ${char.name}？`)
		)
			return;
		if (action === "approve" && !window.confirm(`批准角色 ${char.name}？`))
			return;
		canvasEvents.emit("shape-action", {
			shapeId: "",
			action,
			entityType: "character",
			entityId: char.id,
			feedbackType: "render",
		});
	};

	return (
		<div
			className={`card card-compact bg-base-200 border-2 border-base-content/15 group relative ${
				isApproved ? "ring-1 ring-success/20" : ""
			}`}
		>
			{displayImage && (
				<figure className="relative">
					<img
						src={displayImage}
						alt={char.name}
						className="w-full object-cover"
					/>
					<div className="absolute inset-0 bg-base-content/0 group-hover:bg-base-content/20 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
						<button
							type="button"
							className="btn btn-xs btn-circle btn-ghost text-base-100 hover:bg-base-100/30"
							title="重新生成"
							onClick={() => handleAction("regenerate")}
						>
							<SvgIcon name="refresh-cw" size={12} />
						</button>
						<button
							type="button"
							className="btn btn-xs btn-circle btn-ghost text-base-100 hover:bg-base-100/30"
							title="编辑"
							onClick={() => handleAction("edit")}
						>
							<SvgIcon name="pencil" size={12} />
						</button>
						{!isApproved && (
							<button
								type="button"
								className="btn btn-xs btn-circle btn-ghost text-success hover:bg-success/30"
								title="批准"
								onClick={() => handleAction("approve")}
							>
								<SvgIcon name="check" size={12} />
							</button>
						)}
						<button
							type="button"
							className="btn btn-xs btn-circle btn-ghost text-primary hover:bg-primary/30"
							title="添加到资产库"
							onClick={() => handleAction("add-to-assets")}
						>
							<SvgIcon name="star" size={12} />
						</button>
					</div>
				</figure>
			)}
			<div className="card-body p-2">
				<div className="flex items-center gap-1.5">
					<span
						className={`w-2 h-2 rounded-full ${isApproved ? "bg-success" : "bg-warning"}`}
					/>
					<span className="font-semibold text-xs">{char.name}</span>
					<span className="badge badge-ghost badge-xs ml-auto">
						v{char.approval_version}
					</span>
				</div>
				{char.description && (
					<p className="text-xs text-base-content/50">{char.description}</p>
				)}
			</div>
		</div>
	);
}

export class CharacterSectionShapeUtil extends ShapeUtil<CharacterSectionShape> {
	static override type = "character-section" as const;

	static override props: RecordProps<CharacterSectionShape> = {
		w: T.number,
		h: T.number,
		characters: T.any,
		sectionState: T.string,
		placeholder: T.boolean,
		statusLabel: T.string,
		placeholderText: T.string,
		sectionTitle: T.string,
	};

	getDefaultProps(): CharacterSectionShape["props"] {
		return {
			w: 800,
			h: 200,
			characters: [],
			sectionState: "blocked",
			placeholder: true,
			statusLabel: getWorkspaceSectionStatusLabel("blocked"),
			placeholderText: getWorkspaceSectionPlaceholderText("render"),
			sectionTitle: "角色",
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

	getGeometry(shape: CharacterSectionShape): Geometry2d {
		const size = this.editor ? getShapeSize(this.editor, shape.id) : undefined;
		return new Rectangle2d({
			width: shape.props.w,
			height: size?.height ?? shape.props.h,
			isFilled: true,
		});
	}

	component(shape: CharacterSectionShape) {
		const { characters, placeholder, placeholderText, statusLabel, w } =
			shape.props;
		const ref = useDomSize(shape, this.editor ?? null);

		return (
			<HTMLContainer
				style={{ width: w, pointerEvents: "all", overflow: "visible" }}
			>
				<div ref={ref} style={{ width: w }}>
					<SectionShell
						sectionKey="render"
						sectionTitle="角色"
						statusLabel={statusLabel}
						placeholder={placeholder}
						placeholderText={placeholderText}
					>
						<div className="grid grid-cols-2 gap-2">
							{(characters as ReviewedCharacter[]).map((char) => (
								<CharacterCard key={char.id} char={char} />
							))}
						</div>
					</SectionShell>
				</div>
			</HTMLContainer>
		);
	}

	indicator() {
		return null;
	}
}

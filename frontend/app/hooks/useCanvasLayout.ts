import { useMemo } from "react";
import { createShapeId, type TLShapePartial } from "tldraw";
import { SHAPE_TYPES } from "~/components/canvas/shapes";
import type { StoryboardBoardShape } from "~/components/canvas/shapes";
import type { BlockingClip, Character, Shot, WorkflowStage } from "~/types";

type SectionKey = "plan" | "render" | "compose";
type SectionState = "draft" | "generating" | "blocked" | "complete";

interface LayoutConfig {
	startX: number;
	startY: number;
	boardWidth: number;
	boardHeight: number;
}

const DEFAULT_CONFIG: LayoutConfig = {
	startX: 100,
	startY: 100,
	boardWidth: 920,
	boardHeight: 600,
};

const SECTION_ORDER: SectionKey[] = ["plan", "render", "compose"];

const SECTION_PLACEHOLDER_TEXT: Record<SectionKey, string> = {
	plan: "等待规划生成...",
	render: "等待角色和分镜渲染生成...",
	compose: "等待视频合成...",
};

const SECTION_STATUS_LABELS: Record<SectionState, string> = {
	draft: "待生成",
	generating: "生成中",
	blocked: "待生成",
	complete: "已完成",
};

interface UseCanvasLayoutProps {
	projectId: number;
	story: string | null;
	summary: string | null;
	characters: Character[];
	shots: Shot[];
	videoUrl: string | null;
	videoTitle: string;
	visibleSections: readonly SectionKey[];
	isGenerating: boolean;
	awaitingConfirm: boolean;
	currentRunId: number | null;
	currentStage: WorkflowStage;
	blockingClips?: BlockingClip[] | null;
	config?: Partial<LayoutConfig>;
}

function deriveSectionState(
	key: SectionKey,
	data: {
		story: string | null;
		summary: string | null;
		characters: Character[];
		shots: Shot[];
		videoUrl: string | null;
		isGenerating: boolean;
		awaitingConfirm: boolean;
		currentRunId: number | null;
		blockingClips?: BlockingClip[] | null;
	},
): SectionState {
	const isActive =
		data.isGenerating || data.awaitingConfirm || Boolean(data.currentRunId);
	const hasContent = Boolean(data.story) || Boolean(data.summary);
	const hasCharImages = data.characters.some((c) => Boolean(c.image_url));
	const hasStoryboardImg = data.shots.some((s) => Boolean(s.image_url));

	switch (key) {
		case "plan":
			return isActive && !hasContent
				? "generating"
				: hasContent
					? "complete"
					: "draft";
		case "render":
			if (data.characters.length === 0 && data.shots.length === 0)
				return "blocked";
			if (hasCharImages && hasStoryboardImg) return "complete";
			if (isActive) return "generating";
			return "draft";
		case "compose":
			if (data.blockingClips?.length) return "blocked";
			return data.videoUrl
				? "complete"
				: isActive
					? "generating"
					: data.shots.length === 0
						? "blocked"
						: "draft";
	}
}

function isPlaceholder(
	key: SectionKey,
	data: {
		story: string | null;
		summary: string | null;
		characters: Character[];
		shots: Shot[];
		videoUrl: string | null;
	},
): boolean {
	switch (key) {
		case "plan":
			return !data.story && !data.summary;
		case "render":
			return data.characters.length === 0 && data.shots.length === 0;
		case "compose":
			return !data.videoUrl;
	}
}

export type { SectionKey };
export { SECTION_ORDER };

export interface CanvasLayoutResult {
	shapes: TLShapePartial[];
}

function hasGeneratedCanvasContent(data: {
	summary: string | null;
	characters: Character[];
	shots: Shot[];
	videoUrl: string | null;
	blockingClips?: BlockingClip[] | null;
}): boolean {
	return (
		Boolean(data.summary) ||
		data.characters.length > 0 ||
		data.shots.length > 0 ||
		Boolean(data.videoUrl) ||
		Boolean(data.blockingClips?.length)
	);
}

export function useCanvasLayout({
	projectId,
	story,
	summary,
	characters,
	shots,
	videoUrl,
	videoTitle,
	visibleSections,
	isGenerating,
	awaitingConfirm,
	currentRunId,
	blockingClips,
	config: partialConfig,
}: UseCanvasLayoutProps): CanvasLayoutResult {
	const config = useMemo(
		() => ({ ...DEFAULT_CONFIG, ...partialConfig }),
		[partialConfig],
	);

	const sectionData = useMemo(
		() => ({
			story,
			summary,
			characters,
			shots,
			videoUrl,
			isGenerating,
			awaitingConfirm,
			currentRunId,
			blockingClips,
		}),
		[
			story,
			summary,
			characters,
			shots,
			videoUrl,
			isGenerating,
			awaitingConfirm,
			currentRunId,
			blockingClips,
		],
	);

	return useMemo(() => {
		if (!hasGeneratedCanvasContent(sectionData) || visibleSections.length === 0) {
			return { shapes: [] };
		}

		const visibleSet = new Set(visibleSections);
		const visibleStoryboardSections = SECTION_ORDER.filter((section) =>
			visibleSet.has(section),
		);
		if (visibleStoryboardSections.length === 0) {
			return { shapes: [] };
		}

		const sectionStates: Partial<Record<SectionKey, SectionState>> = {};
		const placeholders: Partial<Record<SectionKey, boolean>> = {};
		const statusLabels: Partial<Record<SectionKey, string>> = {};
		const placeholderTexts: Partial<Record<SectionKey, string>> = {};

		for (const section of SECTION_ORDER) {
			const state = deriveSectionState(section, sectionData);
			sectionStates[section] = state;
			placeholders[section] = isPlaceholder(section, sectionData);
			statusLabels[section] = SECTION_STATUS_LABELS[state];
			placeholderTexts[section] = SECTION_PLACEHOLDER_TEXT[section];
		}

		if (blockingClips?.length) {
			placeholderTexts.compose = blockingClips
				.map((clip) => `镜头 ${clip.order}: ${clip.reason}`)
				.join("；");
		}

		const { startX, startY, boardWidth, boardHeight } = config;

		return {
			shapes: [
				{
					id: createShapeId("storyboard-board"),
					type: SHAPE_TYPES.STORYBOARD_BOARD,
					x: startX,
					y: startY,
					props: {
						w: boardWidth,
						h: boardHeight,
						projectId,
						story: story || "",
						summary: summary || "",
						characters,
						shots,
						videoUrl: videoUrl || "",
						videoTitle,
						visibleSections: visibleStoryboardSections,
						sectionStates,
						placeholders,
						statusLabels,
						placeholderTexts,
						downloadUrl: `/api/v1/projects/${projectId}/final-video`,
					},
				} satisfies TLShapePartial<StoryboardBoardShape>,
			],
		};
	}, [
		visibleSections,
		sectionData,
		blockingClips,
		config,
		projectId,
		story,
		summary,
		characters,
		shots,
		videoUrl,
		videoTitle,
	]);
}

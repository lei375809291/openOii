import type { TLBaseShape } from "tldraw";
import type { Character, ReviewState, Shot } from "~/types";

export interface CanvasSectionStatusProps {
	sectionState: string;
	placeholder: boolean;
	statusLabel: string;
	placeholderText: string;
}

export interface CharacterReviewSnapshot {
	approval_state: ReviewState;
	approval_version: number;
	approved_at: string | null;
	approved_name: string | null;
	approved_description: string | null;
	approved_image_url: string | null;
}

export type ReviewedCharacter = Character & CharacterReviewSnapshot;

export interface ShotReviewSnapshot {
	approval_state: ReviewState;
	approval_version: number;
	approved_at: string | null;
	approved_description: string | null;
	approved_prompt: string | null;
	approved_image_prompt: string | null;
	approved_duration: number | null;
	approved_camera: string | null;
	approved_motion_note: string | null;
	approved_scene: string | null;
	approved_action: string | null;
	approved_expression: string | null;
	approved_lighting: string | null;
	approved_dialogue: string | null;
	approved_sfx: string | null;
	approved_character_ids: number[];
}

export type ReviewedShot = Shot & ShotReviewSnapshot;

// Shape 类型常量
export const SHAPE_TYPES = {
	STORYBOARD_BOARD: "storyboard-board",
	SCRIPT_SECTION: "script-section",
	CHARACTER_SECTION: "character-section",
	STORYBOARD_SECTION: "storyboard-section",
	VIDEO_SECTION: "video-section",
	// 新增：独立可拖动卡片
	PLAN_SECTION: "plan-section",
	CHARACTER_CARD: "character-card",
	SHOT_CARD: "shot-card",
	COMPOSE_SECTION: "compose-section",
} as const;

export type StoryboardBoardSectionKey = "plan" | "render" | "compose";

export type StoryboardBoardShape = TLBaseShape<
	typeof SHAPE_TYPES.STORYBOARD_BOARD,
	{
		w: number;
		h: number;
		projectId: number;
		story: string;
		summary: string;
		characters: ReviewedCharacter[];
		shots: ReviewedShot[];
		videoUrl: string;
		videoTitle: string;
		visibleSections: StoryboardBoardSectionKey[];
		sectionStates: Partial<Record<StoryboardBoardSectionKey, string>>;
		placeholders: Partial<Record<StoryboardBoardSectionKey, boolean>>;
		statusLabels: Partial<Record<StoryboardBoardSectionKey, string>>;
		placeholderTexts: Partial<Record<StoryboardBoardSectionKey, string>>;
		downloadUrl: string;
	}
>;

// 剧本区域 Shape (包含故事原文、摘要、角色列表文字版、分镜描述)
export type ScriptSectionShape = TLBaseShape<
	typeof SHAPE_TYPES.SCRIPT_SECTION,
	{
		w: number;
		h: number;
		story: string;
		summary: string;
		characters: ReviewedCharacter[];
		shots: ReviewedShot[];
	} & CanvasSectionStatusProps
>;

// 角色设计区域 Shape (角色图片)
export type CharacterSectionShape = TLBaseShape<
	typeof SHAPE_TYPES.CHARACTER_SECTION,
	{
		w: number;
		h: number;
		characters: ReviewedCharacter[];
		sectionTitle: string;
	} & CanvasSectionStatusProps
>;

// 分镜图区域 Shape
export type StoryboardSectionShape = TLBaseShape<
	typeof SHAPE_TYPES.STORYBOARD_SECTION,
	{
		w: number;
		h: number;
		shots: ReviewedShot[];
		sectionTitle: string;
	} & CanvasSectionStatusProps
>;

// 视频区域 Shape
export type VideoSectionShape = TLBaseShape<
	typeof SHAPE_TYPES.VIDEO_SECTION,
	{
		w: number;
		h: number;
		projectId: number;
		videoUrl: string;
		title: string;
		downloadUrl: string;
		previewLabel: string;
		downloadLabel: string;
		retryLabel: string;
		provenanceText: string;
		blockingText: string;
		retryFeedback: string;
		retryRunId: number | null;
		retryThreadId: string | null;
	} & CanvasSectionStatusProps
>;

// 规划区域 Shape (故事原文、摘要、分镜总览)
export type PlanSectionShape = TLBaseShape<
	typeof SHAPE_TYPES.PLAN_SECTION,
	{
		w: number;
		h: number;
		projectId: number;
		story: string;
		summary: string;
		characters: ReviewedCharacter[];
		shots: ReviewedShot[];
	} & CanvasSectionStatusProps
>;

// 单角色卡片 Shape (独立可拖动)
export type CharacterCardShape = TLBaseShape<
	typeof SHAPE_TYPES.CHARACTER_CARD,
	{
		w: number;
		h: number;
		character: ReviewedCharacter;
	}
>;

// 单镜头卡片 Shape (独立可拖动)
export type ShotCardShape = TLBaseShape<
	typeof SHAPE_TYPES.SHOT_CARD,
	{
		w: number;
		h: number;
		shot: ReviewedShot;
	}
>;

// 合成区域 Shape (最终视频)
export type ComposeSectionShape = TLBaseShape<
	typeof SHAPE_TYPES.COMPOSE_SECTION,
	{
		w: number;
		h: number;
		projectId: number;
		videoUrl: string;
		videoTitle: string;
		downloadUrl: string;
	} & CanvasSectionStatusProps
>;

// 扩展 tldraw 全局类型
declare module "tldraw" {
	interface TLGlobalShapePropsMap {
		[SHAPE_TYPES.STORYBOARD_BOARD]: StoryboardBoardShape["props"];
		[SHAPE_TYPES.SCRIPT_SECTION]: ScriptSectionShape["props"];
		[SHAPE_TYPES.CHARACTER_SECTION]: CharacterSectionShape["props"];
		[SHAPE_TYPES.STORYBOARD_SECTION]: StoryboardSectionShape["props"];
		[SHAPE_TYPES.VIDEO_SECTION]: VideoSectionShape["props"];
		[SHAPE_TYPES.PLAN_SECTION]: PlanSectionShape["props"];
		[SHAPE_TYPES.CHARACTER_CARD]: CharacterCardShape["props"];
		[SHAPE_TYPES.SHOT_CARD]: ShotCardShape["props"];
		[SHAPE_TYPES.COMPOSE_SECTION]: ComposeSectionShape["props"];
	}
}

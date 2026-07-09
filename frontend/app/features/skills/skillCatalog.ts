/**
 * Frontend skill presets — OiiOii-style entry points.
 * Backend orchestration hooks land in Phase 3; for now skills prefill create form.
 */

export type SkillBadge = "new" | "core" | "soon";

export interface SkillPreset {
	id: string;
	title: string;
	description: string;
	/** Accent token for card stripe */
	accent: "primary" | "secondary" | "accent" | "info";
	badge?: SkillBadge;
	/** Prefill values applied when user picks this skill */
	prefill: {
		style?: string;
		creationMode?: "review" | "quick";
		placeholder?: string;
		storyHint?: string;
	};
	/** false = UI only, generation path still uses default story pipeline */
	available: boolean;
}

export const SKILL_CATALOG: SkillPreset[] = [
	{
		id: "story-anime",
		title: "剧情故事创作",
		description: "一句话 → 大纲、角色、分镜、视频的完整漫剧链路。",
		accent: "primary",
		badge: "core",
		prefill: {
			style: "anime",
			creationMode: "review",
			placeholder: "主角是谁？冲突是什么？最想看到的三帧画面？",
			storyHint: "",
		},
		available: true,
	},
	{
		id: "character-design",
		title: "角色设计",
		description: "先锁定人设与形象，再进入分镜生产。",
		accent: "secondary",
		badge: "core",
		prefill: {
			style: "anime",
			creationMode: "review",
			placeholder: "描述角色外貌、性格、标志性道具与出场情绪。",
			storyHint: "【角色设计优先】\n",
		},
		available: true,
	},
	{
		id: "script-breakdown",
		title: "剧本智能拆分",
		description: "把已有剧本拆成镜头清单与场次结构。",
		accent: "accent",
		badge: "core",
		prefill: {
			style: "cinematic",
			creationMode: "review",
			placeholder: "粘贴剧本或分场大纲，系统会拆成可审阅分镜。",
			storyHint: "【剧本拆分】\n",
		},
		available: true,
	},
	{
		id: "quick-short",
		title: "快速成片",
		description: "少打断、托管式跑通整条流水线，适合草稿验证。",
		accent: "info",
		prefill: {
			style: "anime",
			creationMode: "quick",
			placeholder: "用一句话描述短片点子，系统将自动推进各阶段。",
		},
		available: true,
	},
	{
		id: "video-reimagine",
		title: "拉片复刻",
		description: "上传参考片 → 结构化拆解 → 换元素再生成（即将接入）。",
		accent: "secondary",
		badge: "soon",
		prefill: {
			style: "cinematic",
			creationMode: "review",
			placeholder: "先用文字描述想复刻的镜头结构与替换元素。",
			storyHint: "【拉片复刻草稿】\n参考片要点：\n要替换的角色/场景：\n",
		},
		available: true,
	},
	{
		id: "product-ad",
		title: "商品展示广告",
		description: "卖点 + 产品参考 → 广告分镜短片工作流。",
		accent: "accent",
		badge: "soon",
		prefill: {
			style: "cinematic",
			creationMode: "review",
			placeholder: "产品是什么？核心卖点？目标受众与口播语气？",
			storyHint: "【商品广告】\n产品：\n卖点：\n",
		},
		available: true,
	},
	{
		id: "scene-design",
		title: "场景设计",
		description: "先铺场景资产，再挂角色与镜头。",
		accent: "primary",
		prefill: {
			style: "donghua",
			creationMode: "review",
			placeholder: "描述时代、地点、天气、光线与关键道具。",
			storyHint: "【场景优先】\n",
		},
		available: true,
	},
	{
		id: "comedy-pet",
		title: "萌宠 / 搞笑短片",
		description: "轻松题材模板：节奏更快、分镜更短。",
		accent: "info",
		prefill: {
			style: "pixar",
			creationMode: "quick",
			placeholder: "宠物/搞笑桥段一句话，最好带反转。",
		},
		available: true,
	},
];

export function getSkillById(id: string): SkillPreset | undefined {
	return SKILL_CATALOG.find((skill) => skill.id === id);
}

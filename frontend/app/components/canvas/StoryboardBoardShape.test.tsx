import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StoryboardBoardShapeUtil } from "./shapes/StoryboardBoardShape";
import type { StoryboardBoardShape } from "./shapes/types";

vi.mock("~/services/api", () => ({
	getStaticUrl: (path: string | null | undefined) => path,
}));

vi.mock("~/hooks/useDomSize", () => ({
	useDomSize: () => ({ current: null }),
	getShapeSize: () => undefined,
}));

const emitSpy = vi.fn();
vi.mock("./canvasEvents", () => ({
	canvasEvents: {
		emit: (...args: unknown[]) => emitSpy(...args),
	},
}));

const shapeUtil = new StoryboardBoardShapeUtil({} as never);

function createShape(
	props: Partial<StoryboardBoardShape["props"]> = {},
): StoryboardBoardShape {
	return {
		id: "shape:storyboard-board",
		type: "storyboard-board",
		x: 0,
		y: 0,
		props: {
			w: 920,
			h: 600,
			projectId: 1,
			story: "小猫喝水",
			summary: "小猫在阳光下喝水",
			characters: [],
			shots: [],
			videoUrl: "",
			videoTitle: "小猫喝水",
			visibleSections: ["plan", "render", "compose"],
			sectionStates: {
				plan: "complete",
				render: "complete",
				compose: "draft",
			},
			placeholders: {
				plan: false,
				render: false,
				compose: true,
			},
			statusLabels: {
				plan: "已完成",
				render: "已完成",
				compose: "待生成",
			},
			placeholderTexts: {
				render: "等待角色和分镜渲染生成...",
				compose: "等待视频合成...",
			},
			downloadUrl: "/api/v1/projects/1/final-video",
			...props,
		},
	} as StoryboardBoardShape;
}

const draftCharacter = {
	id: 1,
	project_id: 1,
	name: "阿宁",
	description: "冷静的侦探",
	image_url: "/static/characters/aning.png",
	approval_state: "draft" as const,
	approval_version: 1,
	approved_at: null,
	approved_name: null,
	approved_description: null,
	approved_image_url: null,
};

const draftShot = {
	id: 11,
	project_id: 1,
	order: 1,
	description: "阿宁走进雨夜街道",
	prompt: "Wide shot",
	image_prompt: "雨夜街道",
	image_url: "/static/shots/1.png",
	video_url: "/static/shots/1.mp4",
	duration: 7,
	camera: "wide",
	motion_note: "slow push in",
	scene: "雨夜街道",
	action: "走进街道",
	expression: "警觉",
	lighting: "冷色路灯",
	dialogue: "这里有线索。",
	sfx: null,
	character_ids: [1],
	approval_state: "draft" as const,
	approval_version: 1,
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
	seed: null,
};

describe("StoryboardBoardShape", () => {
	beforeEach(() => {
		emitSpy.mockClear();
		vi.restoreAllMocks();
	});

	it("renders all visible sections inside one board", () => {
		render(shapeUtil.component(createShape()));

		expect(screen.getByText("编剧规划")).toBeInTheDocument();
		expect(screen.getByText("视觉渲染")).toBeInTheDocument();
		expect(screen.getByText("最终输出")).toBeInTheDocument();
	});

	it("renders curved flow connector labels between adjacent sections", () => {
		render(shapeUtil.component(createShape()));

		expect(screen.getByText("角色与分镜接力")).toBeInTheDocument();
		expect(screen.getByText("镜头汇成成片")).toBeInTheDocument();
	});

	it("keeps only lightweight character card actions", () => {
		render(shapeUtil.component(createShape({ characters: [draftCharacter] })));

		expect(screen.queryByTitle("重新生成")).not.toBeInTheDocument();
		expect(screen.queryByTitle("编辑")).not.toBeInTheDocument();
		expect(screen.queryByTitle("批准")).not.toBeInTheDocument();
		expect(screen.queryByTitle("添加到资产库")).not.toBeInTheDocument();
		expect(screen.getByTitle("版本历史")).toBeInTheDocument();
	});

	it("keeps only lightweight shot card actions", () => {
		render(shapeUtil.component(createShape({ shots: [draftShot] })));

		expect(screen.queryByTitle("重新生成")).not.toBeInTheDocument();
		expect(screen.queryByTitle("编辑")).not.toBeInTheDocument();
		expect(screen.queryByTitle("批准")).not.toBeInTheDocument();
		expect(screen.queryByTitle("保存到资产库")).not.toBeInTheDocument();
		expect(screen.getByTitle("预览片段")).toBeInTheDocument();
		expect(screen.getByTitle("版本历史")).toBeInTheDocument();
	});

	it("emits character version history actions", () => {
		render(shapeUtil.component(createShape({ characters: [draftCharacter] })));

		screen.getByTitle("版本历史").click();

		expect(emitSpy).toHaveBeenCalledWith(
			"shape-action",
			expect.objectContaining({
				action: "history",
				entityType: "character",
				entityId: 1,
				feedbackType: "render",
			}),
		);
	});

	it("emits shot preview and version history actions", () => {
		render(shapeUtil.component(createShape({ shots: [draftShot] })));

		screen.getByTitle("预览片段").click();
		expect(emitSpy).toHaveBeenCalledWith("preview-video", {
			src: "/static/shots/1.mp4",
			title: "镜头 1",
		});

		screen.getByTitle("版本历史").click();

		expect(emitSpy).toHaveBeenCalledWith(
			"shape-action",
			expect.objectContaining({
				action: "history",
				entityType: "shot",
				entityId: 11,
				feedbackType: "render",
			}),
		);
	});
});

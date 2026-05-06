import { describe, it, expect } from "vitest";
import { useCanvasLayout } from "./useCanvasLayout";
import { renderHook } from "@testing-library/react";
import type { SectionKey } from "./useCanvasLayout";
import type { Character, Shot } from "~/types";

const defaultProps = {
	projectId: 1,
	story: "test story",
	summary: "test summary",
	characters: [] as Character[],
	shots: [] as Shot[],
	videoUrl: null as string | null,
	videoTitle: "Video",
	visibleSections: ["plan"] as SectionKey[],
	isGenerating: false,
	awaitingConfirm: false,
	currentRunId: null as number | null,
	currentStage: "plan" as const,
};

function makeCharacter(id: number, name: string): Character {
	return {
		id,
		project_id: 1,
		name,
		description: "",
		image_url: null,
		approval_state: "draft",
		approval_version: 1,
		approved_at: null,
		approved_name: null,
		approved_description: null,
		approved_image_url: null,
	} as unknown as Character;
}

function makeShot(id: number, order: number): Shot {
	return {
		id,
		project_id: 1,
		order,
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
	} as unknown as Shot;
}

describe("useCanvasLayout", () => {
	it("returns a plan-section shape when plan is visible", () => {
		const { result } = renderHook(() =>
			useCanvasLayout({
				...defaultProps,
				visibleSections: ["plan"] as SectionKey[],
			}),
		);
		const types = result.current.shapes.map((s) => s.type);
		expect(types).toContain("plan-section");
	});

	it("does not return plan-section when plan is not visible", () => {
		const { result } = renderHook(() =>
			useCanvasLayout({
				...defaultProps,
				visibleSections: [] as SectionKey[],
			}),
		);
		const types = result.current.shapes.map((s) => s.type);
		expect(types).not.toContain("plan-section");
	});

	it("groups character cards inside a character-section with parentId", () => {
		const characters = [makeCharacter(1, "Alice"), makeCharacter(2, "Bob")];
		const { result } = renderHook(() =>
			useCanvasLayout({
				...defaultProps,
				characters,
				visibleSections: ["plan", "render"] as SectionKey[],
			}),
		);
		const charSection = result.current.shapes.find(
			(s) => s.type === "character-section",
		);
		expect(charSection).toBeDefined();

		const charCards = result.current.shapes.filter(
			(s) => s.type === "character-card",
		);
		expect(charCards).toHaveLength(2);
		// All character cards should have parentId pointing to the character-section
		for (const card of charCards) {
			expect(card.parentId).toBe(charSection!.id);
		}
	});

	it("groups shot cards inside a storyboard-section with parentId", () => {
		const shots = [makeShot(10, 1), makeShot(20, 2)];
		const { result } = renderHook(() =>
			useCanvasLayout({
				...defaultProps,
				shots,
				visibleSections: ["plan", "render"] as SectionKey[],
			}),
		);
		const shotSection = result.current.shapes.find(
			(s) => s.type === "storyboard-section",
		);
		expect(shotSection).toBeDefined();

		const shotCards = result.current.shapes.filter(
			(s) => s.type === "shot-card",
		);
		expect(shotCards).toHaveLength(2);
		// All shot cards should have parentId pointing to the storyboard-section
		for (const card of shotCards) {
			expect(card.parentId).toBe(shotSection!.id);
		}
	});

	it("positions character cards relative to their parent section", () => {
		const characters = [makeCharacter(1, "A"), makeCharacter(2, "B")];
		const { result } = renderHook(() =>
			useCanvasLayout({
				...defaultProps,
				characters,
				visibleSections: ["plan", "render"] as SectionKey[],
			}),
		);
		const charCards = result.current.shapes.filter(
			(s) => s.type === "character-card",
		);
		// First card: column 0, relative x = 0
		expect(charCards[0]!.x).toBe(0);
		// Second card: column 1, relative x > 0
		expect(charCards[1]!.x).toBeGreaterThan(0);
	});

	it("creates a compose-section shape when compose is visible", () => {
		const { result } = renderHook(() =>
			useCanvasLayout({
				...defaultProps,
				videoUrl: "http://example.com/video.mp4",
				visibleSections: ["plan", "render", "compose"] as SectionKey[],
			}),
		);
		const types = result.current.shapes.map((s) => s.type);
		expect(types).toContain("compose-section");
	});

	it("does not create compose-section when compose is not visible", () => {
		const { result } = renderHook(() =>
			useCanvasLayout({
				...defaultProps,
				videoUrl: "http://example.com/video.mp4",
				visibleSections: ["plan"] as SectionKey[],
			}),
		);
		const types = result.current.shapes.map((s) => s.type);
		expect(types).not.toContain("compose-section");
	});

	it("assigns stable shape IDs based on entity type and ID", () => {
		const characters = [makeCharacter(42, "Test")];
		const { result } = renderHook(() =>
			useCanvasLayout({
				...defaultProps,
				characters,
				visibleSections: ["plan", "render"] as SectionKey[],
			}),
		);
		const charCard = result.current.shapes.find(
			(s) => s.type === "character-card",
		);
		expect(charCard).toBeDefined();
		// Shape ID should be stable (same character ID produces same shape ID)
		const { result: result2 } = renderHook(() =>
			useCanvasLayout({
				...defaultProps,
				characters,
				visibleSections: ["plan", "render"] as SectionKey[],
			}),
		);
		const charCard2 = result2.current.shapes.find(
			(s) => s.type === "character-card",
		);
		expect(charCard2?.id).toBe(charCard?.id);
	});

	it("marks plan section state as generating when generating", () => {
		const { result } = renderHook(() =>
			useCanvasLayout({
				...defaultProps,
				isGenerating: true,
				story: null,
				summary: null,
				visibleSections: ["plan"] as SectionKey[],
			}),
		);
		const planShape = result.current.shapes.find(
			(s) => s.type === "plan-section",
		);
		expect(planShape?.props).toBeDefined();
		expect((planShape!.props as Record<string, unknown>).sectionState).toBe(
			"generating",
		);
	});

	it("marks plan section state as complete when story exists", () => {
		const { result } = renderHook(() =>
			useCanvasLayout({
				...defaultProps,
				story: "hello",
				summary: "world",
				visibleSections: ["plan"] as SectionKey[],
			}),
		);
		const planShape = result.current.shapes.find(
			(s) => s.type === "plan-section",
		);
		expect(planShape?.props).toBeDefined();
		expect((planShape!.props as Record<string, unknown>).sectionState).toBe(
			"complete",
		);
	});
});

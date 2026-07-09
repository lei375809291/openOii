import type {
	ComicWorkflowGraph,
	ComicWorkflowNode,
	ComicWorkflowSection,
} from "./types";

export interface WorkflowRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface WorkflowLayoutNode extends WorkflowRect {
	id: string;
	node: ComicWorkflowNode;
}

export interface WorkflowLayoutFrame extends WorkflowRect {
	id: string;
	section: ComicWorkflowSection;
}

export interface ComicWorkflowLayout {
	frames: WorkflowLayoutFrame[];
	nodes: WorkflowLayoutNode[];
}

/** Dense cards — sizes align with Design Contract shot tokens where applicable. */
const CARD_SIZE: Record<ComicWorkflowNode["kind"], { w: number; h: number }> = {
	brief: { w: 340, h: 260 },
	character: { w: 200, h: 250 },
	shot: { w: 220, h: 300 }, // --shot-card-w/h
	output: { w: 340, h: 250 },
};

/** Classic storyboard grid columns (九宫格 reading order). */
export const SHOT_GRID_COLUMNS = 3;

const GAP = {
	section: 48, // ~ --canvas-gap-section
	card: 14, // ~ --canvas-gap-card
	framePaddingX: 20, // ~ --canvas-frame-pad
	frameHeader: 56, // ~ --canvas-frame-header
};

const START = { x: 64, y: 64 };

export function shotGridPosition(
	index: number,
	columns: number = SHOT_GRID_COLUMNS,
): { row: number; column: number } {
	const cols = Math.max(1, columns);
	return {
		row: Math.floor(index / cols),
		column: index % cols,
	};
}

function rows(count: number, columns: number): number {
	return Math.max(1, Math.ceil(count / columns));
}

function nodesForSection(
	graph: ComicWorkflowGraph,
	section: ComicWorkflowSection,
): ComicWorkflowNode[] {
	return graph.nodes.filter((node) => node.section === section);
}

function frameForCards({
	x,
	y,
	cardWidth,
	cardHeight,
	columns,
	count,
	minWidth,
	minHeight,
}: {
	x: number;
	y: number;
	cardWidth: number;
	cardHeight: number;
	columns: number;
	count: number;
	minWidth: number;
	minHeight: number;
}): WorkflowRect {
	const rowCount = rows(count, columns);
	return {
		x,
		y,
		w: Math.max(
			minWidth,
			GAP.framePaddingX * 2 + columns * cardWidth + (columns - 1) * GAP.card,
		),
		h: Math.max(
			minHeight,
			GAP.frameHeader +
				rowCount * cardHeight +
				(rowCount - 1) * GAP.card +
				GAP.framePaddingX,
		),
	};
}

export function layoutComicWorkflow(
	graph: ComicWorkflowGraph,
): ComicWorkflowLayout {
	const briefNodes = nodesForSection(graph, "brief");
	const characterNodes = nodesForSection(graph, "elements");
	const shotNodes = nodesForSection(graph, "shotline");
	const outputNodes = nodesForSection(graph, "output");
	const characterColumns = Math.max(1, Math.min(4, characterNodes.length || 1));
	// Always project shots as a storyboard grid (max 3 columns → 九宫格 feel).
	const shotColumns = Math.min(
		SHOT_GRID_COLUMNS,
		Math.max(1, shotNodes.length || 1),
	);

	const briefFrame: WorkflowLayoutFrame = {
		id: "frame:brief",
		section: "brief",
		x: START.x,
		y: START.y,
		w: 400,
		h: 380,
	};

	const elementsFrame = {
		id: "frame:elements",
		section: "elements" as const,
		...frameForCards({
			x: briefFrame.x + briefFrame.w + GAP.section,
			y: START.y,
			cardWidth: CARD_SIZE.character.w,
			cardHeight: CARD_SIZE.character.h,
			columns: characterColumns,
			count: characterNodes.length,
			minWidth: 640,
			minHeight: 320,
		}),
	};

	const shotlineFrame = {
		id: "frame:shotline",
		section: "shotline" as const,
		...frameForCards({
			x: elementsFrame.x,
			y: elementsFrame.y + elementsFrame.h + GAP.section,
			cardWidth: CARD_SIZE.shot.w,
			cardHeight: CARD_SIZE.shot.h,
			columns: shotColumns,
			count: shotNodes.length,
			// Width for a full 3-up row even when fewer shots exist
			minWidth:
				GAP.framePaddingX * 2 +
				SHOT_GRID_COLUMNS * CARD_SIZE.shot.w +
				(SHOT_GRID_COLUMNS - 1) * GAP.card,
			minHeight: 360,
		}),
	};

	const outputFrame: WorkflowLayoutFrame = {
		id: "frame:output",
		section: "output",
		x: shotlineFrame.x + shotlineFrame.w + GAP.section,
		y: shotlineFrame.y + 24,
		w: 400,
		h: 320,
	};

	const layoutNodes: WorkflowLayoutNode[] = [];

	for (const node of briefNodes) {
		layoutNodes.push({
			id: node.id,
			node,
			x: briefFrame.x + 40,
			y: briefFrame.y + GAP.frameHeader,
			...CARD_SIZE.brief,
		});
	}

	characterNodes.forEach((node, index) => {
		const row = Math.floor(index / characterColumns);
		const column = index % characterColumns;
		layoutNodes.push({
			id: node.id,
			node,
			x:
				elementsFrame.x +
				GAP.framePaddingX +
				column * (CARD_SIZE.character.w + GAP.card),
			y:
				elementsFrame.y +
				GAP.frameHeader +
				row * (CARD_SIZE.character.h + GAP.card),
			...CARD_SIZE.character,
		});
	});

	shotNodes.forEach((node, index) => {
		const { row, column } = shotGridPosition(index, shotColumns);
		layoutNodes.push({
			id: node.id,
			node,
			x:
				shotlineFrame.x +
				GAP.framePaddingX +
				column * (CARD_SIZE.shot.w + GAP.card),
			y:
				shotlineFrame.y +
				GAP.frameHeader +
				row * (CARD_SIZE.shot.h + GAP.card),
			...CARD_SIZE.shot,
		});
	});

	for (const node of outputNodes) {
		layoutNodes.push({
			id: node.id,
			node,
			x: outputFrame.x + 50,
			y: outputFrame.y + GAP.frameHeader,
			...CARD_SIZE.output,
		});
	}

	return {
		frames: [briefFrame, elementsFrame, shotlineFrame, outputFrame],
		nodes: layoutNodes,
	};
}

import { useMemo } from "react";
import { createShapeId, type TLShapePartial } from "tldraw";
import { SHAPE_TYPES } from "~/components/canvas/shapes";
import type { StoryboardBoardShape } from "~/components/canvas/shapes";
import type { Character, Shot, WorkflowStage } from "~/types";

type SectionKey = "plan" | "render" | "compose";
type SectionState = "draft" | "generating" | "blocked" | "complete";

interface LayoutConfig {
  startX: number;
  startY: number;
  boardWidth: number;
}

const DEFAULT_CONFIG: LayoutConfig = {
  startX: 100,
  startY: 100,
  boardWidth: Math.min(920, (typeof window !== "undefined" ? window.innerWidth : 960) - 40),
};

const SECTION_ORDER: SectionKey[] = ["plan", "render", "compose"];

const SECTION_LABELS: Record<SectionKey, string> = {
  plan: "规划",
  render: "渲染",
  compose: "合成",
};

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
  },
): SectionState {
  const isActive = data.isGenerating || data.awaitingConfirm || Boolean(data.currentRunId);
  const hasContent = Boolean(data.story) || Boolean(data.summary);
  const hasCharImages = data.characters.some((c) => Boolean(c.image_url));
  const hasStoryboardImg = data.shots.some((s) => Boolean(s.image_url));

  switch (key) {
    case "plan":
      return isActive && !hasContent ? "generating" : hasContent ? "complete" : "draft";
    case "render":
      if (data.characters.length === 0 && data.shots.length === 0) return "blocked";
      if (hasCharImages && hasStoryboardImg) return "complete";
      if (isActive) return "generating";
      return "draft";
    case "compose":
      return data.videoUrl ? "complete" : data.shots.length === 0 ? "blocked" : isActive ? "generating" : "draft";
  }
}

function isPlaceholder(key: SectionKey, data: {
  story: string | null;
  summary: string | null;
  characters: Character[];
  shots: Shot[];
  videoUrl: string | null;
}): boolean {
  switch (key) {
    case "plan":
      return !data.story && !data.summary;
    case "render":
      return data.characters.length === 0 && data.shots.length === 0;
    case "compose":
      return !data.videoUrl;
  }
}

export type StoryboardBoardPartial = TLShapePartial<StoryboardBoardShape>;

export interface CanvasLayoutResult {
  shapes: StoryboardBoardPartial[];
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
  currentStage: _currentStage,
  config: customConfig,
}: UseCanvasLayoutProps) {
  const config = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...customConfig }),
    [customConfig],
  );

  const sectionData = useMemo(
    () => ({ story, summary, characters, shots, videoUrl, isGenerating, awaitingConfirm, currentRunId }),
    [story, summary, characters, shots, videoUrl, isGenerating, awaitingConfirm, currentRunId],
  );

  const result = useMemo(() => {
    const visibleSet = new Set(visibleSections);
    const visibleList = SECTION_ORDER.filter((s) => visibleSet.has(s));
    const sectionStates: Partial<Record<SectionKey, SectionState>> = {};
    const placeholders: Partial<Record<SectionKey, boolean>> = {};
    const statusLabels: Partial<Record<SectionKey, string>> = {};
    const placeholderTexts: Partial<Record<SectionKey, string>> = {};

    for (const section of visibleList) {
      const state = deriveSectionState(section, sectionData);
      sectionStates[section] = state;
      placeholders[section] = isPlaceholder(section, sectionData);
      statusLabels[section] = SECTION_STATUS_LABELS[state];
      placeholderTexts[section] = SECTION_PLACEHOLDER_TEXT[section];
    }

    const shapes: StoryboardBoardPartial[] = [{
      id: createShapeId("storyboard-board"),
      type: SHAPE_TYPES.STORYBOARD_BOARD,
      x: config.startX,
      y: config.startY,
      props: {
        w: config.boardWidth,
        h: 600,
        projectId,
        story: story || "",
        summary: summary || "",
        characters,
        shots,
        videoUrl: videoUrl || "",
        videoTitle,
        visibleSections: visibleList,
        sectionStates,
        placeholders,
        statusLabels,
        placeholderTexts,
        downloadUrl: `/api/v1/projects/${projectId}/final-video`,
      },
    }];

    return { shapes };
  }, [
    story,
    summary,
    characters,
    shots,
    videoUrl,
    videoTitle,
    config,
    sectionData,
    visibleSections,
    projectId,
  ]);

  return result;
}

export type { SectionKey, SectionState };
export { SECTION_ORDER, SECTION_LABELS, SECTION_PLACEHOLDER_TEXT, SECTION_STATUS_LABELS };

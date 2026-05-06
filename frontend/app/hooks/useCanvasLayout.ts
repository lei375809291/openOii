import { useMemo } from "react";
import type { TLShapePartial } from "tldraw";
import { SHAPE_TYPES } from "~/components/canvas/shapes";
import type { Character, Shot, WorkflowStage } from "~/types";

type SectionKey = "plan" | "character" | "shot" | "compose";
type SectionState = "draft" | "generating" | "blocked" | "complete";

interface LayoutConfig {
  startX: number;
  startY: number;
  sectionWidth: number;
  sectionGap: number;
}

const DEFAULT_CONFIG: LayoutConfig = {
  startX: 100,
  startY: 100,
  sectionWidth: 800,
  sectionGap: 40,
};

const SECTION_ORDER: SectionKey[] = ["plan", "character", "shot", "compose"];

const SECTION_LABELS: Record<SectionKey, string> = {
  plan: "规划",
  character: "角色",
  shot: "分镜",
  compose: "合成",
};

const SECTION_PLACEHOLDER_TEXT: Record<SectionKey, string> = {
  plan: "等待规划生成...",
  character: "等待角色形象图生成...",
  shot: "等待分镜首帧图生成...",
  compose: "等待视频合成...",
};

const SECTION_SHAPE_TYPES: Record<SectionKey, string> = {
  plan: SHAPE_TYPES.SCRIPT_SECTION,
  character: SHAPE_TYPES.CHARACTER_SECTION,
  shot: SHAPE_TYPES.STORYBOARD_SECTION,
  compose: SHAPE_TYPES.VIDEO_SECTION,
};

const SECTION_STATUS_LABELS: Record<SectionState, string> = {
  draft: "待生成",
  generating: "生成中",
  blocked: "待生成",
  complete: "已完成",
};

const SECTION_FALLBACK_H: Record<SectionKey, number> = {
  plan: 200,
  character: 200,
  shot: 200,
  compose: 300,
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
    case "character":
      if (data.characters.length === 0) return "blocked";
      if (hasCharImages) return "complete";
      if (isActive) return "generating";
      return "draft";
    case "shot":
      if (data.shots.length === 0) return "blocked";
      if (hasStoryboardImg) return "complete";
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
    case "character":
      return data.characters.length === 0;
    case "shot":
      return data.shots.length === 0;
    case "compose":
      return !data.videoUrl;
  }
}

export interface CanvasLayoutResult {
  shapes: TLShapePartial[];
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
    const shapes: TLShapePartial[] = [];
    let currentY = config.startY;

    const contentBySection: Record<SectionKey, Record<string, unknown>> = {
      plan: {
        story: story || "",
        summary: summary || "",
        characters,
        shots,
      },
      character: { characters, sectionTitle: "角色形象" },
      shot: { shots, sectionTitle: "分镜画面" },
      compose: {
        projectId,
        videoUrl: videoUrl || "",
        title: videoTitle,
        downloadUrl: `/api/v1/projects/${projectId}/final-video`,
        previewLabel: "预览最终视频",
        downloadLabel: "下载最终视频",
        retryLabel: "重试合成",
        provenanceText: "",
        blockingText: "",
        retryFeedback: "",
        retryRunId: null,
        retryThreadId: null,
      },
    };

    const visibleSet = new Set(visibleSections);
    const visibleList = SECTION_ORDER.filter((s) => visibleSet.has(s));

    for (const section of visibleList) {
      const state = deriveSectionState(section, sectionData);
      const placeholder = isPlaceholder(section, sectionData);

      shapes.push({
        id: `shape:${section}` as any,
        type: SECTION_SHAPE_TYPES[section] as (typeof SHAPE_TYPES)[keyof typeof SHAPE_TYPES],
        x: config.startX,
        y: currentY,
        props: {
          w: config.sectionWidth,
          h: SECTION_FALLBACK_H[section],
          ...contentBySection[section],
          sectionState: state,
          placeholder,
          statusLabel: SECTION_STATUS_LABELS[state],
          placeholderText: SECTION_PLACEHOLDER_TEXT[section],
        },
      } as TLShapePartial);

      currentY += SECTION_FALLBACK_H[section] + config.sectionGap;
    }

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
export { SECTION_ORDER, SECTION_LABELS, SECTION_PLACEHOLDER_TEXT, SECTION_STATUS_LABELS, SECTION_FALLBACK_H };

import { useMemo } from "react";
import type { TLShapePartial } from "tldraw";
import { SHAPE_TYPES } from "~/components/canvas/shapes";
import type { Character, Shot, WorkflowStage } from "~/types";

type SectionKey = "plan" | "render" | "compose";
type SectionState = "draft" | "generating" | "blocked" | "complete";

interface LayoutConfig {
  startX: number;
  startY: number;
  sectionWidth: number;
  sectionGap: number;
  shotCardWidth: number;
  shotCardHeight: number;
  shotCardGap: number;
}

const DEFAULT_CONFIG: LayoutConfig = {
  startX: 100,
  startY: 100,
  sectionWidth: 800,
  sectionGap: 96,
  shotCardWidth: 180,
  shotCardHeight: 320,
  shotCardGap: 16,
};

const SECTION_ORDER: SectionKey[] = ["plan", "render", "compose"];

const SECTION_LABELS: Record<SectionKey, string> = {
  plan: "规划",
  render: "渲染",
  compose: "合成",
};

const SECTION_PLACEHOLDER_TEXT: Record<SectionKey, string> = {
  plan: "等待规划生成...",
  render: "等待角色与分镜生成...",
  compose: "等待视频合成...",
};

const SECTION_SHAPE_TYPES: Record<SectionKey, string> = {
  plan: SHAPE_TYPES.SCRIPT_SECTION,
  render: SHAPE_TYPES.STORYBOARD_SECTION,
  compose: SHAPE_TYPES.VIDEO_SECTION,
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
  const hasApprovedChar = data.characters.some((c) => c.approval_state === "approved");
  const hasStoryboardImg = data.shots.some((s) => Boolean(s.image_url));

  switch (key) {
    case "plan":
      return isActive && !hasContent ? "generating" : hasContent ? "complete" : "draft";
    case "render":
      return data.characters.length === 0
        ? "blocked"
        : hasApprovedChar && hasStoryboardImg
          ? "complete"
          : isActive
            ? "generating"
            : "draft";
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
      return data.characters.length === 0 || !data.shots.some((s) => Boolean(s.image_url));
    case "compose":
      return !data.videoUrl;
  }
}

function calculatePlanHeight(story: string | null, summary: string | null, shotCount: number): number {
  let height = 80;
  const text = story || summary || "";
  if (text) {
    const lines = Math.ceil(text.length / 30);
    height += 20 + lines * 22 + 32;
  }
  if (shotCount > 0) {
    height += 32 + shotCount * 36 + 8;
  }
  return Math.max(height, 200);
}

function calculateRenderHeight(characters: Character[], shots: Shot[], config: LayoutConfig): number {
  const charRows = characters.length > 0 ? Math.ceil(characters.length / 2) : 0;
  const shotRows = shots.length > 0 ? Math.ceil(shots.length / 4) : 0;
  const charHeight = charRows > 0 ? 70 + charRows * 360 + 16 : 0;
  const shotHeight = shotRows > 0 ? 80 + shotRows * (config.shotCardHeight + config.shotCardGap) + 16 : 0;
  const gap = (charHeight > 0 && shotHeight > 0) ? 32 : 0;
  return Math.max(charHeight + gap + shotHeight, 250);
}

function calculateComposeHeight(shots: Shot[], config: LayoutConfig): number {
  if (shots.length === 0) return 250;
  const rows = Math.ceil(shots.length / 4);
  return 80 + rows * (config.shotCardHeight + config.shotCardGap) + 200 + 16;
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

  const shapes = useMemo(() => {
    const result: TLShapePartial[] = [];
    let currentY = config.startY;

    const heights: Record<SectionKey, number> = {
      plan: calculatePlanHeight(story, summary, shots.length),
      render: calculateRenderHeight(characters, shots, config),
      compose: calculateComposeHeight(shots, config),
    };

    const widths: Record<SectionKey, number> = {
      plan: config.sectionWidth,
      render: config.sectionWidth,
      compose: config.sectionWidth,
    };

    const contentBySection: Record<SectionKey, Record<string, unknown>> = {
      plan: {
        story: story || "",
        summary: summary || "",
        characters,
        shots,
      },
      render: { shots, sectionTitle: "角色与分镜" },
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
    let visibleIndex = 0;

    for (const section of SECTION_ORDER) {
      if (!visibleSet.has(section)) continue;

      const state = deriveSectionState(section, sectionData);
      const placeholder = isPlaceholder(section, sectionData);
      const width = widths[section];
      const height = heights[section];

      result.push({
        id: `shape:${section}` as any,
        type: SECTION_SHAPE_TYPES[section] as (typeof SHAPE_TYPES)[keyof typeof SHAPE_TYPES],
        x: config.startX,
        y: currentY,
        props: {
          w: width,
          h: height,
          ...contentBySection[section],
          sectionState: state,
          placeholder,
          statusLabel: SECTION_STATUS_LABELS[state],
          placeholderText: SECTION_PLACEHOLDER_TEXT[section],
        },
      } as TLShapePartial);

      if (visibleIndex > 0) {
        const prevSection = SECTION_ORDER.filter((s) => visibleSet.has(s))[visibleIndex - 1];
        result.push({
          id: `shape:connector-${visibleIndex}` as any,
          type: SHAPE_TYPES.CONNECTOR,
          x: 0,
          y: 0,
          props: {
            fromId: `shape:${prevSection}`,
            toId: `shape:${section}`,
          },
        });
      }

      currentY += height + config.sectionGap;
      visibleIndex++;
    }

    return result;
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

  return shapes;
}

export type { SectionKey, SectionState };
export { SECTION_ORDER, SECTION_LABELS, SECTION_PLACEHOLDER_TEXT, SECTION_STATUS_LABELS };

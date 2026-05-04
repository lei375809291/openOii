import { useMemo } from "react";
import type { TLShapePartial } from "tldraw";
import { SHAPE_TYPES } from "~/components/canvas/shapes";
import type { Character, Shot, WorkflowStage } from "~/types";

type SectionKey = "script" | "characters" | "storyboards" | "clips" | "final-output";
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
  sectionGap: 60,
  shotCardWidth: 180,
  shotCardHeight: 240,
  shotCardGap: 16,
};

const SECTION_ORDER: SectionKey[] = [
  "script",
  "characters",
  "storyboards",
  "clips",
  "final-output",
];

const SECTION_LABELS: Record<SectionKey, string> = {
  script: "剧本",
  characters: "角色",
  storyboards: "分镜",
  clips: "片段",
  "final-output": "最终输出",
};

const SECTION_PLACEHOLDER_TEXT: Record<SectionKey, string> = {
  script: "等待剧本生成...",
  characters: "等待角色图生成...",
  storyboards: "等待分镜图生成...",
  clips: "等待片段生成...",
  "final-output": "等待最终输出...",
};

const SECTION_SHAPE_TYPES: Record<SectionKey, string> = {
  script: SHAPE_TYPES.SCRIPT_SECTION,
  characters: SHAPE_TYPES.CHARACTER_SECTION,
  storyboards: SHAPE_TYPES.STORYBOARD_SECTION,
  clips: SHAPE_TYPES.STORYBOARD_SECTION,
  "final-output": SHAPE_TYPES.VIDEO_SECTION,
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
  const hasClip = data.shots.some((s) => Boolean(s.video_url));

  switch (key) {
    case "script":
      return isActive && !hasContent ? "generating" : hasContent ? "complete" : "draft";
    case "characters":
      return data.characters.length === 0
        ? "blocked"
        : hasApprovedChar
          ? "complete"
          : isActive
            ? "generating"
            : "draft";
    case "storyboards":
      return data.shots.length === 0
        ? "blocked"
        : hasStoryboardImg
          ? "complete"
          : isActive
            ? "generating"
            : "draft";
    case "clips":
      return data.shots.length === 0
        ? "blocked"
        : hasClip
          ? "complete"
          : isActive
            ? "generating"
            : "draft";
    case "final-output":
      return data.videoUrl ? "complete" : "blocked";
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
    case "script":
      return !data.story && !data.summary;
    case "characters":
      return data.characters.length === 0;
    case "storyboards":
      return data.shots.length === 0 || !data.shots.some((s) => Boolean(s.image_url));
    case "clips":
      return data.shots.length === 0 || !data.shots.some((s) => Boolean(s.video_url));
    case "final-output":
      return !data.videoUrl;
  }
}

function calculateScriptHeight(story: string | null, summary: string | null, shotCount: number): number {
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

function calculateCharacterHeight(characters: Character[]): number {
  if (characters.length === 0) return 250;
  const rows = Math.ceil(characters.length / 2);
  return 70 + rows * 360 + 16;
}

function calculateStoryboardHeight(shots: Shot[], config: LayoutConfig): number {
  if (shots.length === 0) return 250;
  const cols = 4;
  const rows = Math.ceil(shots.length / cols);
  return 80 + rows * (config.shotCardHeight + config.shotCardGap) + 16;
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
      script: calculateScriptHeight(story, summary, shots.length),
      characters: calculateCharacterHeight(characters),
      storyboards: calculateStoryboardHeight(shots, config),
      clips: calculateStoryboardHeight(shots, config),
      "final-output": 450,
    };

    const widths: Record<SectionKey, number> = {
      script: config.sectionWidth,
      characters: config.sectionWidth,
      storyboards: config.sectionWidth,
      clips: config.sectionWidth,
      "final-output": 600,
    };

    const contentBySection: Record<SectionKey, Record<string, unknown>> = {
      script: {
        story: story || "",
        summary: summary || "",
        characters,
        shots,
      },
      characters: { characters },
      storyboards: { shots, sectionTitle: "分镜图" },
      clips: { shots, sectionTitle: "片段" },
      "final-output": {
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
      const x =
        section === "final-output"
          ? config.startX + (config.sectionWidth - width) / 2
          : config.startX;

      result.push({
        id: `shape:${section}` as any,
        type: SECTION_SHAPE_TYPES[section] as (typeof SHAPE_TYPES)[keyof typeof SHAPE_TYPES],
        x,
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

      if ((section === "storyboards" || section === "clips") && shots.length > 1) {
        const cols = 4;

        for (let i = 0; i < shots.length - 1; i++) {
          const row = Math.floor(i / cols);
          const nextRow = Math.floor((i + 1) / cols);

          if (nextRow > row) {
            result.push({
              id: `shape:${section}-shot-arrow-${i}` as any,
              type: SHAPE_TYPES.CONNECTOR,
              x: 0,
              y: 0,
              props: {
                fromId: `shape:${section}-shot-${i}`,
                toId: `shape:${section}-shot-${i + 1}`,
              },
            });
          } else {
            result.push({
              id: `shape:${section}-shot-arrow-${i}` as any,
              type: SHAPE_TYPES.CONNECTOR,
              x: 0,
              y: 0,
              props: {
                fromId: `shape:${section}-shot-${i}`,
                toId: `shape:${section}-shot-${i + 1}`,
              },
            });
          }
        }
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

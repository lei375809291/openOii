import { useMemo } from "react";
import type { TLShapePartial } from "tldraw";
import { SHAPE_TYPES } from "~/components/canvas/shapes";
import type { Character, Shot } from "~/types";
import {
  CANONICAL_SECTIONS,
  getWorkspaceSectionPlaceholderText,
  getWorkspaceSectionStatusLabel,
  type WorkspaceFinalOutputMeta,
  type WorkspaceSectionKey,
  type WorkspaceSectionState,
  type WorkspaceStatus,
} from "~/utils/workspaceStatus";

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
  sectionGap: 60,
};

interface UseCanvasLayoutProps {
  projectId: number;
  story: string | null;
  summary: string | null;
  characters: Character[];
  shots: Shot[];
  videoUrl: string | null;
  videoTitle: string;
  workspaceStatus?: WorkspaceStatus;
  finalOutputMeta?: WorkspaceFinalOutputMeta | null;
  config?: Partial<LayoutConfig>;
}

export function useCanvasLayout({
  projectId,
  story,
  summary,
  characters,
  shots,
  videoUrl,
  videoTitle,
  workspaceStatus,
  finalOutputMeta,
  config: customConfig,
}: UseCanvasLayoutProps) {
  const config = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...customConfig }),
    [customConfig]
  );

    const sectionStatuses = useMemo(
    () =>
      workspaceStatus?.sections ??
      buildFallbackSectionStatuses({
        story,
        summary,
        characters,
        shots,
        videoUrl,
      }),
    [workspaceStatus, story, summary, characters, shots, videoUrl]
  );

  const shapes = useMemo(() => {
    const result: TLShapePartial[] = [];
    let currentY = config.startY;

    // 计算各区域高度
    const scriptHeight = calculateScriptHeight(story, summary, characters, shots);
    const characterHeight = calculateCharacterHeight(characters);
    const storyboardHeight = calculateStoryboardHeight(shots);
    const videoHeight = 450;

    const sectionHeights: Record<WorkspaceSectionKey, number> = {
      script: scriptHeight,
      characters: characterHeight,
      storyboards: storyboardHeight,
      clips: storyboardHeight,
      "final-output": videoHeight,
    };

    const sectionWidths: Record<WorkspaceSectionKey, number> = {
      script: config.sectionWidth,
      characters: config.sectionWidth,
      storyboards: config.sectionWidth,
      clips: config.sectionWidth,
      "final-output": 600,
    };

    const contentBySection: Record<WorkspaceSectionKey, Record<string, unknown>> = {
      script: {
        story: story || "",
        summary: summary || "",
        characters,
        shots,
      },
      characters: {
        characters,
      },
      storyboards: {
        shots,
        sectionTitle: "分镜图",
      },
      clips: {
        shots,
        sectionTitle: "片段",
      },
      "final-output": {
        projectId,
        videoUrl: videoUrl || "",
        title: videoTitle,
        downloadUrl: finalOutputMeta?.downloadUrl || "",
        previewLabel: finalOutputMeta?.previewLabel || "预览最终视频",
        downloadLabel: finalOutputMeta?.downloadLabel || "下载最终视频",
        retryLabel: finalOutputMeta?.retryLabel || "重试合成",
        provenanceText: finalOutputMeta?.provenanceText || "",
        blockingText: finalOutputMeta?.blockingText || "",
        retryFeedback: finalOutputMeta?.retryFeedback || "",
        retryRunId: finalOutputMeta?.retryRunId ?? null,
        retryThreadId: finalOutputMeta?.retryThreadId ?? null,
      },
    };

    const sectionShapeTypes: Record<WorkspaceSectionKey, string> = {
      script: SHAPE_TYPES.SCRIPT_SECTION,
      characters: SHAPE_TYPES.CHARACTER_SECTION,
      storyboards: SHAPE_TYPES.STORYBOARD_SECTION,
      clips: SHAPE_TYPES.STORYBOARD_SECTION,
      "final-output": SHAPE_TYPES.VIDEO_SECTION,
    };

    sectionStatuses.forEach((status, index) => {
      const section = status.key;
      const width = sectionWidths[section];
      const height = sectionHeights[section];
      const x =
        section === "final-output"
          ? config.startX + (config.sectionWidth - width) / 2
          : config.startX;

      result.push({
        id: `shape:${section}` as any,
        type: sectionShapeTypes[section] as (typeof SHAPE_TYPES)[keyof typeof SHAPE_TYPES],
        x,
        y: currentY,
        props: {
          w: width,
          h: height,
          ...contentBySection[section],
          sectionState: status.state,
          placeholder: status.placeholder,
          statusLabel: getWorkspaceSectionStatusLabel(status.state),
          placeholderText: getWorkspaceSectionPlaceholderText(section),
        },
      } as TLShapePartial);

      if (index > 0) {
        const previousSection = sectionStatuses[index - 1];
        result.push({
          id: `shape:connector-${index}` as any,
          type: SHAPE_TYPES.CONNECTOR,
          x: 0,
          y: 0,
          props: {
            fromId: `shape:${previousSection.key}`,
            toId: `shape:${section}`,
          },
        });
      }

      currentY += height + config.sectionGap;
    });

    return result;
  }, [
    summary,
    characters,
    shots,
    videoUrl,
    videoTitle,
    config,
    sectionStatuses,
    projectId,
    finalOutputMeta,
  ]);

  return shapes;
}

function buildFallbackSectionStatuses(input: {
  story: string | null;
  summary: string | null;
  characters: Character[];
  shots: Shot[];
  videoUrl: string | null;
}): Array<{ key: WorkspaceSectionKey; state: WorkspaceSectionState; placeholder: boolean }> {
  const { story, summary, characters, shots, videoUrl } = input;
  const hasContent = Boolean(story) || Boolean(summary);
  const hasApprovedCharacter = characters.some((character) => character.approval_state === "approved");
  const hasStoryboardImage = shots.some((shot) => Boolean(shot.image_url));
  const hasClip = shots.some((shot) => Boolean(shot.video_url));

  return CANONICAL_SECTIONS.map((section) => {
    if (section.key === "script") {
      return {
        key: section.key,
        state: hasContent || characters.length > 0 || shots.length > 0 ? "generating" : "draft",
        placeholder: !hasContent && characters.length === 0 && shots.length === 0,
      };
    }

    if (section.key === "characters") {
      return {
        key: section.key,
        state: characters.length === 0 ? "blocked" : hasApprovedCharacter ? "complete" : "draft",
        placeholder: characters.length === 0,
      };
    }

    if (section.key === "storyboards") {
      return {
        key: section.key,
        state: shots.length === 0 ? "blocked" : hasStoryboardImage ? "complete" : "generating",
        placeholder: shots.length === 0 || !hasStoryboardImage,
      };
    }

    if (section.key === "clips") {
      return {
        key: section.key,
        state: shots.length === 0 ? "blocked" : hasClip ? "complete" : "generating",
        placeholder: shots.length === 0 || !hasClip,
      };
    }

    return {
      key: section.key,
      state: videoUrl ? "complete" : "blocked",
      placeholder: !videoUrl,
    };
  });
}

// 计算剧本区域高度 - 显示故事原文 + 摘要
function calculateScriptHeight(
  story: string | null,
  summary: string | null,
  _characters: Character[],
  _shots: Shot[]
): number {
  let height = 80; // 标题栏 + padding

  const text = story || summary || "";
  if (text) {
    // 中英文混合取 30 字符/行，text-sm leading-relaxed ≈ 22px/行
    const lines = Math.ceil(text.length / 30);
    height += 20 + lines * 22 + 32;
  }

  return Math.max(height, 200);
}

// 计算角色区域高度
function calculateCharacterHeight(characters: Character[]): number {
  if (characters.length === 0) return 250;
  const rows = Math.ceil(characters.length / 2);
  return 70 + rows * 360 + 16;
}

// 计算分镜区域高度 - 固定行高 260px + gap 12px
function calculateStoryboardHeight(shots: Shot[]): number {
  if (shots.length === 0) return 250;
  const rows = Math.ceil(shots.length / 4);
  return 80 + rows * 272 + 16; // header + rows*(260+12) + padding
}

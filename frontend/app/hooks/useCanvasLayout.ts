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
        summary,
        characters,
        shots,
        videoUrl,
      }),
    [workspaceStatus, summary, characters, shots, videoUrl]
  );

  const shapes = useMemo(() => {
    const result: TLShapePartial[] = [];
    let currentY = config.startY;

    // 计算各区域高度
    const scriptHeight = calculateScriptHeight(summary, characters, shots);
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

    CANONICAL_SECTIONS.forEach((section, index) => {
      const status = sectionStatuses[index];
      const width = sectionWidths[section.key];
      const height = sectionHeights[section.key];
      const x =
        section.key === "final-output"
          ? config.startX + (config.sectionWidth - width) / 2
          : config.startX;

      result.push({
        id: `shape:${section.key}` as any,
        type: sectionShapeTypes[section.key] as (typeof SHAPE_TYPES)[keyof typeof SHAPE_TYPES],
        x,
        y: currentY,
        props: {
          w: width,
          h: height,
          ...contentBySection[section.key],
          sectionState: status.state,
          placeholder: status.placeholder,
          statusLabel: getWorkspaceSectionStatusLabel(status.state),
          placeholderText: getWorkspaceSectionPlaceholderText(section.key),
        },
      } as TLShapePartial);

      if (index > 0) {
        const previousSection = CANONICAL_SECTIONS[index - 1];
        result.push({
          id: `shape:connector-${index}` as any,
          type: SHAPE_TYPES.CONNECTOR,
          x: 0,
          y: 0,
          props: {
            fromId: `shape:${previousSection.key}`,
            toId: `shape:${section.key}`,
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
  summary: string | null;
  characters: Character[];
  shots: Shot[];
  videoUrl: string | null;
}): Array<{ key: WorkspaceSectionKey; state: WorkspaceSectionState; placeholder: boolean }> {
  const { summary, characters, shots, videoUrl } = input;
  const hasSummary = Boolean(summary);
  const hasApprovedCharacter = characters.some((character) => character.approval_state === "approved");
  const hasStoryboardImage = shots.some((shot) => Boolean(shot.image_url));
  const hasClip = shots.some((shot) => Boolean(shot.video_url));

  return CANONICAL_SECTIONS.map((section) => {
    if (section.key === "script") {
      return {
        key: section.key,
        state: hasSummary || characters.length > 0 || shots.length > 0 ? "generating" : "draft",
        placeholder: !hasSummary && characters.length === 0 && shots.length === 0,
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

// 计算剧本区域高度 - 宽松估算确保内容完全显示
function calculateScriptHeight(
  summary: string | null,
  characters: Character[],
  shots: Shot[]
): number {
  let height = 80; // 标题栏 + padding

  if (summary) {
    // 摘要：每80字符约一行，行高24px
    const summaryLines = Math.ceil(summary.length / 60) + 1;
    height += 40 + summaryLines * 24 + 24;
  }

  if (characters.length > 0) {
    const charRows = Math.ceil(characters.length / 2);
    // 脚本区角色卡包含完整描述（personality_traits/goals/fears等），每行约 160px
    height += 36 + charRows * 160 + 24;
  }

  if (shots.length > 0) {
    // 每条分镜描述约 50px（含多行文本）
    height += 36 + shots.length * 50 + 24;
  }

  return Math.max(height, 250);
}

// 计算角色区域高度 - 包含图片和描述
function calculateCharacterHeight(characters: Character[]): number {
  if (characters.length === 0) return 250;
  const rows = Math.ceil(characters.length / 2);
  // 每行: 描述文本 ~120px + 图片 192px + padding/gap = ~340px
  return 90 + rows * 360 + 24;
}

// 计算分镜区域高度
function calculateStoryboardHeight(shots: Shot[]): number {
  if (shots.length === 0) return 250;
  const rows = Math.ceil(shots.length / 4);
  // 每行: 序号+图片(96px)+描述+padding = ~200px
  return 90 + rows * 200 + 24;
}

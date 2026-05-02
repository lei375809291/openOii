import type { Character, Project, RecoverySummaryRead, Shot } from "~/types";
import { getWorkflowStageUnlockRank } from "~/utils/workflowStage";

export type WorkspaceSectionKey =
  | "script"
  | "characters"
  | "storyboards"
  | "clips"
  | "final-output";

export type WorkspaceSectionState =
  | "draft"
  | "generating"
  | "blocked"
  | "failed"
  | "complete"
  | "superseded"
  | "waiting-for-review";

export interface WorkspaceSectionStatus {
  key: WorkspaceSectionKey;
  title: string;
  state: WorkspaceSectionState;
  placeholder: boolean;
}

export interface WorkspaceProjectionInput {
  project: Project;
  currentStage: string;
  runState: string;
  characters: Character[];
  shots: Shot[];
  recoverySummary?: RecoverySummaryRead | null;
  videoProviderValid?: boolean | null;
}

export interface WorkspaceStatus {
  stageLabel: WorkspaceSectionState;
  sections: WorkspaceSectionStatus[];
}

export function deriveWorkspaceRunState(input: {
  projectStatus?: string | null;
  isGenerating?: boolean;
  awaitingConfirm?: boolean;
  currentRunId?: number | null;
}): string {
  const { projectStatus, isGenerating = false, awaitingConfirm = false, currentRunId = null } = input;

  if (projectStatus === "failed") {
    return "failed";
  }

  if (awaitingConfirm) {
    return "awaiting_confirm";
  }

  if (isGenerating) {
    return "running";
  }

  if (currentRunId) {
    return "blocked";
  }

  if (projectStatus === "ready" || projectStatus === "completed") {
    return "completed";
  }

  return "draft";
}

export interface WorkspaceFinalOutputMeta {
  sectionState: WorkspaceSectionState;
  statusLabel: string;
  provenanceText: string;
  blockingText: string;
  downloadUrl: string;
  previewLabel: string;
  downloadLabel: string;
  retryLabel: string;
  retryFeedback: string;
  retryRunId: number | null;
  retryThreadId: string | null;
}

export const CANONICAL_SECTIONS: Array<Pick<WorkspaceSectionStatus, "key" | "title">> = [
  { key: "script", title: "剧本" },
  { key: "characters", title: "角色" },
  { key: "storyboards", title: "分镜" },
  { key: "clips", title: "片段" },
  { key: "final-output", title: "最终输出" },
];

const SECTION_STATUS_LABELS: Record<WorkspaceSectionState, string> = {
  draft: "待生成",
  generating: "生成中",
  blocked: "待生成",
  failed: "生成失败",
  complete: "已完成",
  superseded: "已失效",
  "waiting-for-review": "待审核",
};

const SECTION_PLACEHOLDERS: Record<WorkspaceSectionKey, string> = {
  script: "等待剧本生成...",
  characters: "等待角色图生成...",
  storyboards: "等待分镜图生成...",
  clips: "等待片段生成...",
  "final-output": "等待最终输出...",
};

const SECTION_STAGE_ORDER: Record<WorkspaceSectionKey, number> = {
  script: 0,
  characters: 2,
  storyboards: 3,
  clips: 4,
  "final-output": 5,
};

function getPreservedUnlockRank(recoverySummary?: RecoverySummaryRead | null) {
  if (!recoverySummary?.preserved_stages?.length) {
    return -1;
  }

  return recoverySummary.preserved_stages.reduce((maxRank, stage) => {
    return Math.max(maxRank, getWorkflowStageUnlockRank(stage));
  }, -1);
}

function getEffectiveUnlockRank(input: Pick<WorkspaceProjectionInput, "currentStage" | "recoverySummary">) {
  return Math.max(
    getWorkflowStageUnlockRank(input.currentStage),
    getPreservedUnlockRank(input.recoverySummary)
  );
}

function isAtOrPastStage(input: WorkspaceProjectionInput, targetStage: number) {
  return getEffectiveUnlockRank(input) >= targetStage;
}

function hasApprovedContent(characters: Character[]) {
  return characters.some((character) => character.approval_state === "approved");
}

function hasStoryboardContent(shots: Shot[]) {
  return shots.some((shot) => Boolean(shot.image_url));
}

function hasClipContent(shots: Shot[]) {
  return shots.some((shot) => Boolean(shot.video_url));
}

function resolveSectionState(input: WorkspaceProjectionInput, key: WorkspaceSectionKey): WorkspaceSectionState {
  const { project, runState, characters, shots } = input;

  if (project.status === "failed" || runState === "failed") {
    return "failed";
  }

  if (runState === "awaiting_confirm") {
    return "waiting-for-review";
  }

	if (runState === "blocked") {
		return "blocked";
	}

	if (key === "script") {
		if (!project.summary) {
			return "draft";
		}

    return isAtOrPastStage(input, SECTION_STAGE_ORDER[key]) ? "generating" : "draft";
  }

  if (key === "characters") {
    if (characters.length === 0) {
      return "blocked";
    }

    if (isAtOrPastStage(input, SECTION_STAGE_ORDER[key])) {
      return hasApprovedContent(characters) ? "complete" : "draft";
    }

    return "draft";
  }

  if (key === "storyboards") {
    if (shots.length === 0) {
      return "blocked";
    }

    if (isAtOrPastStage(input, SECTION_STAGE_ORDER[key])) {
      return hasStoryboardContent(shots) ? "complete" : "generating";
    }

    return "draft";
  }

  if (key === "clips") {
    if (shots.length === 0) {
      return "blocked";
    }

    if (isAtOrPastStage(input, SECTION_STAGE_ORDER[key])) {
      return hasClipContent(shots) ? "complete" : "generating";
    }

    return "draft";
  }

	if (project.status === "superseded") {
		return "superseded";
	}

	if (key === "final-output") {
		if (project.video_url) {
			return "complete";
		}

		if (input.videoProviderValid === false) {
			return "blocked";
		}

		if (isAtOrPastStage(input, SECTION_STAGE_ORDER[key])) {
			return runState === "running" ? "generating" : "draft";
		}

		return "blocked";
	}

  if (project.video_url) {
    return "complete";
  }

  if (isAtOrPastStage(input, SECTION_STAGE_ORDER[key])) {
    return runState === "running" ? "generating" : "draft";
  }

  return "blocked";
}

export function toCreatorStageLabel(input: {
  runState: string;
  artifactState?: string | null;
}): WorkspaceSectionState {
  if (input.artifactState === "superseded") {
    return "superseded";
  }

  if (input.runState === "awaiting_confirm") {
    return "waiting-for-review";
  }

  if (input.runState === "blocked") {
    return "blocked";
  }

  if (input.runState === "running") {
    return "generating";
  }

  if (input.runState === "failed") {
    return "failed";
  }

  if (input.runState === "completed") {
    return "complete";
  }

  return "draft";
}

export function buildWorkspaceStatus(input: WorkspaceProjectionInput): WorkspaceStatus {
  const effectiveUnlockRank = getEffectiveUnlockRank(input);
  const sections = CANONICAL_SECTIONS.filter((section) =>
    isSectionVisible(effectiveUnlockRank, section.key, input)
  ).map((section) => {
    const state = resolveSectionState(input, section.key);
    const placeholder =
      (section.key === "script" && !input.project.summary) ||
      (section.key === "characters" && input.characters.length === 0) ||
      (section.key === "storyboards" && !hasStoryboardContent(input.shots)) ||
      (section.key === "clips" && !hasClipContent(input.shots)) ||
      (section.key === "final-output" && !input.project.video_url);

    return {
      ...section,
      state,
      placeholder,
    };
  });

  return {
    stageLabel: toCreatorStageLabel({
      runState: input.runState,
      artifactState: input.project.status === "superseded" ? "superseded" : null,
    }),
    sections,
  };
}

function isSectionVisible(
  effectiveUnlockRank: number,
  key: WorkspaceSectionKey,
  input?: WorkspaceProjectionInput,
) {
  if (key === "script") {
    return true;
  }

  if (input) {
    if (key === "characters" && input.characters.length > 0) {
      return true;
    }

    if (key === "storyboards" && input.shots.length > 0) {
      return true;
    }

    if (key === "clips") {
      // clips section hidden — video clips are visible within storyboard shot cards
      return false;
    }

    if (key === "final-output" && input.project.video_url) {
      return true;
    }
  }

  return effectiveUnlockRank >= SECTION_STAGE_ORDER[key];
}

export function getWorkspaceSectionStatusLabel(state: WorkspaceSectionState | string) {
  return SECTION_STATUS_LABELS[state as WorkspaceSectionState] ?? "待生成";
}

export function getWorkspaceSectionStatusBadgeClass(state: WorkspaceSectionState | string) {
  if (state === "complete") {
    return "badge-success";
  }

  if (state === "generating") {
    return "badge-warning";
  }

  if (state === "failed" || state === "superseded") {
    return "badge-error";
  }

  if (state === "waiting-for-review") {
    return "badge-info";
  }

  return "badge-ghost";
}

export function getWorkspaceSectionPlaceholderText(key: WorkspaceSectionKey) {
  return SECTION_PLACEHOLDERS[key];
}

export function getProjectFinalVideoDownloadUrl(projectId: number) {
  return `/api/v1/projects/${projectId}/final-video`;
}

export function getWorkspaceFinalOutputMeta(
  input: WorkspaceProjectionInput
): WorkspaceFinalOutputMeta {
  const sectionState = resolveSectionState(input, "final-output");
  const runId = input.recoverySummary?.run_id ?? null;
  const threadId = input.recoverySummary?.thread_id ?? null;
  const videoProviderValid = input.videoProviderValid ?? null;

  return {
    sectionState,
    statusLabel: getWorkspaceSectionStatusLabel(sectionState),
    provenanceText: getFinalOutputProvenanceText(sectionState, videoProviderValid),
    blockingText: getFinalOutputBlockingText({
      sectionState,
      videoProviderValid,
    }),
    downloadUrl: getProjectFinalVideoDownloadUrl(input.project.id),
    previewLabel: "预览最终视频",
    downloadLabel: "下载最终视频",
    retryLabel: "重试合成",
    retryFeedback: buildFinalOutputRetryFeedback({
      sectionState,
      runId,
      threadId,
      currentStage: input.currentStage,
      videoProviderValid,
    }),
    retryRunId: runId,
    retryThreadId: threadId,
  };
}

function getFinalOutputProvenanceText(
  state: WorkspaceSectionState,
  videoProviderValid?: boolean | null,
) {
  if (state === "superseded") {
    return "来源：上一次合成结果，已被新版本替代";
  }

  if (state === "complete") {
    return "来源：当前成片";
  }

  if (state === "failed") {
    return "来源：合成失败，需要重试";
  }

  if (state === "blocked" && videoProviderValid === false) {
    return "来源：本次运行视频 provider 无效，clip 与 merge 已自动跳过";
  }

  if (state === "blocked") {
    return "来源：等待分镜片段完成后生成最终视频";
  }

  return "来源：等待分镜片段完成后生成最终视频";
}

function getFinalOutputBlockingText(input: {
  sectionState: WorkspaceSectionState;
  videoProviderValid?: boolean | null;
}) {
  const { sectionState, videoProviderValid } = input;

  if (sectionState === "blocked") {
    if (videoProviderValid === false) {
      return "本次运行的视频 provider 无效，已跳过 clip 与 merge 阶段。请先配置可用视频 provider 后重试。";
    }

    return "当前仍在等待分镜片段完成，完成后会自动生成最终视频。";
  }

  if (sectionState === "superseded") {
    return "当前成片已失效，但仍可预览和下载历史版本。";
  }

  return "";
}

function buildFinalOutputRetryFeedback(input: {
  sectionState: WorkspaceSectionState;
  runId: number | null;
  threadId: string | null;
  currentStage: string;
  videoProviderValid?: boolean | null;
}) {
  const { sectionState, runId, threadId, currentStage, videoProviderValid } = input;

  if (sectionState === "blocked" && videoProviderValid === false) {
    return `视频 provider 无效，当前运行已自动跳过 clip/merge。请先在项目中修复视频 provider 后重试。`;
  }

  if (sectionState === "blocked") {
    return `最终视频仍在等待分镜片段完成，请在 ${currentStage} 之后继续合成。`;
  }

  const contextParts = [
    threadId ? `thread ${threadId}` : null,
    runId ? `run ${runId}` : null,
  ].filter((part): part is string => Boolean(part));

  if (contextParts.length === 0) {
    return "请基于当前最终视频重新合成，保留现有镜头与审批上下文。";
  }

  return `请基于当前最终视频重新合成，沿用 ${contextParts.join(" / ")} 的上下文。`;
}

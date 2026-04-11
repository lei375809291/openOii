import type { Character, Project, RecoverySummaryRead, Shot } from "~/types";

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
}

export interface WorkspaceStatus {
  stageLabel: WorkspaceSectionState;
  sections: WorkspaceSectionStatus[];
}

const CANONICAL_SECTIONS: Array<Pick<WorkspaceSectionStatus, "key" | "title">> = [
  { key: "script", title: "剧本" },
  { key: "characters", title: "角色" },
  { key: "storyboards", title: "分镜" },
  { key: "clips", title: "片段" },
  { key: "final-output", title: "最终输出" },
];

const STAGE_ORDER: Record<string, number> = {
  ideate: 0,
  visualize: 1,
  animate: 2,
  deploy: 3,
};

const SECTION_STAGE_ORDER: Record<WorkspaceSectionKey, number> = {
  script: 0,
  characters: 1,
  storyboards: 1,
  clips: 2,
  "final-output": 3,
};

function isAtOrPastStage(currentStage: string, targetStage: number) {
  const currentOrder = STAGE_ORDER[currentStage] ?? -1;
  return currentOrder >= targetStage;
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
  const { project, currentStage, runState, characters, shots } = input;

  if (project.status === "failed" || runState === "failed") {
    return "failed";
  }

  if (runState === "awaiting_confirm") {
    return "waiting-for-review";
  }

  if (runState === "blocked") {
    return "blocked";
  }

  if (project.video_url && key === "final-output") {
    return "complete";
  }

  if (key === "script") {
    if (!project.summary) {
      return "draft";
    }

    return isAtOrPastStage(currentStage, SECTION_STAGE_ORDER[key]) ? "generating" : "draft";
  }

  if (key === "characters") {
    if (characters.length === 0) {
      return "blocked";
    }

    if (isAtOrPastStage(currentStage, SECTION_STAGE_ORDER[key])) {
      return hasApprovedContent(characters) ? "complete" : "draft";
    }

    return "draft";
  }

  if (key === "storyboards") {
    if (shots.length === 0) {
      return "blocked";
    }

    if (isAtOrPastStage(currentStage, SECTION_STAGE_ORDER[key])) {
      return hasStoryboardContent(shots) ? "complete" : "generating";
    }

    return "draft";
  }

  if (key === "clips") {
    if (shots.length === 0) {
      return "blocked";
    }

    if (isAtOrPastStage(currentStage, SECTION_STAGE_ORDER[key])) {
      return hasClipContent(shots) ? "complete" : "generating";
    }

    return "draft";
  }

  if (project.video_url) {
    return "complete";
  }

  if (isAtOrPastStage(currentStage, SECTION_STAGE_ORDER[key])) {
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
  const sections = CANONICAL_SECTIONS.map((section) => {
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

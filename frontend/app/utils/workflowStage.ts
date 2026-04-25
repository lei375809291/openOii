import type { WorkflowStage } from "~/types";

export const WORKFLOW_STAGE_SEQUENCE: WorkflowStage[] = [
  "ideate",
  "ideate_approval",
  "script",
  "script_approval",
  "character",
  "character_approval",
  "storyboard",
  "storyboard_approval",
  "clip",
  "clip_approval",
  "merge",
  "review",
];

const WORKFLOW_STAGE_SET = new Set<WorkflowStage>(WORKFLOW_STAGE_SEQUENCE);

const WORKFLOW_STAGE_UNLOCK_RANK: Record<WorkflowStage, number> = {
  ideate: 0,
  ideate_approval: 0,
  script: 1,
  script_approval: 1,
  character: 2,
  character_approval: 2,
  storyboard: 3,
  storyboard_approval: 3,
  clip: 4,
  clip_approval: 4,
  merge: 5,
  review: -1,
};

export function isWorkflowStage(value: unknown): value is WorkflowStage {
  return typeof value === "string" && WORKFLOW_STAGE_SET.has(value as WorkflowStage);
}

export function getWorkflowStageUnlockRank(stage: string | null | undefined): number {
  if (!isWorkflowStage(stage)) {
    return -1;
  }

  return WORKFLOW_STAGE_UNLOCK_RANK[stage];
}

export function getWorkflowStageInfo(stage: WorkflowStage): {
  title: string;
  description: string;
} {
  switch (stage) {
    case "ideate":
    case "ideate_approval":
      return {
        title: "构思阶段",
        description: "正在整理故事方向与创作设定",
      };
    case "script":
    case "script_approval":
      return {
        title: "剧本阶段",
        description: "正在撰写剧本、角色设定与镜头描述",
      };
    case "character":
    case "character_approval":
      return {
        title: "角色阶段",
        description: "正在生成角色形象并等待确认",
      };
    case "storyboard":
    case "storyboard_approval":
      return {
        title: "分镜阶段",
        description: "正在绘制分镜画面并等待确认",
      };
    case "clip":
    case "clip_approval":
      return {
        title: "片段阶段",
        description: "正在生成视频片段并等待确认",
      };
    case "merge":
      return {
        title: "合成阶段",
        description: "正在拼接最终视频",
      };
    case "review":
      return {
        title: "反馈修订",
        description: "正在根据反馈决定从哪个阶段继续",
      };
  }
}

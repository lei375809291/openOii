import type { WorkflowStage } from "~/types";

export const WORKFLOW_STAGE_SEQUENCE: WorkflowStage[] = [
  "plan",
  "plan_approval",
  "character",
  "character_approval",
  "shot",
  "shot_approval",
  "compose",
  "review",
];

const WORKFLOW_STAGE_SET = new Set<WorkflowStage>(WORKFLOW_STAGE_SEQUENCE);

const WORKFLOW_STAGE_UNLOCK_RANK: Record<WorkflowStage, number> = {
  plan: 0,
  plan_approval: 0,
  character: 1,
  character_approval: 1,
  shot: 2,
  shot_approval: 2,
  compose: 3,
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
    case "plan":
    case "plan_approval":
      return {
        title: "规划阶段",
        description: "正在生成剧本、角色与镜头规划",
      };
    case "character":
    case "character_approval":
      return {
        title: "角色渲染阶段",
        description: "正在生成角色形象图",
      };
    case "shot":
    case "shot_approval":
      return {
        title: "分镜渲染阶段",
        description: "正在使用角色参考图生成分镜首帧图",
      };
    case "compose":
      return {
        title: "合成阶段",
        description: "正在生成视频片段并合成最终视频",
      };
    case "review":
      return {
        title: "反馈修订",
        description: "正在根据反馈决定从哪个阶段继续",
      };
  }
}

export const STAGE_PIPELINE = [
  { key: "plan", label: "规划", icon: "bulb" as const },
  { key: "character", label: "角色", icon: "user" as const },
  { key: "shot", label: "分镜", icon: "film" as const },
  { key: "compose", label: "合成", icon: "cube" as const },
] as const;

export type PipelineStageKey = (typeof STAGE_PIPELINE)[number]["key"];

const APPROVAL_STAGE_MAP: Record<string, string> = {
  plan_approval: "plan",
  character_approval: "character",
  shot_approval: "shot",
};

export function getPipelineStageIndex(stage: string): number {
  const mappedStage = APPROVAL_STAGE_MAP[stage] ?? stage;
  return STAGE_PIPELINE.findIndex((s) => s.key === mappedStage);
}

export function isPipelineStage(stage: string): stage is PipelineStageKey {
  return STAGE_PIPELINE.some((s) => s.key === stage);
}

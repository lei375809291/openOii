export const STAGE_PIPELINE = [
  { key: "plan", label: "规划", icon: "bulb" as const },
  { key: "render", label: "渲染", icon: "film" as const },
  { key: "compose", label: "合成", icon: "cube" as const },
] as const;

export type PipelineStageKey = (typeof STAGE_PIPELINE)[number]["key"];

export function getPipelineStageIndex(stage: string): number {
  return STAGE_PIPELINE.findIndex((s) => s.key === stage);
}

export function isPipelineStage(stage: string): stage is PipelineStageKey {
  return STAGE_PIPELINE.some((s) => s.key === stage);
}

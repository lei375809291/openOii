export const STAGE_PIPELINE = [
  { key: "ideate", label: "构思", icon: "bulb" as const },
  { key: "script", label: "剧本", icon: "document" as const },
  { key: "character", label: "角色", icon: "user" as const },
  { key: "storyboard", label: "分镜", icon: "film" as const },
  { key: "animate", label: "动画", icon: "sparkle" as const },
  { key: "merge", label: "合成", icon: "cube" as const },
] as const;

export type PipelineStageKey = (typeof STAGE_PIPELINE)[number]["key"];

export function getPipelineStageIndex(stage: string): number {
  return STAGE_PIPELINE.findIndex((s) => s.key === stage);
}

export function isPipelineStage(stage: string): stage is PipelineStageKey {
  return STAGE_PIPELINE.some((s) => s.key === stage);
}

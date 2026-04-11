import { Canvas } from "~/components/canvas/Canvas";

interface StageViewProps {
  projectId: number;
}

export function StageView({ projectId }: StageViewProps) {
  return <Canvas projectId={projectId} />;
}

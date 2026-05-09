import { InfiniteCanvas } from "~/components/canvas/InfiniteCanvas";

interface StageViewProps {
  projectId: number;
}

export function StageView({ projectId }: StageViewProps) {
  return <InfiniteCanvas projectId={projectId} />;
}

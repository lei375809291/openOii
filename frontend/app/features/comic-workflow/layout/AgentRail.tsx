import { clsx } from "clsx";
import type { WorkbenchStatus } from "~/features/comic-workflow/state/deriveWorkbenchStatus";
import type { ComicWorkflowNode } from "~/features/comic-workflow/graph/types";
import type { WorkflowStage } from "~/types";
import { STAGE_PIPELINE } from "~/utils/pipeline";
import { SvgIcon } from "~/components/ui/SvgIcon";

interface AgentRailProps {
	currentStage: WorkflowStage;
	workbenchStatus: WorkbenchStatus;
	isGenerating: boolean;
	progress: number;
	selectedNode: ComicWorkflowNode | null;
	messageCount: number;
	characterCount: number;
	shotCount: number;
	onFocusChat: () => void;
	onFocusInspector: () => void;
	collapsed?: boolean;
	onToggleCollapse?: () => void;
}

const STAGE_HINT: Record<string, string> = {
	plan: "编剧 / 大纲",
	render: "角色与分镜绘制",
	compose: "视频合成",
};

function stageLabel(stage: WorkflowStage): string {
	const mapped = stage.replace(/_approval$/, "").split("_")[0] ?? stage;
	const entry = STAGE_PIPELINE.find((item) => item.key === mapped);
	return entry?.label ?? stage;
}

export function AgentRail({
	currentStage,
	workbenchStatus,
	isGenerating,
	progress,
	selectedNode,
	messageCount,
	characterCount,
	shotCount,
	onFocusChat,
	onFocusInspector,
	collapsed = false,
	onToggleCollapse,
}: AgentRailProps) {
	const progressPercent = Math.max(0, Math.min(100, Math.round(progress * 100)));
	const selectionTitle =
		selectedNode?.title ??
		(selectedNode ? selectedNode.id : null);

	if (collapsed) {
		return (
			<aside
				className="flex w-12 shrink-0 flex-col items-center gap-2 border-r-2 border-base-content/10 bg-base-200/50 py-3"
				aria-label="Agent 任务轨（已收起）"
			>
				<button
					type="button"
					className="flex h-10 w-10 items-center justify-center rounded-lg text-base-content/60 hover:bg-base-100 hover:text-primary"
					onClick={onToggleCollapse}
					aria-label="展开 Agent 轨"
					title="展开 Agent 轨"
				>
					<SvgIcon name="layers" size={18} />
				</button>
				<button
					type="button"
					className="flex h-10 w-10 items-center justify-center rounded-lg text-base-content/60 hover:bg-base-100 hover:text-primary"
					onClick={onFocusChat}
					aria-label="打开对话"
					title="对话"
				>
					<SvgIcon name="book-open" size={16} />
				</button>
			</aside>
		);
	}

	return (
		<aside
			className="flex w-[13.5rem] shrink-0 flex-col border-r-2 border-base-content/10 bg-base-200/40 lg:w-60"
			aria-label="Agent 任务轨"
		>
			<div className="flex items-center justify-between gap-2 border-b border-base-content/10 px-3 py-2.5">
				<div className="min-w-0">
					<p className="m-0 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-base-content/45">
						Agent Rail
					</p>
					<h2 className="m-0 truncate font-heading text-sm font-bold">
						导演任务流
					</h2>
				</div>
				{onToggleCollapse ? (
					<button
						type="button"
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-base-content/50 hover:bg-base-100 hover:text-primary"
						onClick={onToggleCollapse}
						aria-label="收起 Agent 轨"
					>
						<SvgIcon name="chevron-right" size={14} className="rotate-180" />
					</button>
				) : null}
			</div>

			<div className="space-y-3 overflow-y-auto p-3">
				<section
					className={clsx(
						"rounded-lg border px-3 py-2.5",
						isGenerating
							? "border-warning/35 bg-warning/10"
							: "border-base-content/10 bg-base-100/80",
					)}
				>
					<p className="m-0 text-[0.65rem] font-mono uppercase tracking-wide text-base-content/50">
						当前状态
					</p>
					<p className="m-0 mt-1 text-sm font-bold">{workbenchStatus.label}</p>
					<p className="m-0 mt-0.5 text-xs leading-relaxed text-base-content/60">
						{workbenchStatus.description}
					</p>
					{isGenerating || progressPercent > 0 ? (
						<div className="mt-2">
							<div
								className="h-1.5 overflow-hidden rounded-full bg-base-content/10"
								role="progressbar"
								aria-valuenow={progressPercent}
								aria-valuemin={0}
								aria-valuemax={100}
								aria-label="阶段进度"
							>
								<div
									className="h-full rounded-full bg-primary transition-[width] duration-200"
									style={{ width: `${progressPercent}%` }}
								/>
							</div>
						</div>
					) : null}
				</section>

				<section>
					<p className="m-0 mb-1.5 text-[0.65rem] font-mono uppercase tracking-wide text-base-content/50">
						流水线
					</p>
					<ol className="m-0 list-none space-y-1 p-0">
						{STAGE_PIPELINE.map((stage, index) => {
							const mapped =
								currentStage.replace(/_approval$/, "").split("_")[0] ??
								currentStage;
							const currentIndex = STAGE_PIPELINE.findIndex(
								(item) => item.key === mapped,
							);
							const done = currentIndex >= 0 && index < currentIndex;
							const active = stage.key === mapped;
							return (
								<li
									key={stage.key}
									className={clsx(
										"flex items-center gap-2 rounded-md px-2 py-1.5 text-xs",
										active && "bg-primary/15 font-bold text-primary",
										done && !active && "text-base-content/55",
										!done && !active && "text-base-content/40",
									)}
								>
									<span
										className={clsx(
											"flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[0.6rem]",
											active && "bg-primary text-primary-content",
											done && !active && "bg-success/25 text-success",
											!done && !active && "bg-base-300 text-base-content/50",
										)}
									>
										{done ? "✓" : index + 1}
									</span>
									<span className="min-w-0 truncate">{stage.label}</span>
								</li>
							);
						})}
					</ol>
					<p className="m-0 mt-2 text-xs text-base-content/50">
						{STAGE_HINT[currentStage.replace(/_approval$/, "").split("_")[0] ?? ""] ??
							stageLabel(currentStage)}
					</p>
				</section>

				<section className="rounded-lg border border-base-content/10 bg-base-100/70 px-3 py-2.5">
					<p className="m-0 text-[0.65rem] font-mono uppercase tracking-wide text-base-content/50">
						画布资产
					</p>
					<dl className="m-0 mt-1.5 grid grid-cols-3 gap-1 text-center">
						<div>
							<dt className="sr-only">角色</dt>
							<dd className="m-0 font-mono text-sm font-bold">{characterCount}</dd>
							<span className="text-[0.65rem] text-base-content/50">角色</span>
						</div>
						<div>
							<dt className="sr-only">镜头</dt>
							<dd className="m-0 font-mono text-sm font-bold">{shotCount}</dd>
							<span className="text-[0.65rem] text-base-content/50">镜头</span>
						</div>
						<div>
							<dt className="sr-only">消息</dt>
							<dd className="m-0 font-mono text-sm font-bold">{messageCount}</dd>
							<span className="text-[0.65rem] text-base-content/50">消息</span>
						</div>
					</dl>
				</section>

				<section
					className={clsx(
						"rounded-lg border px-3 py-2.5",
						selectedNode
							? "border-accent/40 bg-accent/10"
							: "border-dashed border-base-content/15 bg-transparent",
					)}
				>
					<p className="m-0 text-[0.65rem] font-mono uppercase tracking-wide text-base-content/50">
						选中上下文
					</p>
					{selectedNode ? (
						<>
							<p className="m-0 mt-1 truncate text-sm font-bold">
								{selectionTitle}
							</p>
							<p className="m-0 mt-0.5 font-mono text-[0.65rem] text-base-content/55">
								{selectedNode.kind}
							</p>
							<button
								type="button"
								className="mt-2 w-full rounded-md bg-base-100 px-2 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-primary-content"
								onClick={onFocusInspector}
							>
								在属性中查看
							</button>
						</>
					) : (
						<p className="m-0 mt-1 text-xs leading-relaxed text-base-content/50">
							在画布点击角色、镜头或大纲节点，对话将绑定该素材。
						</p>
					)}
				</section>

				<button
					type="button"
					className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-base-content/12 bg-base-100 py-2.5 text-xs font-bold transition-colors hover:border-primary/40 hover:text-primary"
					onClick={onFocusChat}
				>
					<SvgIcon name="book-open" size={14} />
					打开 Agent 对话
				</button>
			</div>
		</aside>
	);
}

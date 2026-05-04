import {
	Cog6ToothIcon,
	ChatBubbleLeftRightIcon,
	StopIcon,
	ArrowPathIcon,
	CheckIcon,
	ExclamationTriangleIcon,
	FilmIcon,
	PlusIcon,
	ChevronDownIcon,
	MoonIcon,
	SunIcon,
	LightBulbIcon,
	SparklesIcon,
	CubeIcon,
} from "@heroicons/react/24/outline";
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "~/services/api";
import { useThemeStore } from "~/stores/themeStore";
import type { Project, WorkflowStage } from "~/types";
import { STAGE_PIPELINE, getPipelineStageIndex } from "~/utils/pipeline";
import { Button } from "~/components/ui/Button";
import { SvgIcon } from "~/components/ui/SvgIcon";

const STAGE_ICONS: Record<string, typeof LightBulbIcon> = {
	bulb: LightBulbIcon,
	sparkle: SparklesIcon,
	film: FilmIcon,
	cube: CubeIcon,
};

interface TopBarProps {
	currentStage: WorkflowStage;
	isGenerating: boolean;
	awaitingConfirm: boolean;
	hasRecovery: boolean;
	onToggleChat: () => void;
	onOpenSettings: () => void;
	onResume: () => void;
	onCancel: () => void;
	onGenerate: () => void;
	onToggleAssets: () => void;
	onToggleHistory: () => void;
	generateDisabled: boolean;
	chatOpen: boolean;
	assetsOpen: boolean;
	historyOpen: boolean;
	projectId?: number;
}

function ProjectDropdown({ currentId }: { currentId?: number }) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	const { data: projects } = useQuery({
		queryKey: ["projects"],
		queryFn: () => projectsApi.list(),
	});

	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
		}
		if (open) document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [open]);

	const list = (projects ?? []) as Project[];

	return (
		<div className="relative" ref={ref}>
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="flex items-center gap-1 text-xs font-heading font-bold max-w-[180px] hover:text-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
				aria-expanded={open}
				aria-haspopup="true"
			>
				<FilmIcon className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
				<span className="truncate">{list.find((p) => p.id === currentId)?.title || "项目"}</span>
				<ChevronDownIcon className={`w-3 h-3 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
			</button>

			{open && (
				<div className="absolute left-0 top-full mt-1 w-64 bg-base-200 border-2 border-base-content/15 rounded-lg shadow-comic z-50 py-1 max-h-80 overflow-y-auto">
					<Link
						to="/"
						onClick={() => setOpen(false)}
						className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-base-content/60 hover:bg-base-300 transition-colors"
					>
						<SparklesIcon className="w-3 h-3" />
						首页 — 所有项目
					</Link>
					<div className="border-t border-base-content/10 my-1" />
					{list.map((p) => {
						const statusMap: Record<string, { label: string; cls: string }> = {
							draft: { label: "草稿", cls: "text-base-content/30" },
							planning: { label: "规划中", cls: "text-warning" },
							ready: { label: "完成", cls: "text-success" },
							superseded: { label: "已覆盖", cls: "text-base-content/20" },
						};
						const st = statusMap[p.status] ?? { label: p.status, cls: "text-base-content/30" };
						return (
							<Link
								key={p.id}
								to={`/projects/${p.id}`}
								onClick={() => setOpen(false)}
								className={`flex items-center justify-between px-3 py-1.5 text-xs hover:bg-base-300 transition-colors group ${p.id === currentId ? "bg-primary/10 text-primary font-bold" : ""}`}
							>
								<span className="truncate flex-1">{p.title}</span>
								<span className={`text-[10px] ml-1.5 flex-shrink-0 ${st.cls}`}>{st.label}</span>
							</Link>
						);
					})}
					<div className="border-t border-base-content/10 my-1" />
					<Link
						to="/"
						onClick={() => setOpen(false)}
						className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary hover:bg-base-300 transition-colors"
					>
						<PlusIcon className="w-3 h-3" />
						新建项目
					</Link>
				</div>
			)}
		</div>
	);
}

export function TopBar({
	currentStage,
	isGenerating,
	awaitingConfirm,
	hasRecovery,
	onToggleChat,
	onOpenSettings,
	onResume,
	onCancel,
	onGenerate,
	onToggleAssets,
	onToggleHistory,
	generateDisabled,
	chatOpen,
	assetsOpen,
	historyOpen,
	projectId,
}: TopBarProps) {
	const currentIndex = getPipelineStageIndex(currentStage);
	const { theme, toggleTheme } = useThemeStore();
	const isDark = theme.endsWith("dark");

	return (
		<header className="flex-shrink-0 flex items-center h-10 px-3 bg-base-100 border-b-2 border-base-content/15 z-30 gap-3">
			<div className="flex items-center gap-2">
				<ProjectDropdown currentId={projectId} />
			</div>

			<div className="flex-1 flex items-center justify-center gap-4">
				<nav className="flex items-center" aria-label="Pipeline stages">
					{STAGE_PIPELINE.map((stage, index) => {
						const isCurrent = stage.key === currentStage;
						const isPast = index < currentIndex;
						const isGeneratingHere = isCurrent && isGenerating;
						const isAwaiting = isCurrent && awaitingConfirm;
						const isRecoveryPoint = isCurrent && hasRecovery;
						const IconComponent = STAGE_ICONS[stage.icon];

						let dotClass = "bg-base-content/20 border-base-content/20";
						if (isPast) dotClass = "bg-success border-success/50";
						if (isCurrent) dotClass = "bg-primary border-primary/50";
						if (isGeneratingHere) dotClass = "bg-warning border-warning/50 animate-pulse";
						if (isAwaiting) dotClass = "bg-info border-info/50";

						return (
							<div key={stage.key} className="flex items-center">
								<div
									className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-colors duration-150 ${
										isCurrent ? "bg-primary/10 border-2 border-primary/25" : "border-2 border-transparent"
									}`}
								>
									<div className={`w-3 h-3 rounded-full border-2 ${dotClass}`} />
									<IconComponent className={`w-3.5 h-3.5 ${isPast ? "text-success" : isCurrent ? "text-primary" : "text-base-content/25"}`} />
									<span className={`text-xs font-heading font-bold uppercase tracking-wide ${isPast ? "text-success" : isCurrent ? "text-primary" : "text-base-content/25"}`}>
										{stage.label}
									</span>
									{isPast && <CheckIcon className="w-2.5 h-2.5 text-success" />}
									{isRecoveryPoint && !isGenerating && (
										<ExclamationTriangleIcon className="w-2.5 h-2.5 text-warning" />
									)}
								</div>
								{index < STAGE_PIPELINE.length - 1 && (
									<div className={`w-5 h-[3px] mx-1 rounded-full ${index < currentIndex ? "bg-success/70" : "bg-base-content/12"}`} />
								)}
							</div>
						);
					})}
				</nav>

				{hasRecovery && !isGenerating && (
					<div className="flex items-center gap-1">
						<Button variant="primary" size="sm" className="!px-2 !py-0 !min-h-0 !h-6 text-xs gap-0.5 border-2 shadow-brutal-sm" onClick={onResume}>
							<ArrowPathIcon className="w-2.5 h-2.5" />
							恢复
						</Button>
						<Button variant="ghost" size="sm" className="!px-0.5 !py-0 !min-h-0 !h-5" onClick={onCancel}>
							<StopIcon className="w-2.5 h-2.5" />
						</Button>
					</div>
				)}
			</div>

			<div className="flex items-center gap-1">
				<Button
					variant={assetsOpen ? "primary" : "ghost"}
					size="sm"
					className="!px-1.5 !min-h-0 !h-6 gap-0.5"
					onClick={onToggleAssets}
					title="资产库"
				>
					<SvgIcon name="archive" size={14} />
					<span className="text-xs hidden sm:inline">资产</span>
				</Button>
				<Button
					variant={historyOpen ? "primary" : "ghost"}
					size="sm"
					className="!px-1.5 !min-h-0 !h-6 gap-0.5"
					onClick={onToggleHistory}
					title="对话历史"
				>
					<SvgIcon name="clock-3" size={14} />
					<span className="text-xs hidden sm:inline">历史</span>
				</Button>
				{!isGenerating && !hasRecovery && (
					<Button
						variant="primary"
						size="sm"
						onClick={onGenerate}
						disabled={generateDisabled}
						className="gap-0.5 !px-2 !py-0 !min-h-0 !h-6 text-xs border-2 shadow-brutal-sm"
					>
						<SparklesIcon className="w-2.5 h-2.5" />
						生成
					</Button>
				)}
				{isGenerating && !awaitingConfirm && (
					<Button
						variant="ghost"
						size="sm"
						onClick={onCancel}
						className="gap-0.5 !px-1.5 !py-0 !min-h-0 !h-6 text-xs text-error hover:bg-error/10"
					>
						<StopIcon className="w-2.5 h-2.5" />
						停止
					</Button>
				)}
				{awaitingConfirm && (
					<Button
						variant="secondary"
						size="sm"
						onClick={onToggleChat}
						className="gap-0.5 !px-2 !py-0 !min-h-0 !h-6 text-xs border-2 border-info text-info animate-pulse"
					>
						<ChatBubbleLeftRightIcon className="w-2.5 h-2.5" />
						待确认
					</Button>
				)}
				<Button
					variant={chatOpen ? "primary" : "ghost"}
					size="sm"
					className="!px-1"
					onClick={onToggleChat}
					title="对话面板"
				>
					<ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
				</Button>
				<button
					type="button"
					onClick={toggleTheme}
					className="btn btn-ghost btn-xs !px-1 !min-h-0 !h-6"
					aria-label={isDark ? "切换亮色" : "切换暗色"}
					title={isDark ? "切换亮色" : "切换暗色"}
				>
					{isDark ? <SunIcon className="w-3.5 h-3.5" /> : <MoonIcon className="w-3.5 h-3.5" />}
				</button>
				<Button
					variant="ghost"
					size="sm"
					className="!px-1"
					onClick={onOpenSettings}
					title="设置"
				>
					<Cog6ToothIcon className="w-3.5 h-3.5" />
				</Button>
			</div>
		</header>
	);
}

import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { GlobeAltIcon } from "@heroicons/react/24/outline";
import { universesApi } from "~/services/api";

interface UniverseTimelinePanelProps {
	universeId: number;
	currentProjectId: number;
}

export function UniverseTimelinePanel({
	universeId,
	currentProjectId,
}: UniverseTimelinePanelProps) {
	const { data, isLoading, isError } = useQuery({
		queryKey: ["universe-timeline", universeId, currentProjectId],
		queryFn: () => universesApi.timeline(universeId, currentProjectId),
		staleTime: 15_000,
	});

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center p-3">
				<span className="loading loading-spinner loading-sm text-primary" />
			</div>
		);
	}

	if (isError || !data) {
		return (
			<div className="p-3 text-[length:var(--text-xs)] text-base-content/50">
				无法加载宇宙时间线
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col" data-shell="universe-timeline">
			<div className="shrink-0 border-b border-base-content/10 px-2 py-1.5">
				<div className="flex items-center gap-1.5">
					<GlobeAltIcon className="h-3.5 w-3.5 text-primary" />
					<h3 className="m-0 truncate font-heading text-[length:var(--text-sm)] font-bold">
						{data.universe_name}
					</h3>
				</div>
				<p className="m-0 mt-0.5 text-[length:var(--text-2xs)] text-base-content/50">
					跨章节时间线 · {data.shared_character_count} 共享角色
				</p>
				{data.world_setting ? (
					<p className="m-0 mt-1 line-clamp-2 text-[length:var(--text-2xs)] text-base-content/60">
						{data.world_setting}
					</p>
				) : null}
			</div>

			<ul className="m-0 min-h-0 flex-1 list-none space-y-1 overflow-y-auto overscroll-contain p-2">
				{data.chapters.map((ch) => (
					<li key={ch.project_id}>
						<Link
							to={`/project/${ch.project_id}`}
							className={`block rounded-[var(--radius-md)] border px-2 py-1.5 transition-colors ${
								ch.is_current
									? "border-primary/40 bg-primary/10"
									: "border-base-content/10 bg-base-200/40 hover:border-primary/30"
							}`}
						>
							<div className="flex items-center justify-between gap-1">
								<span className="font-mono text-[length:var(--text-2xs)] font-bold text-primary">
									第{ch.chapter_number ?? "?"}章
									{ch.is_current ? " · 当前" : ""}
								</span>
								<span className="font-mono text-[length:var(--text-2xs)] text-base-content/40">
									{ch.shot_count}格 · {ch.character_count}角
									{ch.has_video ? " · 成片" : ""}
								</span>
							</div>
							<p className="m-0 mt-0.5 truncate font-heading text-[length:var(--text-xs)] font-bold">
								{ch.chapter_title || ch.title}
							</p>
							{ch.summary ? (
								<p className="m-0 mt-0.5 line-clamp-2 text-[length:var(--text-2xs)] text-base-content/55">
									{ch.summary}
								</p>
							) : (
								<p className="m-0 mt-0.5 text-[length:var(--text-2xs)] text-base-content/35">
									{ch.status}
								</p>
							)}
						</Link>
					</li>
				))}
			</ul>

			<div className="shrink-0 border-t border-base-content/10 p-2">
				<Link
					to={`/universes/${universeId}`}
					className="btn btn-ghost btn-xs h-7 min-h-7 w-full"
				>
					打开宇宙管理
				</Link>
			</div>
		</div>
	);
}

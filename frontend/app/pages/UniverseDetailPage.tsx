import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { universesApi } from "~/services/api";
import { SharedCharacterCard } from "~/components/universe/SharedCharacterCard";
import { Card } from "~/components/ui/Card";
import {
	PlusIcon,
	BookOpenIcon,
	TrashIcon,
	GlobeAltIcon,
	PaintBrushIcon,
	UserGroupIcon,
} from "@heroicons/react/24/outline";
import { toast } from "~/utils/toast";
import type { UniverseDetail } from "~/types";
import { PageBody, PageShell } from "~/components/layout/PageShell";

export function UniverseDetailPage() {
	const { universeId } = useParams<{ universeId: string }>();
	const queryClient = useQueryClient();
	const id = Number(universeId);

	const { data: universe, isLoading } = useQuery({
		queryKey: ["universe", id],
		queryFn: () => universesApi.get(id),
		enabled: !isNaN(id),
	});

	const removeProjectMutation = useMutation({
		mutationFn: (projectId: number) =>
			universesApi.removeProject(id, projectId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["universe", id] });
			queryClient.invalidateQueries({ queryKey: ["universes"] });
			toast.success({ title: "已移除", message: "项目已从宇宙移除" });
		},
	});

	if (isLoading) {
		return (
			<PageShell className="items-center justify-center">
				<span className="loading loading-spinner loading-lg text-primary" />
			</PageShell>
		);
	}

	if (!universe) {
		return (
			<PageShell className="items-center justify-center">
				<p className="text-base-content/50">宇宙不存在</p>
			</PageShell>
		);
	}

	const u = universe as UniverseDetail;
	const nextChapterNumber =
		u.chapters.length > 0
			? Math.max(...u.chapters.map((chapter) => chapter.chapter_number ?? 0)) + 1
			: 1;
	const createChapterHref = `/?universeId=${u.id}&chapterNumber=${nextChapterNumber}`;

	return (
		<PageShell data-shell="universe-detail">
			<header className="chrome-row z-[var(--z-fixed)] gap-2 border-b border-base-content/12 bg-base-200 px-2 sm:px-3">
				<div className="flex-1">
					<Link
						to="/universes"
						className="btn btn-ghost btn-sm touch-target-dense h-8 min-h-8"
					>
						← 返回宇宙列表
					</Link>
				</div>
				<div className="flex flex-1 justify-end">
					<Link
						to={createChapterHref}
						className="btn-doodle touch-target-dense inline-flex h-8 min-h-8 items-center gap-1 bg-primary px-2 text-[length:var(--text-2xs)] font-heading text-primary-content"
					>
						<PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
						新建章节
					</Link>
				</div>
			</header>

			<PageBody className="mx-auto w-full max-w-6xl space-y-[var(--space-3)] px-[var(--space-3)] py-[var(--space-3)] sm:px-[var(--space-4)]">
				<div>
					<h1 className="m-0 font-heading text-[length:var(--text-xl)] font-bold leading-tight text-pretty">
						{u.name}
					</h1>
					{u.description ? (
						<p className="m-0 mt-1 text-[length:var(--text-sm)] text-base-content/60">
							{u.description}
						</p>
					) : null}
				</div>

				{u.world_setting ? (
					<Card className="!p-3" variant="primary">
						<h2 className="mb-1 flex items-center gap-1.5 font-heading text-[length:var(--text-md)] font-bold">
							<GlobeAltIcon className="h-4 w-4" aria-hidden="true" />
							世界观设定
						</h2>
						<p className="m-0 whitespace-pre-wrap text-[length:var(--text-sm)] text-base-content/70">
							{u.world_setting}
						</p>
					</Card>
				) : null}

				{u.style_rules ? (
					<Card className="!p-3" variant="accent">
						<h2 className="mb-1 flex items-center gap-1.5 font-heading text-[length:var(--text-md)] font-bold">
							<PaintBrushIcon className="h-4 w-4" aria-hidden="true" />
							统一风格规则
						</h2>
						<p className="m-0 whitespace-pre-wrap text-[length:var(--text-sm)] text-base-content/70">
							{u.style_rules}
						</p>
					</Card>
				) : null}

				<Card className="!p-3">
					<div className="mb-2 flex items-center justify-between gap-2">
						<h2 className="m-0 flex items-center gap-1.5 font-heading text-[length:var(--text-md)] font-bold">
							<BookOpenIcon className="h-4 w-4" aria-hidden="true" />
							章节列表
						</h2>
						<span className="font-mono text-[length:var(--text-2xs)] tabular-nums text-base-content/40">
							{u.chapters.length} 章
						</span>
					</div>

					{u.chapters.length === 0 ? (
						<p className="py-6 text-center text-[length:var(--text-sm)] text-base-content/40">
							还没有章节，从顶栏新建第一个工作区
						</p>
					) : (
						<div className="space-y-1">
							{[...u.chapters]
								.sort(
									(a, b) =>
										(a.chapter_number ?? 999) - (b.chapter_number ?? 999),
								)
								.map((ch) => (
									<div
										key={ch.id}
										className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] bg-base-200/50 px-2 py-1.5 transition-colors duration-[var(--duration-fast)] hover:bg-base-200"
									>
										<div className="flex min-w-0 items-center gap-2">
											<span className="badge badge-primary badge-sm shrink-0 font-bold tabular-nums">
												第{ch.chapter_number ?? "?"}章
											</span>
											<Link
												to={`/project/${ch.project_id}`}
												className="truncate font-heading text-[length:var(--text-sm)] font-bold transition-colors hover:text-primary"
											>
												{ch.chapter_title || ch.project_title || "未命名"}
											</Link>
											{!ch.is_main_story ? (
												<span className="badge badge-ghost badge-xs shrink-0">
													外传
												</span>
											) : null}
										</div>
										<button
											type="button"
											className="btn btn-ghost btn-xs text-error/50 hover:text-error"
											aria-label={`从宇宙移除${ch.chapter_title || ch.project_title || "未命名项目"}`}
											title="从宇宙移除"
											onClick={() =>
												removeProjectMutation.mutate(ch.project_id)
											}
										>
											<TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
										</button>
									</div>
								))}
						</div>
					)}
				</Card>

				<Card className="!p-3">
					<h2 className="mb-2 flex items-center gap-1.5 font-heading text-[length:var(--text-md)] font-bold">
						<UserGroupIcon className="h-4 w-4" aria-hidden="true" />
						共享角色库
					</h2>

					{u.shared_characters.length === 0 ? (
						<p className="py-6 text-center text-[length:var(--text-sm)] text-base-content/40">
							还没有共享角色，从项目角色中提升
						</p>
					) : (
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
							{u.shared_characters.map((sc) => (
								<SharedCharacterCard key={sc.id} character={sc} />
							))}
						</div>
					)}
				</Card>
			</PageBody>
		</PageShell>
	);
}

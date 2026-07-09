import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { universesApi } from "~/services/api";
import { UniverseCard } from "~/components/universe/UniverseCard";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import { Modal } from "~/components/ui/Modal";
import { ConfirmModal } from "~/components/ui/ConfirmModal";
import { GlobeAltIcon, PlusIcon } from "@heroicons/react/24/outline";
import { toast } from "~/utils/toast";
import type { Universe } from "~/types";
import { Link } from "react-router-dom";
import { PageBody, PageShell } from "~/components/layout/PageShell";

export function UniversesPage() {
	const queryClient = useQueryClient();
	const [showCreate, setShowCreate] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<Universe | null>(null);
	const [createForm, setCreateForm] = useState({
		name: "",
		description: "",
		world_setting: "",
		style_rules: "",
	});

	const { data: universes = [], isLoading } = useQuery({
		queryKey: ["universes"],
		queryFn: () => universesApi.list(),
	});

	const createMutation = useMutation({
		mutationFn: universesApi.create,
		onSuccess: (universe: Universe) => {
			queryClient.invalidateQueries({ queryKey: ["universes"] });
			setShowCreate(false);
			setCreateForm({ name: "", description: "", world_setting: "", style_rules: "" });
			toast.success({
				title: "创建成功",
				message: `宇宙「${universe.name}」已创建`,
			});
		},
		onError: (error: Error) => {
			toast.error({
				title: "创建失败",
				message: error.message || "未知错误",
			});
		},
	});

	const deleteMutation = useMutation({
		mutationFn: universesApi.delete,
		onSuccess: (_data: void, _variables: number) => {
			queryClient.invalidateQueries({ queryKey: ["universes"] });
			toast.success({
				title: "删除成功",
				message: "IP 宇宙已删除",
			});
			setDeleteTarget(null);
		},
		onError: (error: Error) => {
			toast.error({
				title: "删除失败",
				message: error.message || "未知错误",
			});
		},
	});

	const handleCreate = () => {
		if (!createForm.name.trim()) return;
		createMutation.mutate({
			name: createForm.name.trim(),
			description: createForm.description || null,
			world_setting: createForm.world_setting || null,
			style_rules: createForm.style_rules || null,
		});
	};

	return (
		<PageShell data-shell="universes-list">
			<header className="chrome-row z-[var(--z-fixed)] gap-2 border-b border-base-content/12 bg-base-200 px-2 sm:px-3">
				<div className="flex-1">
					<Link to="/" className="btn btn-ghost btn-sm touch-target-dense h-8 min-h-8">
						← 返回首页
					</Link>
				</div>
				<div className="font-comic text-base font-bold tracking-wider text-base-content">
					<span className="inline-flex items-center gap-1.5">
						<GlobeAltIcon className="h-4 w-4" aria-hidden="true" />
						IP 宇宙
					</span>
				</div>
				<div className="flex flex-1 justify-end">
					<Button
						size="sm"
						className="h-8 min-h-8 gap-1 px-2"
						onClick={() => setShowCreate(true)}
					>
						<PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
						创建
					</Button>
				</div>
			</header>

			<PageBody className="mx-auto w-full max-w-6xl px-[var(--space-3)] py-[var(--space-3)] sm:px-[var(--space-4)]">
				<div className="mb-3 flex items-end justify-between gap-2">
					<div className="min-w-0">
						<h1 className="m-0 font-heading text-[length:var(--text-xl)] font-bold leading-tight">
							IP 宇宙
						</h1>
						<p className="m-0 mt-0.5 text-[length:var(--text-sm)] text-base-content/60">
							跨项目世界观与角色库
						</p>
					</div>
					<span className="font-mono text-[length:var(--text-2xs)] tabular-nums text-base-content/40">
						{isLoading ? "…" : `${universes.length} 个`}
					</span>
				</div>

				{isLoading && (
					<div className="flex items-center justify-center py-12">
						<span
							className="loading loading-spinner loading-md text-primary"
							aria-label="加载中"
						/>
					</div>
				)}

				{!isLoading && universes.length === 0 && (
					<Card className="py-10 text-center">
						<GlobeAltIcon
							className="mx-auto mb-3 h-10 w-10 text-primary/70"
							aria-hidden="true"
						/>
						<h2 className="mb-1 font-heading text-[length:var(--text-lg)] font-bold">
							还没有 IP 宇宙
						</h2>
						<p className="mb-4 text-[length:var(--text-sm)] text-base-content/60">
							创建第一个宇宙，开始跨项目故事
						</p>
						<Button size="sm" onClick={() => setShowCreate(true)}>
							<PlusIcon className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
							创建第一个宇宙
						</Button>
					</Card>
				)}

				{!isLoading && universes.length > 0 && (
					<div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2 lg:grid-cols-3">
						{universes.map((u) => (
							<UniverseCard key={u.id} universe={u} onDelete={setDeleteTarget} />
						))}
					</div>
				)}
			</PageBody>

			{/* Create modal */}
			{showCreate && (
				<Modal
					isOpen={showCreate}
					onClose={() => setShowCreate(false)}
					title="创建 IP 宇宙"
				>
					<div className="space-y-4">
						<Input
							label="宇宙名称"
							name="universe-name"
							placeholder="如：赛博修仙录"
							value={createForm.name}
							onChange={(e) =>
								setCreateForm({ ...createForm, name: e.target.value })
							}
						/>

						<div>
							<label htmlFor="universe-description" className="label text-xs font-bold">
								简介
							</label>
							<textarea
								id="universe-description"
								name="universe-description"
								className="textarea textarea-bordered bg-base-200 w-full h-20 text-sm"
								placeholder="宇宙的简要描述..."
								value={createForm.description}
								onChange={(e) =>
									setCreateForm({ ...createForm, description: e.target.value })
								}
							/>
						</div>

						<div>
							<label htmlFor="universe-world-setting" className="label text-xs font-bold">
								世界观设定
							</label>
							<textarea
								id="universe-world-setting"
								name="universe-world-setting"
								className="textarea textarea-bordered bg-base-200 w-full h-24 text-sm"
								placeholder="统一的世界观设定，所有章节必须遵循..."
								value={createForm.world_setting}
								onChange={(e) =>
									setCreateForm({ ...createForm, world_setting: e.target.value })
								}
							/>
						</div>

						<div>
							<label htmlFor="universe-style-rules" className="label text-xs font-bold">
								统一风格规则
							</label>
							<textarea
								id="universe-style-rules"
								name="universe-style-rules"
								className="textarea textarea-bordered bg-base-200 w-full h-16 text-sm"
								placeholder="角色设计、场景风格等统一规则..."
								value={createForm.style_rules}
								onChange={(e) =>
									setCreateForm({ ...createForm, style_rules: e.target.value })
								}
							/>
						</div>

						<div className="flex justify-end gap-2 pt-2">
							<Button variant="ghost" onClick={() => setShowCreate(false)}>
								取消
							</Button>
							<Button
								onClick={handleCreate}
								loading={createMutation.isPending}
								disabled={!createForm.name.trim()}
							>
								创建
							</Button>
						</div>
					</div>
				</Modal>
			)}

			{/* Delete confirm modal */}
			{deleteTarget && (
				<ConfirmModal
					isOpen={true}
					onClose={() => setDeleteTarget(null)}
					onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
					title="删除 IP 宇宙"
					message={`确定要删除宇宙「${deleteTarget.name}」吗？此操作不可撤销。关联的项目将被保留但不再属于该宇宙。`}
					confirmText="删除"
					variant="danger"
					isLoading={deleteMutation.isPending}
				/>
			)}
		</PageShell>
	);
}

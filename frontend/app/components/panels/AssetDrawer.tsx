import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assetsApi, getStaticUrl } from "~/services/api";
import { Button } from "~/components/ui/Button";
import { SvgIcon } from "~/components/ui/SvgIcon";
import type { Asset } from "~/types";

interface AssetDrawerProps {
	open: boolean;
	onClose: () => void;
}

function AssetCard({
	asset,
	onDelete,
}: {
	asset: Asset;
	onDelete: (id: number) => void;
}) {
	return (
		<div className="card card-compact bg-base-200 border-2 border-base-content/10 hover:border-primary/40 transition-colors">
			<figure className="h-32 bg-base-300 overflow-hidden">
				{asset.image_url ? (
					<img
						src={getStaticUrl(asset.image_url) ?? undefined}
						alt={asset.name}
						className="w-full h-full object-cover"
						loading="lazy"
					/>
				) : (
					<div className="flex items-center justify-center w-full h-full text-base-content/20">
						<SvgIcon name="image" size={32} />
					</div>
				)}
			</figure>
			<div className="card-body p-2 gap-1">
				<div className="flex items-center gap-1">
					<h4 className="text-xs font-bold flex-1 truncate">{asset.name}</h4>
				</div>
				{asset.description && (
					<p className="text-xs text-base-content/50 line-clamp-2">
						{asset.description}
					</p>
				)}
				<Button
					variant="ghost"
					size="sm"
					className="!px-1 !py-0 !min-h-0 !h-5 text-xs text-error/60 hover:text-error self-end"
					onClick={() => onDelete(asset.id)}
				>
					<SvgIcon name="x" size={12} />
				</Button>
			</div>
		</div>
	);
}

export function AssetDrawer({ open, onClose }: AssetDrawerProps) {
	const queryClient = useQueryClient();

	const { data } = useQuery({
		queryKey: ["assets"],
		queryFn: () => assetsApi.list("character"),
		enabled: open,
	});

	const deleteMutation = useMutation({
		mutationFn: (id: number) => assetsApi.delete(id),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assets"] }),
	});

	const items = data?.items ?? [];

	return (
		<>
			{open && (
				<div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
			)}
			<div
				className={`fixed right-0 top-0 h-full w-80 bg-base-100 border-l-2 border-base-content/15 z-50 transform transition-transform duration-200 ${open ? "translate-x-0" : "translate-x-full"}`}
			>
				<div className="flex items-center justify-between p-3 border-b-2 border-base-content/10">
					<div className="flex items-center gap-1.5">
						<SvgIcon name="archive" size={16} className="text-primary" />
						<h3 className="text-sm font-bold">资产库</h3>
						<span className="badge badge-xs badge-ghost">
							{data?.total ?? 0}
						</span>
					</div>
					<Button
						variant="ghost"
						size="sm"
						className="!px-1 !min-h-0 !h-6"
						onClick={onClose}
					>
						<SvgIcon name="x" size={14} />
					</Button>
				</div>

				<div
					className="p-3 overflow-y-auto"
					style={{ height: "calc(100vh - 80px)" }}
				>
					{items.length === 0 ? (
						<div className="text-center text-xs text-base-content/40 py-8">
							<SvgIcon
								name="layers"
								size={24}
								className="mx-auto mb-2 text-base-content/15"
							/>
							<p>还没有保存的资产</p>
							<p className="text-base-content/25 mt-1">
								在画布角色卡片点击{" "}
								<SvgIcon name="star" size={10} className="inline" /> 可添加
							</p>
						</div>
					) : (
						<div className="grid grid-cols-2 gap-2">
							{items.map((a) => (
								<AssetCard
									key={a.id}
									asset={a}
									onDelete={(id) => deleteMutation.mutate(id)}
								/>
							))}
						</div>
					)}
				</div>
			</div>
		</>
	);
}

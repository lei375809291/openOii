import { Link } from "react-router-dom";
import { Card } from "~/components/ui/Card";
import type { Universe } from "~/types";
import { SparklesIcon, UsersIcon, TrashIcon } from "@heroicons/react/24/outline";

interface UniverseCardProps {
	universe: Universe;
	onDelete: (universe: Universe) => void;
}

export function UniverseCard({ universe, onDelete }: UniverseCardProps) {
	return (
		<div className="group relative" data-shell="universe-card">
			<Link to={`/universes/${universe.id}`} className="block">
				<Card className="h-full transition-[box-shadow,transform] duration-[var(--duration-fast)] hover:-translate-y-px hover:shadow-brutal">
					{universe.cover_image_url ? (
						<div className="-mx-2 -mt-2 mb-2 h-24 overflow-hidden rounded-[var(--radius-md)]">
							<img
								src={universe.cover_image_url}
								alt={universe.name}
								className="h-full w-full object-cover"
								width={320}
								height={96}
								loading="lazy"
							/>
						</div>
					) : null}

					<h2 className="mb-0.5 font-heading text-[length:var(--text-md)] font-bold leading-snug">
						{universe.name}
					</h2>

					{universe.description ? (
						<p className="mb-2 line-clamp-2 text-[length:var(--text-xs)] text-base-content/65">
							{universe.description}
						</p>
					) : null}

					<div className="flex items-center gap-3 text-[length:var(--text-2xs)] text-base-content/60">
						<span className="inline-flex items-center gap-1 tabular-nums">
							<SparklesIcon className="h-3.5 w-3.5" aria-hidden="true" />
							{universe.projects_count} 章节
						</span>
						<span className="inline-flex items-center gap-1 tabular-nums">
							<UsersIcon className="h-3.5 w-3.5" aria-hidden="true" />
							{universe.shared_characters_count} 角色
						</span>
					</div>
				</Card>
			</Link>

			<button
				type="button"
				className="absolute right-1.5 top-1.5 rounded-full bg-base-100/90 p-1.5 text-base-content/40 opacity-0 transition-[opacity,color,background-color] duration-[var(--duration-fast)] hover:bg-error/15 hover:text-error group-hover:opacity-100 focus-visible:opacity-100"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					onDelete(universe);
				}}
				title="删除宇宙"
				aria-label={`删除宇宙 ${universe.name}`}
			>
				<TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
			</button>
		</div>
	);
}

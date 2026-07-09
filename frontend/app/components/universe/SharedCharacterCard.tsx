import { Card } from "~/components/ui/Card";
import type { SharedCharacterRead } from "~/types";
import { getStaticUrl } from "~/services/api";
import { UserIcon } from "@heroicons/react/24/outline";

interface SharedCharacterCardProps {
	character: SharedCharacterRead;
	onImport?: (character: SharedCharacterRead) => void;
	showImport?: boolean;
}

export function SharedCharacterCard({
	character,
	onImport,
	showImport = false,
}: SharedCharacterCardProps) {
	const imageUrl = getStaticUrl(character.canonical_image_url);
	const tags = character.character_tags
		? character.character_tags.split(",").map((t) => t.trim())
		: [];

	return (
		<Card className="h-full text-center !p-3" data-shell="shared-character-card">
			<div className="mb-1.5">
				{imageUrl ? (
					<div className="mx-auto h-14 w-14 overflow-hidden rounded-full border-2 border-primary/30 shadow-brutal-sm">
						<img
							src={imageUrl}
							alt={character.name}
							className="h-full w-full object-cover"
							width={56}
							height={56}
							loading="lazy"
						/>
					</div>
				) : (
					<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-base-content/10 bg-base-200">
						<UserIcon className="h-6 w-6 text-base-content/30" aria-hidden="true" />
					</div>
				)}
			</div>

			<h4 className="m-0 font-heading text-[length:var(--text-sm)] font-bold">
				{character.name}
			</h4>

			{tags.length > 0 ? (
				<div className="mt-1 mb-1 flex flex-wrap justify-center gap-0.5">
					{tags.slice(0, 3).map((tag) => (
						<span
							key={tag}
							className="rounded-full bg-primary/10 px-1.5 py-px font-bold text-[length:var(--text-2xs)] text-primary"
						>
							{tag}
						</span>
					))}
				</div>
			) : null}

			{character.description ? (
				<p className="mt-0.5 line-clamp-2 text-[length:var(--text-2xs)] text-base-content/50">
					{character.description}
				</p>
			) : null}

			<span className="mt-1 inline-block font-mono text-[length:var(--text-2xs)] tabular-nums text-base-content/35">
				v{character.version}
			</span>

			{showImport && onImport ? (
				<button
					type="button"
					className="btn btn-xs btn-primary mt-1.5"
					onClick={() => onImport(character)}
				>
					导入
				</button>
			) : null}
		</Card>
	);
}

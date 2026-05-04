import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "~/services/api";
import { Button } from "~/components/ui/Button";
import { SvgIcon } from "~/components/ui/SvgIcon";
import type { Message } from "~/types";

interface HistoryDrawerProps {
	open: boolean;
	onClose: () => void;
	projectId: number | undefined;
}

function HistoryMessage({ msg }: { msg: Message }) {
	const roleLabel: Record<string, string> = {
		assistant: "AI",
		user: "用户",
		system: "系统",
		error: "错误",
		handoff: "交接",
		separator: "—",
		info: "信息",
	};
	const roleCls: Record<string, string> = {
		assistant: "badge-primary",
		user: "badge-secondary",
		system: "badge-ghost",
		error: "badge-error",
		handoff: "badge-accent",
		separator: "badge-ghost",
		info: "badge-info",
	};

	if (msg.role === "separator") {
		return <div className="border-t border-base-content/5 my-2" />;
	}

	return (
		<div className="py-1.5 px-2 rounded hover:bg-base-200/50 transition-colors">
			<div className="flex items-center gap-1.5 mb-0.5">
				<span className={`badge badge-xs ${roleCls[msg.role] || "badge-ghost"}`}>
					{roleLabel[msg.role] || msg.role}
				</span>
				{msg.agent && (
					<span className="text-xs text-base-content/40 font-mono">{msg.agent}</span>
				)}
				<span className="text-xs text-base-content/25 ml-auto">
					{new Date(msg.created_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
				</span>
			</div>
			<p className="text-xs text-base-content/70 leading-relaxed break-words">
				{msg.role === "error" ? (
					<span className="text-error/80">{msg.content}</span>
				) : (
					msg.content.length > 200 ? msg.content.slice(0, 200) + "..." : msg.content
				)}
			</p>
			{msg.summary && (
				<p className="text-xs text-base-content/40 mt-0.5 italic">{msg.summary}</p>
			)}
		</div>
	);
}

export function HistoryDrawer({ open, onClose, projectId }: HistoryDrawerProps) {
	const { data: messages } = useQuery({
		queryKey: ["messages", projectId],
		queryFn: () => projectsApi.getMessages(projectId!),
		enabled: open && !!projectId,
	});

	return (
		<>
			{open && <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />}
			<div
				className={`fixed right-0 top-0 h-full w-80 bg-base-100 border-l-2 border-base-content/15 z-50 transform transition-transform duration-200 ${open ? "translate-x-0" : "translate-x-full"}`}
			>
				<div className="flex items-center justify-between p-3 border-b-2 border-base-content/10">
					<div className="flex items-center gap-1.5">
						<SvgIcon name="clock-3" size={16} className="text-primary" />
						<h3 className="text-sm font-bold">对话历史</h3>
						<span className="badge badge-xs badge-ghost">{messages?.length ?? 0}</span>
					</div>
					<Button variant="ghost" size="sm" className="!px-1 !min-h-0 !h-6" onClick={onClose}>
						<SvgIcon name="x" size={14} />
					</Button>
				</div>

				<div className="overflow-y-auto px-2 py-1" style={{ height: "calc(100vh - 56px)" }}>
					{!messages || messages.length === 0 ? (
						<div className="text-center text-xs text-base-content/40 py-8">
							<SvgIcon name="clapperboard" size={24} className="mx-auto mb-2 text-base-content/15" />
							<p>还没有对话记录</p>
							<p className="text-base-content/25 mt-1">开始生成后记录会出现在这里</p>
						</div>
					) : (
						messages.map((m) => <HistoryMessage key={m.id} msg={m} />)
					)}
				</div>
			</div>
		</>
	);
}

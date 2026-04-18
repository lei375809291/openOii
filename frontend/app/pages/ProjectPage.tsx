import {
	ArrowPathIcon,
	Bars3Icon,
	FaceFrownIcon,
	PencilIcon,
	StopIcon,
} from "@heroicons/react/24/outline";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ChatPanel } from "~/components/chat/ChatPanel";
import { Sidebar } from "~/components/layout/Sidebar";
import { StageView } from "~/components/layout/StageView";
import { ProviderSelectionFields } from "~/components/project/ProviderSelectionFields";
import { SettingsModal } from "~/components/settings/SettingsModal";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { useProjectWebSocket } from "~/hooks/useWebSocket";
import { projectsApi } from "~/services/api";
import { useEditorStore } from "~/stores/editorStore";
import { useSidebarStore } from "~/stores/sidebarStore";
import type {
	Project,
	ProjectProviderOverridesPayload,
	RecoveryControlRead,
	WorkflowStage,
} from "~/types";
import { ApiError } from "~/types/errors";
import { toast } from "~/utils/toast";

const PROVIDER_LABELS = {
	text: "文本",
	image: "图像",
	video: "视频",
} as const;

function deriveProviderOverridesFromProject(
	project: Pick<Project, "provider_settings">,
): ProjectProviderOverridesPayload {
	return {
		text_provider_override:
			project.provider_settings.text.source === "project"
				? project.provider_settings.text.selected_key
				: null,
		image_provider_override:
			project.provider_settings.image.source === "project"
				? project.provider_settings.image.selected_key
				: null,
		video_provider_override:
			project.provider_settings.video.source === "project"
				? project.provider_settings.video.selected_key
				: null,
	};
}

export function ProjectPage() {
	const { id } = useParams<{ id: string }>();
	const [searchParams, setSearchParams] = useSearchParams();
	const projectId = parseInt(id || "0", 10);
	const queryClient = useQueryClient();
	const store = useEditorStore();
	const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebarStore();
	const autoStartTriggered = useRef(false);
	const retryCount = useRef(0);
	const [isEditingProviders, setIsEditingProviders] = useState(false);
	const [providerDraft, setProviderDraft] =
		useState<ProjectProviderOverridesPayload>({
			text_provider_override: null,
			image_provider_override: null,
			video_provider_override: null,
		});

	const { send } = useProjectWebSocket(projectId);

	const {
		data: project,
		isLoading: projectLoading,
		error: projectError,
	} = useQuery({
		queryKey: ["project", projectId],
		queryFn: () => projectsApi.get(projectId),
		enabled: projectId > 0,
		retry: 1,
	});

	// 显示项目加载错误
	useEffect(() => {
		if (projectError) {
			const apiError = projectError instanceof ApiError ? projectError : null;
			toast.error({
				title: "无法加载项目",
				message: apiError?.message || "项目数据获取失败，请重试",
				actions: [
					{
						label: "重试",
						onClick: () =>
							queryClient.invalidateQueries({
								queryKey: ["project", projectId],
							}),
					},
				],
			});
		}
	}, [projectError, projectId, queryClient]);

	const { data: characters } = useQuery({
		queryKey: ["characters", projectId],
		queryFn: () => projectsApi.getCharacters(projectId),
		enabled: !!project,
	});

	const { data: shots } = useQuery({
		queryKey: ["shots", projectId],
		queryFn: () => projectsApi.getShots(projectId),
		enabled: !!project,
	});

	const { data: messages } = useQuery({
		queryKey: ["messages", projectId],
		queryFn: () => projectsApi.getMessages(projectId),
		enabled: !!project,
	});

	// 当项目数据加载完成后，更新到 store（依赖 projectId 确保切换时重新加载）
	useEffect(() => {
		if (characters) {
			useEditorStore.getState().setCharacters(characters);
		}
	}, [characters]);

	useEffect(() => {
		if (shots) {
			useEditorStore.getState().setShots(shots);
		}
	}, [shots]);

	// 初始化 projectVideoUrl
	useEffect(() => {
		if (project?.video_url) {
			useEditorStore.getState().setProjectVideoUrl(project.video_url);
		}
	}, [project?.video_url]);

	useEffect(() => {
		if (!project || isEditingProviders) {
			return;
		}

		setProviderDraft({
			...deriveProviderOverridesFromProject(project),
		});
	}, [isEditingProviders, project]);

	// 加载历史消息（只在数据加载完成后执行一次）
	const messagesLoadedRef = useRef(false);

	// 当项目 ID 变化时，立即清空状态，确保项目完全独立
	useEffect(() => {
		if (projectId <= 0) {
			return;
		}

		const editorStore = useEditorStore.getState();

		// 重置消息加载标记
		messagesLoadedRef.current = false;

		// 清空消息
		editorStore.clearMessages();

		// 清空生成状态
		editorStore.setGenerating(false);
		editorStore.setProgress(0);
		editorStore.setCurrentAgent(null);
		editorStore.setCurrentStage("ideate");

		// 清空确认状态
		editorStore.setAwaitingConfirm(false, null, null);
		editorStore.setCurrentRunId(null);

		// 清空选中状态
		editorStore.setSelectedShot(null);
		editorStore.setSelectedCharacter(null);
		editorStore.setHighlightedMessage(null);

		// 清空项目视频
		editorStore.setProjectVideoUrl(null);

		// 注意：不清空画布数据（characters/shots），让 React Query 的数据自然覆盖
		// 避免竞态条件导致数据被清空
	}, [projectId]);

	// 当新项目的消息加载完成后，恢复历史消息
	useEffect(() => {
		if (messages && !messagesLoadedRef.current) {
			messagesLoadedRef.current = true;
			const editorStore = useEditorStore.getState();
			// 加载历史消息（使用数据库 ID 作为消息 ID）
			messages.forEach((msg) => {
				editorStore.addMessage({
					id: `db_${msg.id}`,
					agent: msg.agent,
					role: msg.role,
					content: msg.content,
					timestamp: msg.created_at,
					progress: msg.progress ?? undefined,
					isLoading: msg.is_loading,
				});
			});
		}
	}, [messages]);

	const generateMutation = useMutation({
		mutationFn: () => projectsApi.generate(projectId),
		onSuccess: () => {
			// 重置重试计数
			retryCount.current = 0;
		},
		onError: async (error: Error | ApiError) => {
			const apiError = error instanceof ApiError ? error : null;
			const isConflict =
				apiError?.status === 409 || error.message.includes("409");

			if (isConflict) {
				retryCount.current = 0;
				const control = apiError?.response as RecoveryControlRead | undefined;
				if (control) {
					store.setRecoveryControl(control);
					store.setRecoverySummary(control.recovery_summary);
					store.setCurrentRunId(control.active_run.id);
					store.setGenerating(control.state === "active");
					if (control.state === "active") {
						store.setCurrentAgent(control.active_run.current_agent);
						store.setProgress(control.active_run.progress);
					}
				} else {
					toast.warning({
						title: "请稍等片刻",
						message: "另一个任务正在进行，完成后再试",
					});
				}
			} else {
				// 其他错误
				toast.error({
					title: "生成失败",
					message:
						apiError?.message ||
						error.message ||
						"生成过程出错，请重试或联系支持",
					details: import.meta.env.DEV
						? JSON.stringify(apiError?.details)
						: undefined,
				});
			}
		},
	});

	const feedbackMutation = useMutation({
		mutationFn: (content: string) => projectsApi.feedback(projectId, content),
		onSuccess: () => {
			// feedback API 成功会创建新的 run，WebSocket 会收到 run_started 事件
		},
		onError: (error: Error | ApiError) => {
			const apiError = error instanceof ApiError ? error : null;
			const isConflict =
				apiError?.status === 409 || error.message.includes("409");

			if (isConflict) {
				toast.info({
					title: "AI 正在思考",
					message: "请等待当前任务完成",
				});
			} else {
				toast.error({
					title: "提交失败",
					message: apiError?.message || error.message || "无法发送反馈，请重试",
				});
			}
		},
	});

	const cancelMutation = useMutation({
		mutationFn: () => projectsApi.cancel(projectId),
		onSettled: () => {
			store.setGenerating(false);
			store.setProgress(0);
			store.setCurrentAgent(null);
			store.setAwaitingConfirm(false, null, null);
			store.setCurrentRunId(null);
			store.setRecoveryControl(null);
			store.setRecoverySummary(null);
			store.setRecoveryGate(null);
			store.addMessage({
				agent: "system",
				role: "system",
				content: "生成已停止",
				icon: StopIcon,
				timestamp: new Date().toISOString(),
			});
		},
	});

	const resumeMutation = useMutation({
		mutationFn: () => {
			const control = store.recoveryControl;
			if (!control) {
				throw new Error("没有可恢复的运行");
			}
			return projectsApi.resume(projectId, control.active_run.id);
		},
		onSuccess: (run) => {
			const control = store.recoveryControl;
			store.setGenerating(true);
			store.setCurrentRunId(run.id);
			store.setCurrentAgent(run.current_agent);
			store.setProgress(run.progress);
			if (control) {
				const nextStage =
					control.recovery_summary.next_stage ??
					control.recovery_summary.current_stage;
				if (nextStage) {
					store.setCurrentStage(nextStage as WorkflowStage);
				}
			}
			store.setRecoveryControl(null);
			store.setRecoverySummary(null);
			store.setRecoveryGate(null);
		},
		onError: (error: Error | ApiError) => {
			const apiError = error instanceof ApiError ? error : null;
			toast.error({
				title: "恢复失败",
				message:
					apiError?.message || error.message || "无法恢复当前运行，请重试",
			});
		},
	});

	const updateProvidersMutation = useMutation({
		mutationFn: (payload: ProjectProviderOverridesPayload) =>
			projectsApi.update(projectId, payload),
		onSuccess: () => {
			setIsEditingProviders(false);
			queryClient.invalidateQueries({ queryKey: ["project", projectId] });
			queryClient.invalidateQueries({ queryKey: ["projects"] });
			toast.success({
				title: "Provider 已保存",
				message: "项目级 provider 选择已更新。",
			});
		},
		onError: (error: Error | ApiError) => {
			const apiError = error instanceof ApiError ? error : null;
			toast.error({
				title: "保存失败",
				message:
					apiError?.message || error.message || "无法更新项目 provider 设置",
			});
		},
	});

	const handleGenerate = async () => {
		store.clearMessages();
		store.setCurrentStage("ideate");
		generateMutation.mutate();
	};

	const handleFeedback = (content: string) => {
		feedbackMutation.mutate(content);
		store.addMessage({
			agent: "user",
			role: "user",
			content,
			timestamp: new Date().toISOString(),
		});
	};

	const handleConfirm = (feedback?: string) => {
		const runId = store.currentRunId;
		if (runId) {
			// 有活跃的 run，通过 WebSocket 发送
			send({ type: "confirm", data: { run_id: runId, feedback } });
			if (feedback) {
				store.addMessage({
					agent: "user",
					role: "user",
					content: feedback,
					timestamp: new Date().toISOString(),
				});
			}
		} else {
			// 没有活跃的 run 时，记录警告而不是错误地调用 feedback API
			console.warn("[handleConfirm] No active run ID, cannot send confirm");
		}
	};

	const handleCancel = () => {
		cancelMutation.mutate();
	};

	const handleResume = () => {
		if (!store.recoveryControl) {
			return;
		}
		resumeMutation.mutate();
	};

	const handleProviderEditCancel = () => {
		if (!project) {
			return;
		}

		setProviderDraft({
			...deriveProviderOverridesFromProject(project),
		});
		setIsEditingProviders(false);
	};

	const handleProviderSave = () => {
		updateProvidersMutation.mutate(providerDraft);
	};

	useEffect(() => {
		if (!store.isGenerating && store.progress === 1) {
			queryClient.invalidateQueries({ queryKey: ["characters", projectId] });
			queryClient.invalidateQueries({ queryKey: ["shots", projectId] });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [store.isGenerating, store.progress, projectId, queryClient]);

	// 监听项目更新事件，刷新项目数据
	const projectUpdatedAt = useEditorStore((state) => state.projectUpdatedAt);
	useEffect(() => {
		if (projectUpdatedAt) {
			queryClient.invalidateQueries({ queryKey: ["project", projectId] });
			queryClient.invalidateQueries({ queryKey: ["projects"] }); // 同时刷新列表
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [projectUpdatedAt, projectId, queryClient]);

	useEffect(() => {
		const autoStart = searchParams.get("autoStart");
		if (
			autoStart === "true" &&
			project &&
			!autoStartTriggered.current &&
			!store.isGenerating
		) {
			autoStartTriggered.current = true;
			setSearchParams({}, { replace: true });
			store.clearMessages();
			store.setCurrentStage("ideate");
			generateMutation.mutate();
		}
	}, [project, searchParams, setSearchParams, store, generateMutation]);

	if (projectLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center flex-col gap-4 bg-base-100">
				<PencilIcon className="w-6 h-6 animate-bounce" aria-hidden="true" />
				<p className="font-sketch text-2xl text-base-content/80">
					正在加载项目...
				</p>
			</div>
		);
	}

	if (!project) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-base-100">
				<Card className="text-center">
					<FaceFrownIcon
						className="w-6 h-6 mx-auto mb-4 animate-wiggle"
						aria-hidden="true"
					/>
					<h1 className="text-2xl font-heading font-bold mb-4">项目未找到</h1>
					<Link to="/">
						<Button variant="primary">返回首页</Button>
					</Link>
				</Card>
			</div>
		);
	}

	const providerRows = [
		{
			key: "text" as const,
			label: PROVIDER_LABELS.text,
			entry: project.provider_settings.text,
		},
		{
			key: "image" as const,
			label: PROVIDER_LABELS.image,
			entry: project.provider_settings.image,
		},
		{
			key: "video" as const,
			label: PROVIDER_LABELS.video,
			entry: project.provider_settings.video,
		},
	];
	const invalidProviderEntry = providerRows.find((row) => !row.entry.valid);
	const generateDisabledReason = invalidProviderEntry?.entry.reason_message ?? undefined;
	const generateDisabled = Boolean(generateDisabledReason);

	return (
		<>
			<Sidebar />
			<SettingsModal />
			<div
				className={`h-screen flex flex-col bg-base-100 font-sans transition-all duration-300 ease-in-out ${
					sidebarOpen ? "ml-72" : "ml-0"
				}`}
			>
				<header className="flex-shrink-0 bg-base-100/80 backdrop-blur-sm border-b-3 border-black px-4 z-10">
					<div className="flex items-center h-14">
						<div className="w-10">
							{!sidebarOpen && (
								<Button
									variant="ghost"
									size="sm"
									className="!px-2"
									onClick={toggleSidebar}
									title="展开侧边栏"
								>
									<Bars3Icon className="w-5 h-5" />
								</Button>
							)}
						</div>
						<h1
							className="flex-1 text-lg font-heading font-semibold truncate text-center"
							title={project.title}
						>
							{project.title}
						</h1>
						<div className="w-10" />
					</div>
				</header>

				<div className="px-2 sm:px-4 pt-2 sm:pt-4">
					<Card className="border border-base-300 bg-base-100 shadow-none">
						<div className="flex flex-col gap-4">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
								<div>
									<h2 className="text-lg font-heading font-bold">Provider 选择</h2>
									<p className="mt-1 text-sm text-base-content/70">
										这里展示真实解析结果：当前选择、解析结果，以及它来自项目覆盖还是默认继承。
									</p>
								</div>

								{!isEditingProviders ? (
									<Button
										variant="secondary"
										onClick={() => setIsEditingProviders(true)}
									>
										编辑 Provider
									</Button>
								) : (
									<div className="flex flex-wrap gap-2">
										<Button
											variant="ghost"
											onClick={handleProviderEditCancel}
											disabled={updateProvidersMutation.isPending}
										>
											取消
										</Button>
										<Button
											variant="primary"
											onClick={handleProviderSave}
											loading={updateProvidersMutation.isPending}
										>
											保存 Provider 设置
										</Button>
									</div>
								)}
							</div>

							{!isEditingProviders ? (
								<div className="grid gap-3 md:grid-cols-3">
									{providerRows.map((row) => (
										<div
											key={row.key}
											className="rounded-2xl border border-base-300 bg-base-200/50 p-4"
										>
											<div className="flex items-center justify-between gap-3">
												<span className="text-sm font-semibold text-base-content">
													{row.label}
												</span>
												<span
													className={`badge ${
														row.entry.source === "project"
															? "badge-primary"
															: "badge-ghost"
													}`}
												>
													{row.entry.source === "project"
														? "项目覆盖"
														: "默认继承"}
												</span>
											</div>
											<p className="mt-3 text-xs text-base-content/60">
												selected
											</p>
											<p className="font-mono text-sm text-base-content">
												{row.entry.selected_key}
											</p>
											<p className="mt-1 text-xs text-base-content/60">
												resolved
											</p>
											<p className="font-mono text-sm text-base-content">
												{row.entry.resolved_key ?? "未解析"}
											</p>
											{row.entry.reason_message ? (
												<p className="mt-2 text-xs text-warning">
													{row.entry.reason_message}
												</p>
											) : (
												<p className="mt-2 text-xs text-success">解析有效</p>
											)}
										</div>
									))}
								</div>
							) : (
								<ProviderSelectionFields
									value={providerDraft}
									onChange={setProviderDraft}
									disabled={updateProvidersMutation.isPending}
									defaultKeys={{
										text:
											project.provider_settings.text.source === "default"
												? project.provider_settings.text.selected_key
												: "anthropic",
										image:
											project.provider_settings.image.source === "default"
												? project.provider_settings.image.selected_key
												: "openai",
										video:
											project.provider_settings.video.source === "default"
												? project.provider_settings.video.selected_key
												: "openai",
									}}
								/>
							)}
						</div>
					</Card>
				</div>

				{store.recoveryControl && (
					<div className="px-2 sm:px-4 pt-2 sm:pt-4">
						<Card className="border-2 border-black bg-warning/10 shadow-[4px_4px_0_0_#000]">
							<div className="flex flex-col gap-4 p-4 sm:p-5">
								<div className="flex flex-col gap-1">
									<p className="text-sm font-semibold uppercase tracking-wide text-base-content/70">
										{store.recoveryControl.state === "active"
											? "当前有活跃运行"
											: "可恢复运行"}
									</p>
									<h2 className="text-lg font-heading font-bold text-base-content">
										恢复到同一线程继续执行
									</h2>
									<p className="text-sm text-base-content/80">
										{store.recoveryControl.detail}
									</p>
								</div>

								<div className="grid gap-3 sm:grid-cols-3 text-sm">
									<div className="rounded-xl border border-black/10 bg-base-100/70 p-3">
										<div className="text-xs text-base-content/60">线程</div>
										<div className="mt-1 font-mono text-xs break-all">
											{store.recoveryControl.thread_id}
										</div>
									</div>
									<div className="rounded-xl border border-black/10 bg-base-100/70 p-3">
										<div className="text-xs text-base-content/60">继续阶段</div>
										<div className="mt-1 font-medium">
											{store.recoveryControl.recovery_summary.next_stage ??
												store.recoveryControl.recovery_summary.current_stage}
										</div>
									</div>
									<div className="rounded-xl border border-black/10 bg-base-100/70 p-3">
										<div className="text-xs text-base-content/60">
											已保留阶段
										</div>
										<div className="mt-1 font-medium">
											{store.recoveryControl.recovery_summary.preserved_stages
												.length > 0
												? store.recoveryControl.recovery_summary.preserved_stages.join(
														" · ",
													)
												: "无"}
										</div>
									</div>
								</div>

								<div className="flex flex-wrap gap-2">
									<Button
										variant="primary"
										onClick={handleResume}
										disabled={
											resumeMutation.isPending || cancelMutation.isPending
										}
									>
										<span className="inline-flex items-center gap-2">
											<ArrowPathIcon className="w-4 h-4" aria-hidden="true" />
											{store.recoveryControl.state === "active"
												? "继续跟踪"
												: "恢复运行"}
										</span>
									</Button>
									<Button
										variant="secondary"
										onClick={handleCancel}
										disabled={
											resumeMutation.isPending || cancelMutation.isPending
										}
									>
										<span className="inline-flex items-center gap-2">
											<StopIcon className="w-4 h-4" aria-hidden="true" />
											取消运行
										</span>
									</Button>
								</div>
							</div>
						</Card>
					</div>
				)}

				<main className="flex-1 flex flex-col md:flex-row overflow-hidden p-2 sm:p-4 gap-2 sm:gap-4">
					<div className="w-full md:w-2/5 lg:w-1/3 md:min-w-[320px] md:max-w-[480px] h-64 md:h-full flex flex-col">
						<ChatPanel
							onSendFeedback={handleFeedback}
							onConfirm={handleConfirm}
							onGenerate={handleGenerate}
							onCancel={handleCancel}
							isGenerating={store.isGenerating || generateMutation.isPending}
							generateDisabled={generateDisabled}
							generateDisabledReason={generateDisabledReason}
						/>
					</div>

					<div className="flex-1 overflow-hidden min-h-0">
						<StageView projectId={projectId} />
					</div>
				</main>
			</div>
		</>
	);
}

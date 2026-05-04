import {
	Bars3Icon,
	StopIcon,
} from "@heroicons/react/24/outline";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ChatDrawer } from "~/components/chat/ChatDrawer";
import { Sidebar } from "~/components/layout/Sidebar";
import { StagePipeline } from "~/components/pipeline/StagePipeline";
import { StageView } from "~/components/layout/StageView";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { useProjectWebSocket } from "~/hooks/useWebSocket";
import { projectsApi } from "~/services/api";
import { useEditorStore } from "~/stores/editorStore";
import { useSidebarStore } from "~/stores/sidebarStore";
import type {
	ProjectProviderSettings,
	RecoveryControlRead,
} from "~/types";
import { ApiError } from "~/types/errors";
import { toast } from "~/utils/toast";
import { isWorkflowStage } from "~/utils/workflowStage";

export function ProjectPage() {
	const { id } = useParams<{ id: string }>();
	const [searchParams, setSearchParams] = useSearchParams();
	const projectId = parseInt(id || "0", 10);
	const queryClient = useQueryClient();
	const store = useEditorStore();
	const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebarStore();
	const autoStartTriggered = useRef(false);
	const generateRequestTokenRef = useRef(0);
	const retryCount = useRef(0);

	const { send } = useProjectWebSocket(projectId);
	const hasActiveRun = store.isGenerating || Boolean(store.currentRunId);
	const hasRecovery = Boolean(store.recoveryControl);

	const syncStoreWithActiveRun = (run: {
		id: number;
		current_agent?: string | null;
		progress?: number | null;
		provider_snapshot?: ProjectProviderSettings | null;
	}) => {
		store.setGenerating(true);
		store.setCurrentRunId(run.id);
		store.setCurrentAgent(run.current_agent ?? "orchestrator");
		store.setProgress(typeof run.progress === "number" ? run.progress : 0);
		store.setCurrentRunProviderSnapshot(run.provider_snapshot ?? null);
		store.setAwaitingConfirm(false, null, run.id);
		store.setRecoveryControl(null);
		store.setRecoverySummary(null);
		store.setRecoveryGate(null);
	};

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

	useEffect(() => {
		if (project?.video_url) {
			useEditorStore.getState().setProjectVideoUrl(project.video_url);
		}
	}, [project?.video_url]);

	useEffect(() => {
		if (projectId <= 0) return;

		generateRequestTokenRef.current += 1;
		const editorStore = useEditorStore.getState();

		editorStore.clearMessages();
		editorStore.resetRunState();
		editorStore.setCurrentStage("plan");
		editorStore.setSelectedShot(null);
		editorStore.setSelectedCharacter(null);
		editorStore.setHighlightedMessage(null);
		editorStore.setProjectVideoUrl(null);
	}, [projectId]);

	const messagesLoadedRef = useRef(false);
	useEffect(() => {
		if (messages && !messagesLoadedRef.current) {
			messagesLoadedRef.current = true;
			const editorStore = useEditorStore.getState();
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
		mutationFn: ({ requestToken }: { requestToken: number }) =>
			projectsApi.generate(projectId, { auto_mode: store.runMode === "yolo" }).then((run) => ({ run, requestToken })),
		onSuccess: ({ run, requestToken }) => {
			if (requestToken !== generateRequestTokenRef.current) return;
			syncStoreWithActiveRun(run);
			retryCount.current = 0;
		},
		onError: async (error: Error | ApiError, variables) => {
			if (variables?.requestToken !== generateRequestTokenRef.current) return;
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
			store.resetRunState();
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
			store.setCurrentRunProviderSnapshot(run.provider_snapshot ?? null);
			if (control) {
				const nextStage =
					control.recovery_summary.next_stage ??
					control.recovery_summary.current_stage;
				if (isWorkflowStage(nextStage)) {
					store.setCurrentStage(nextStage);
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

	const handleGenerate = async () => {
		if (generateMutation.isPending || hasActiveRun) return;
		const requestToken = generateRequestTokenRef.current + 1;
		generateRequestTokenRef.current = requestToken;
		store.clearMessages();
		store.setCurrentStage("plan");
		generateMutation.mutate({ requestToken });
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
			console.warn("[handleConfirm] No active run ID, cannot send confirm");
		}
	};

	const handleCancel = () => {
		const activeRunId = store.currentRunId ?? store.recoveryControl?.active_run.id ?? null;
		if (!activeRunId && !store.isGenerating && store.recoveryControl?.state !== "active") {
			return;
		}
		generateRequestTokenRef.current += 1;
		cancelMutation.mutate();
	};

	const handleResume = () => {
		if (!store.recoveryControl) return;
		resumeMutation.mutate();
	};

	useEffect(() => {
		if (!store.isGenerating && store.progress === 1) {
			queryClient.invalidateQueries({ queryKey: ["characters", projectId] });
			queryClient.invalidateQueries({ queryKey: ["shots", projectId] });
		}
	}, [store.isGenerating, store.progress, projectId, queryClient]);

	const projectUpdatedAt = useEditorStore((state) => state.projectUpdatedAt);
	useEffect(() => {
		if (projectUpdatedAt) {
			queryClient.invalidateQueries({ queryKey: ["project", projectId] });
			queryClient.invalidateQueries({ queryKey: ["projects"] });
		}
	}, [projectUpdatedAt, projectId, queryClient]);

	useEffect(() => {
		const autoStart = searchParams.get("autoStart");
		if (
			autoStart === "true" &&
			project &&
			!autoStartTriggered.current &&
			!hasActiveRun
		) {
			const editorStore = useEditorStore.getState();
			autoStartTriggered.current = true;
			setSearchParams({}, { replace: true });
			const requestToken = generateRequestTokenRef.current + 1;
			generateRequestTokenRef.current = requestToken;
			editorStore.clearMessages();
			editorStore.setCurrentStage("plan");
			generateMutation.mutate({ requestToken });
		}
	}, [project, searchParams, setSearchParams, generateMutation]);

	if (projectLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center flex-col gap-4 bg-base-100">
				<div className="w-6 h-6 animate-bounce text-base-content/60">✦</div>
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
					<h1 className="text-2xl font-heading font-bold mb-4">项目未找到</h1>
					<Link to="/">
						<Button variant="primary">返回首页</Button>
					</Link>
				</Card>
			</div>
		);
	}

	const generateDisabled = false;

	return (
		<>
			<Sidebar />
			<div
				className={`h-screen flex flex-col bg-base-100 font-sans transition-all duration-300 ease-in-out ${
					sidebarOpen ? "ml-72" : "ml-0"
				}`}
			>
				<header className="flex-shrink-0 flex items-center h-10 px-3 bg-base-100/80 backdrop-blur-sm border-b border-base-300 z-10">
					<div className="w-8">
						{!sidebarOpen && (
							<Button
								variant="ghost"
								size="sm"
								className="!px-1.5"
								onClick={toggleSidebar}
								title="展开侧边栏"
							>
								<Bars3Icon className="w-4 h-4" />
							</Button>
						)}
					</div>
					<h1
						className="flex-1 text-sm font-heading font-semibold truncate text-center"
						title={project.title}
					>
						{project.title}
					</h1>
					<div className="w-8" />
				</header>

				<StagePipeline
					currentStage={store.currentStage}
					isGenerating={store.isGenerating}
					awaitingConfirm={store.awaitingConfirm}
					onResume={handleResume}
					onCancel={handleCancel}
					hasRecovery={hasRecovery}
				/>

				<main className="flex-1 relative overflow-hidden">
					<StageView projectId={projectId} />

					<ChatDrawer
						onSendFeedback={handleFeedback}
						onConfirm={handleConfirm}
						onGenerate={handleGenerate}
						onCancel={handleCancel}
						isGenerating={hasActiveRun}
						generateDisabled={generateDisabled}
						generateDisabledReason={undefined}
					/>
				</main>
			</div>
		</>
	);
}

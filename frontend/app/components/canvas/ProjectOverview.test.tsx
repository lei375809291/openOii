import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { charactersApi, projectsApi, shotsApi } from "~/services/api";
import { useEditorStore } from "~/stores/editorStore";
import { toast } from "~/utils/toast";
import { ProjectOverview } from "./ProjectOverview";

vi.mock("~/services/api", () => ({
	projectsApi: {
		get: vi.fn(),
		feedback: vi.fn(),
	},
	shotsApi: {
		update: vi.fn(),
		regenerate: vi.fn(),
		approve: vi.fn(),
		delete: vi.fn(),
	},
	charactersApi: {
		update: vi.fn(),
		regenerate: vi.fn(),
		approve: vi.fn(),
		delete: vi.fn(),
	},
	getStaticUrl: (value: string | null | undefined) => value ?? null,
}));

vi.mock("~/components/ui/HoverActionBar", () => ({
	HoverActionBar: ({
		actions,
		children,
	}: {
		actions: Array<{ label: string; onClick: () => void }>;
		children: ReactNode;
	}) => (
		<div>
			<div>{children}</div>
			<div>
				{actions.map((action) => (
					<button key={action.label} type="button" onClick={action.onClick}>
						{action.label}
					</button>
				))}
			</div>
		</div>
	),
}));

const baseProject = {
	id: 7,
	title: "创意项目",
	story: null,
	style: null,
	summary: "夜色中的追踪故事",
	video_url: null,
	status: "active",
	created_at: "2026-04-11T00:00:00Z",
	updated_at: "2026-04-11T00:00:00Z",
};

const renderOverview = () => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});

	return render(
		<QueryClientProvider client={queryClient}>
			<ProjectOverview projectId={baseProject.id} />
		</QueryClientProvider>,
	);
};

describe("ProjectOverview edit-before-rerun flow", () => {
	beforeEach(() => {
		useEditorStore.getState().reset();
		vi.clearAllMocks();

		vi.mocked(projectsApi.get).mockResolvedValue(baseProject as never);
	});

	it("renders empty placeholder when project has no generated content", async () => {
		vi.mocked(projectsApi.get).mockResolvedValue({
			...baseProject,
			summary: null,
		} as never);

		renderOverview();

		expect(await screen.findByText("项目概览")).toBeInTheDocument();
		expect(screen.getByText("开始生成后，故事内容将显示在这里")).toBeInTheDocument();
		await waitFor(() => {
			expect(screen.queryByText("角色设计")).not.toBeInTheDocument();
			expect(screen.queryByText("分镜脚本")).not.toBeInTheDocument();
			expect(screen.queryByText("最终视频")).not.toBeInTheDocument();
		});
	});

	it("shows content placeholders when sections are still generating", async () => {
		renderOverview();

		expect(await screen.findByText("故事简介")).toBeInTheDocument();
		expect(screen.getByText(baseProject.summary || "")).toBeInTheDocument();
		expect(screen.getByText("角色设计 (0)")).toBeInTheDocument();
		expect(screen.getByText(/分镜脚本 \(0/)).toBeInTheDocument();
		expect(screen.getAllByText("角色正在生成中...")).toHaveLength(1);
		expect(screen.getAllByText("分镜正在生成中...")).toHaveLength(1);
	});

	it("opens image preview dialog for character image and closes it", async () => {
		const user = userEvent.setup();
		useEditorStore.getState().setCharacters([
			{
				id: 101,
				project_id: 7,
				name: "测试角色",
				description: "一个测试角色",
				image_url: "/static/characters/test.png",
				approval_state: "approved",
				approval_version: 1,
				approved_at: null,
				approved_name: null,
				approved_description: null,
				approved_image_url: null,
			},
		]);

		renderOverview();

		const imageButton = await screen.findByLabelText("预览图片：测试角色");
		await user.click(imageButton);

		const dialog = await screen.findByRole("dialog", { name: "图片预览：测试角色" });
		expect(dialog).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "关闭" }));
		expect(screen.queryByRole("dialog", { name: "图片预览：测试角色" })).not.toBeInTheDocument();
	});

	it("supports final output blocked section state hints", async () => {
		const openMock = vi.spyOn(window, "open").mockImplementation(() => null);
		vi.mocked(projectsApi.get).mockResolvedValue({
			...baseProject,
			status: "superseded",
		} as never);
		useEditorStore.getState().setProjectVideoUrl("/static/videos/final-current.mp4");

		renderOverview();

		await screen.findByText("来源：上一次合成结果，已被新版本替代");
		expect(screen.getByText("当前成片已失效，但仍可预览和下载历史版本。", { exact: false })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "重试合成" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "预览最终视频" })).toBeInTheDocument();

		openMock.mockRestore();
	});

	it("renders final output blocked state with placeholder text and full action buttons", async () => {
		useEditorStore.getState().setProjectVideoUrl(null);
		vi.mocked(projectsApi.get).mockResolvedValue({
			...baseProject,
			status: "blocked",
			summary: "夜色中的追踪故事",
		} as never);

		renderOverview();

		await screen.findByText(/等待分镜片段完成后生成最终视频/);
		expect(
			screen.getByText("当前仍在等待分镜片段完成，完成后会自动生成最终视频。"),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "预览最终视频" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "下载最终视频" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "重试合成" })).toBeInTheDocument();
	});

	it("downloads final video successfully without showing error toast", async () => {
		const user = userEvent.setup();
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
			ok: true,
			blob: async () => new Blob(["final-video"]),
		} as never);
		const openMock = vi.spyOn(window, "open").mockImplementation(() => null);
		const createObjectURLMock = vi
			.spyOn(window.URL, "createObjectURL")
			.mockReturnValue("blob:video" as never);
		const revokeObjectURLMock = vi
			.spyOn(window.URL, "revokeObjectURL")
			.mockImplementation(() => undefined);
		const appendChildSpy = vi.spyOn(document.body, "appendChild");
		const removeChildSpy = vi.spyOn(document.body, "removeChild");
		const toastErrorSpy = vi.spyOn(toast, "error").mockImplementation(() => undefined);

		useEditorStore.getState().setProjectVideoUrl("/static/videos/final-current.mp4");
		vi.mocked(projectsApi.get).mockResolvedValue({
			...baseProject,
			status: "completed",
			video_url: "/static/videos/final-current.mp4",
		} as never);
		renderOverview();

		await screen.findByText(/来源：当前成片/);
		await user.click(screen.getByRole("button", { name: "下载最终视频" }));

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith("/api/v1/projects/7/final-video");
			expect(createObjectURLMock).toHaveBeenCalled();
			expect(appendChildSpy).toHaveBeenCalled();
			expect(removeChildSpy).toHaveBeenCalled();
			expect(toastErrorSpy).not.toHaveBeenCalled();
			expect(openMock).not.toHaveBeenCalled();
		});

		fetchMock.mockRestore();
		openMock.mockRestore();
		createObjectURLMock.mockRestore();
		revokeObjectURLMock.mockRestore();
		appendChildSpy.mockRestore();
		removeChildSpy.mockRestore();
		toastErrorSpy.mockRestore();
	});

	it("opens shot rerun editing from the approved shot contract before rerunning video", async () => {
		const user = userEvent.setup();
		useEditorStore.getState().setShots([
			{
				id: 21,
				project_id: 7,
				order: 1,
				description: "当前分镜描述",
				prompt: "当前视频提示词",
				image_prompt: "当前图片提示词",
				image_url: "/static/shots/21-current.png",
				video_url: "/static/shots/21-current.mp4",
				duration: 6,
				camera: "current camera",
				motion_note: "current motion",
				character_ids: [1],
				approval_state: "superseded",
				approval_version: 3,
				approved_at: "2026-04-11T10:00:00Z",
				approved_description: "已批准的分镜描述",
				approved_prompt: "已批准的视频提示词",
				approved_image_prompt: "已批准的图片提示词",
				approved_duration: 8,
				approved_camera: "approved camera",
				approved_motion_note: "approved motion",
				approved_character_ids: [1, 2],
			},
		]);
		vi.mocked(shotsApi.update).mockResolvedValue({
			id: 21,
			project_id: 7,
			order: 1,
			description: "已批准的分镜描述",
			prompt: "重新生成的视频提示词",
			image_prompt: "已批准的图片提示词",
			image_url: "/static/shots/21-current.png",
			video_url: "/static/shots/21-current.mp4",
			duration: 8,
			camera: "approved camera",
			motion_note: "approved motion",
			character_ids: [1, 2],
			approval_state: "superseded",
			approval_version: 3,
			approved_at: "2026-04-11T10:00:00Z",
			approved_description: "已批准的分镜描述",
			approved_prompt: "已批准的视频提示词",
			approved_image_prompt: "已批准的图片提示词",
			approved_duration: 8,
			approved_camera: "approved camera",
			approved_motion_note: "approved motion",
			approved_character_ids: [1, 2],
		} as never);
		vi.mocked(shotsApi.regenerate).mockResolvedValue({ id: 901 } as never);

		renderOverview();

		const shotRerunButton = await screen.findByRole("button", {
			name: "重新生成视频",
		});
		await user.click(shotRerunButton);

		expect(screen.getByLabelText("分镜描述")).toHaveValue("已批准的分镜描述");
		expect(screen.getByLabelText("视频提示词")).toHaveValue(
			"已批准的视频提示词",
		);
		expect(screen.getByLabelText("图片提示词")).toHaveValue(
			"已批准的图片提示词",
		);
		expect(screen.getByLabelText("时长(秒)")).toHaveValue("8");
		expect(screen.getByLabelText("镜头语言")).toHaveValue("approved camera");
		expect(screen.getByLabelText("运动说明")).toHaveValue("approved motion");
		expect(screen.getByLabelText("角色ID列表")).toHaveValue("1,2");

		await user.clear(screen.getByLabelText("视频提示词"));
		await user.type(
			screen.getByLabelText("视频提示词"),
			"重新生成的视频提示词",
		);
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(shotsApi.update).toHaveBeenCalledWith(21, {
				description: "已批准的分镜描述",
				prompt: "重新生成的视频提示词",
				image_prompt: "已批准的图片提示词",
				duration: 8,
				camera: "approved camera",
				motion_note: "approved motion",
				character_ids: [1, 2],
			});
			expect(shotsApi.regenerate).toHaveBeenCalledWith(21, "video");
		});
	});

	it("handles invalid character id input with parseNumberList", async () => {
		const user = userEvent.setup();
		useEditorStore.getState().setShots([
			{
				id: 22,
				project_id: 7,
				order: 2,
				description: "待处理分镜",
				prompt: "原视频提示词",
				image_prompt: "原图片提示词",
				image_url: "/static/shots/22-current.png",
				video_url: "/static/shots/22-current.mp4",
				duration: 6,
				camera: "原镜头语言",
				motion_note: "原运动说明",
				character_ids: [10, 11],
				approval_state: "approved",
				approval_version: 1,
				approved_at: null,
				approved_description: null,
				approved_prompt: null,
				approved_image_prompt: null,
				approved_duration: null,
				approved_camera: null,
				approved_motion_note: null,
				approved_character_ids: [],
			},
		]);
		vi.mocked(shotsApi.update).mockResolvedValue({
			id: 22,
			project_id: 7,
			order: 2,
			description: "待处理分镜",
			prompt: "原视频提示词",
			image_prompt: "原图片提示词",
			image_url: "/static/shots/22-current.png",
			video_url: "/static/shots/22-current.mp4",
			duration: 6,
			camera: "原镜头语言",
			motion_note: "原运动说明",
			character_ids: [],
			approval_state: "approved",
			approval_version: 1,
			approved_at: null,
			approved_description: null,
			approved_prompt: null,
			approved_image_prompt: null,
			approved_duration: null,
			approved_camera: null,
			approved_motion_note: null,
			approved_character_ids: [],
		} as never);
		vi.mocked(shotsApi.regenerate).mockResolvedValue({ id: 903 } as never);

		renderOverview();

		const shotEditButton = await screen.findByRole("button", {
			name: "编辑",
		});
		await user.click(shotEditButton);

		await user.clear(screen.getByLabelText("角色ID列表"));
		await user.type(screen.getByLabelText("角色ID列表"), "a,b");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(shotsApi.update).toHaveBeenCalledWith(22, {
				description: "待处理分镜",
				prompt: "原视频提示词",
				image_prompt: "原图片提示词",
				duration: 6,
				camera: "原镜头语言",
				motion_note: "原运动说明",
				character_ids: null,
			});
			expect(shotsApi.regenerate).toHaveBeenCalledWith(22, "video");
		});
	});

	it("normalizes invalid duration input as null in shot edit payload", async () => {
		const user = userEvent.setup();
		useEditorStore.getState().setShots([
			{
				id: 23,
				project_id: 7,
				order: 3,
				description: "镜头三",
				prompt: "原视频提示词",
				image_prompt: "原图片提示词",
				image_url: "/static/shots/23-current.png",
				video_url: null,
				duration: 6,
				camera: "镜头语言",
				motion_note: "运动说明",
				character_ids: [5],
				approval_state: "approved",
				approval_version: 1,
				approved_at: null,
				approved_description: null,
				approved_prompt: null,
				approved_image_prompt: null,
				approved_duration: null,
				approved_camera: null,
				approved_motion_note: null,
				approved_character_ids: [],
			} as never,
		]);
		vi.mocked(shotsApi.update).mockResolvedValue({
			id: 23,
			project_id: 7,
			order: 3,
			description: "镜头三",
			prompt: "原视频提示词",
			image_prompt: "原图片提示词",
			image_url: "/static/shots/23-current.png",
			video_url: null,
			duration: 6,
			camera: "镜头语言",
			motion_note: "运动说明",
			character_ids: [5],
			approval_state: "approved",
			approval_version: 1,
			approved_at: null,
			approved_description: null,
			approved_prompt: null,
			approved_image_prompt: null,
			approved_duration: null,
			approved_camera: null,
			approved_motion_note: null,
			approved_character_ids: [],
		} as never);
		vi.mocked(shotsApi.regenerate).mockResolvedValue({ id: 904 } as never);

		renderOverview();

		const shotEditButton = await screen.findByRole("button", {
			name: "编辑",
		});
		await user.click(shotEditButton);

		await user.clear(screen.getByLabelText("时长(秒)"));
		await user.type(screen.getByLabelText("时长(秒)"), "abc");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(shotsApi.update).toHaveBeenCalledWith(23, {
				description: "镜头三",
				prompt: "原视频提示词",
				image_prompt: "原图片提示词",
				duration: null,
				camera: "镜头语言",
				motion_note: "运动说明",
				character_ids: [5],
			});
			expect(shotsApi.regenerate).toHaveBeenCalledWith(23, "video");
		});
	});

	it("renders failed final output state and supports successful retry submission with failed label", async () => {
		const user = userEvent.setup();
		useEditorStore.getState().setProjectVideoUrl("/static/videos/final-failed.mp4");
		useEditorStore.getState().setCurrentRunId(100);
		useEditorStore.getState().setRecoverySummary({
			project_id: 7,
			run_id: 100,
			thread_id: "thread-failed",
			current_stage: "deploy",
			next_stage: null,
			preserved_stages: [],
			stage_history: [],
			resumable: true,
		});
		vi.mocked(projectsApi.get).mockResolvedValue({
			...baseProject,
			status: "failed",
		} as never);
		const feedbackSpy = vi
			.mocked(projectsApi.feedback)
			.mockResolvedValue({ status: "accepted" } as never);

		renderOverview();

		await screen.findByText("来源：合成失败，需要重试");
		expect(screen.getByText("生成失败")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "重试合成" }));
		await waitFor(() => {
			expect(feedbackSpy).toHaveBeenCalledWith(7, expect.stringContaining("thread thread-failed"), 100);
		});
	});

	it("supports normal character edit success path without using superseded snapshot", async () => {
		const user = userEvent.setup();
		useEditorStore.getState().setCharacters([
			{
				id: 88,
				project_id: 7,
				name: "常规角色",
				description: "当前角色简介",
				image_url: "/static/characters/88.png",
				approval_state: "approved",
				approval_version: 1,
				approved_at: null,
				approved_name: null,
				approved_description: null,
				approved_image_url: null,
			} as never,
		]);
		vi.mocked(charactersApi.update).mockResolvedValue({
			id: 88,
			project_id: 7,
			name: "常规角色",
			description: "更新后的角色简介",
			image_url: "/static/characters/88.png",
			approval_state: "approved",
			approval_version: 1,
			approved_at: null,
			approved_name: null,
			approved_description: null,
			approved_image_url: null,
		} as never);
		vi.mocked(charactersApi.regenerate).mockResolvedValue({ id: 908 } as never);

		renderOverview();

		const editButton = await screen.findByRole("button", { name: "编辑" });
		await user.click(editButton);

		expect(screen.getByLabelText("角色描述")).toHaveValue("当前角色简介");
		expect(screen.getByLabelText("主参考图像")).toHaveValue("/static/characters/88.png");

		await user.clear(screen.getByLabelText("角色描述"));
		await user.type(screen.getByLabelText("角色描述"), "更新后的角色简介");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(charactersApi.update).toHaveBeenCalledWith(88, {
				description: "更新后的角色简介",
				image_url: "/static/characters/88.png",
			});
			expect(charactersApi.regenerate).toHaveBeenCalledWith(88);
		});
	});

	it("shows section placeholders without final video controls in empty state", async () => {
		vi.mocked(projectsApi.get).mockResolvedValue({
			...baseProject,
			summary: "夜色中的追踪故事",
			status: "active",
		} as never);

		renderOverview();

		await screen.findByText("故事简介");
		expect(screen.getAllByText("角色正在生成中...")).toHaveLength(1);
		expect(screen.getAllByText("分镜正在生成中...")).toHaveLength(1);
		expect(screen.getByText("暂无最终视频（已跳过视频阶段时可在修复后重试）")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "预览最终视频" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "下载最终视频" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "重试合成" })).toBeInTheDocument();
	});

	it("confirms character deletion and updates local list", async () => {
		const user = userEvent.setup();
		useEditorStore.getState().setCharacters([
			{
				id: 31,
				project_id: 7,
				name: "待删角色",
				description: "需要删除",
				image_url: "/static/characters/31.png",
				approval_state: "approved",
				approval_version: 1,
				approved_at: null,
				approved_name: null,
				approved_description: null,
				approved_image_url: null,
			} as never,
		]);
		vi.mocked(charactersApi.delete).mockResolvedValue({ id: 31, ok: true } as never);

		renderOverview();

		const deleteButton = await screen.findByRole("button", { name: "删除" });
		await user.click(deleteButton);

		const confirmDialog = screen.getByRole("dialog");
		expect(confirmDialog).toHaveTextContent("删除角色");
		const confirmDeleteButton = within(confirmDialog).getByRole("button", {
			name: "删除",
		});
		await user.click(confirmDeleteButton);

		await waitFor(() => {
			expect(charactersApi.delete).toHaveBeenCalledWith(31);
		});

		await waitFor(() => {
			expect(screen.queryByText("待删角色")).not.toBeInTheDocument();
			expect(screen.getByText("角色正在生成中...")).toBeInTheDocument();
		});
	});

	it("确认分镜删除后更新本地列表", async () => {
		const user = userEvent.setup();
		useEditorStore.getState().setShots([
			{
				id: 41,
				project_id: 7,
				order: 1,
				description: "待删分镜",
				prompt: "原视频提示词",
				image_prompt: "原图片提示词",
				image_url: "/static/shots/41.png",
				video_url: null,
				duration: 6,
				camera: "待删镜头语言",
				motion_note: "待删运动说明",
				character_ids: [1],
				approval_state: "approved",
				approval_version: 1,
				approved_at: null,
				approved_description: null,
				approved_prompt: null,
				approved_image_prompt: null,
				approved_duration: null,
				approved_camera: null,
				approved_motion_note: null,
				approved_character_ids: [],
			} as never,
		]);

		vi.mocked(shotsApi.delete).mockResolvedValue({ id: 41, ok: true } as never);

		renderOverview();

		const deleteButton = await screen.findByRole("button", { name: "删除" });
		await user.click(deleteButton);

		const confirmDialog = screen.getByRole("dialog");
		expect(confirmDialog).toHaveTextContent("删除分镜");
		const confirmButton = within(confirmDialog).getByRole("button", { name: "删除" });
		await user.click(confirmButton);

		await waitFor(() => {
			expect(shotsApi.delete).toHaveBeenCalledWith(41);
			expect(screen.getByText("分镜正在生成中...")).toBeInTheDocument();
		});
	});

	it("关闭角色编辑弹窗不会触发保存", async () => {
		const user = userEvent.setup();
		useEditorStore.getState().setCharacters([
			{
				id: 55,
				project_id: 7,
				name: "关闭不保存",
				description: "原角色描述",
				image_url: "/static/characters/55.png",
				approval_state: "approved",
				approval_version: 1,
				approved_at: null,
				approved_name: null,
				approved_description: null,
				approved_image_url: null,
			} as never,
		]);

		renderOverview();

		const editButton = await screen.findByRole("button", { name: "编辑" });
		await user.click(editButton);

		await screen.findByText("编辑角色并重新生成");
		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(screen.getByText("关闭不保存")).toBeInTheDocument();
		expect(charactersApi.update).not.toHaveBeenCalled();
	});

	it("关闭分镜编辑弹窗不会触发保存", async () => {
		const user = userEvent.setup();
		useEditorStore.getState().setShots([
			{
				id: 56,
				project_id: 7,
				order: 1,
				description: "原分镜",
				prompt: "原提示词",
				image_prompt: "原图片提示词",
				image_url: "/static/shots/56.png",
				video_url: null,
				duration: 6,
				camera: "原镜头",
				motion_note: "原动作",
				character_ids: [1],
				approval_state: "approved",
				approval_version: 1,
				approved_at: null,
				approved_description: null,
				approved_prompt: null,
				approved_image_url: null,
				approved_duration: null,
				approved_camera: null,
				approved_motion_note: null,
				approved_character_ids: [],
			} as never,
		]);

		renderOverview();

		const editButton = await screen.findByRole("button", { name: "编辑" });
		await user.click(editButton);

		await screen.findByText("编辑分镜并重新生成");
		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(screen.getByText("原分镜")).toBeInTheDocument();
		expect(shotsApi.update).not.toHaveBeenCalled();
	});

	it("分镜" + "重新生成图片" + "触发图片重生成", async () => {
		const user = userEvent.setup();
		useEditorStore.getState().setShots([
			{
				id: 58,
				project_id: 7,
				order: 1,
				description: "分镜用于图片重生成",
				prompt: "prompt",
				image_prompt: "img-prompt",
				image_url: "/static/shots/58-image.png",
				video_url: null,
				duration: 7,
				camera: "镜头",
				motion_note: "运动",
				character_ids: [1],
				approval_state: "approved",
				approval_version: 1,
				approved_at: null,
				approved_description: null,
				approved_prompt: null,
				approved_image_prompt: null,
				approved_duration: null,
				approved_camera: null,
				approved_motion_note: null,
				approved_character_ids: [],
			} as never,
		]);

		vi.mocked(shotsApi.regenerate).mockResolvedValue({ id: 905 } as never);

		renderOverview();

		const redoImageButton = await screen.findByRole("button", {
			name: "重新生成图片",
		});
		await user.click(redoImageButton);

		expect(shotsApi.regenerate).toHaveBeenCalledWith(58, "image");
	});

	it("character edit fallback branch handles missing approved image and description", async () => {
		const user = userEvent.setup();
		useEditorStore.getState().setCharacters([
			{
				id: 59,
				project_id: 7,
				name: "无已批准快照角色",
				description: "当前角色说明",
				image_url: "/static/characters/59.png",
				approval_state: "superseded",
				approval_version: 2,
				approved_at: "2026-04-11T10:00:00Z",
				approved_name: "无已批准快照角色",
				approved_description: null,
				approved_image_url: null,
			},
		] as never);

		renderOverview();

		const editButton = await screen.findByRole("button", { name: "编辑" });
		await user.click(editButton);

		await waitFor(() => {
			expect(screen.getByLabelText("角色描述")).toHaveValue("当前角色说明");
			expect(screen.getByLabelText("主参考图像")).toHaveValue(
				"/static/characters/59.png",
			);
		});
	});

	it("关闭分镜删除弹窗不会触发删除", async () => {
		const user = userEvent.setup();
		useEditorStore.getState().setShots([
			{
				id: 42,
				project_id: 7,
				order: 2,
				description: "不删除分镜",
				prompt: "原视频提示词",
				image_prompt: "原图片提示词",
				image_url: "/static/shots/42.png",
				video_url: null,
				duration: 6,
				camera: "镜头语言",
				motion_note: "运动说明",
				character_ids: [1],
				approval_state: "approved",
				approval_version: 1,
				approved_at: null,
				approved_description: null,
				approved_prompt: null,
				approved_image_prompt: null,
				approved_duration: null,
				approved_camera: null,
				approved_motion_note: null,
				approved_character_ids: [],
			} as never,
		]);

		renderOverview();

		const deleteButton = await screen.findByRole("button", { name: "删除" });
		await user.click(deleteButton);

		const confirmDialog = screen.getByRole("dialog");
		expect(confirmDialog).toHaveTextContent("删除分镜");
		const cancelButton = within(confirmDialog).getByRole("button", { name: "取消" });
		await user.click(cancelButton);

		expect(shotsApi.delete).not.toHaveBeenCalled();
		expect(screen.getByText("不删除分镜")).toBeInTheDocument();
	});

	it("关闭角色删除弹窗不会触发删除", async () => {
		const user = userEvent.setup();
		useEditorStore.getState().setCharacters([
			{
				id: 57,
				project_id: 7,
				name: "不删除角色",
				description: "不希望删除",
				image_url: "/static/characters/57.png",
				approval_state: "approved",
				approval_version: 1,
				approved_at: null,
				approved_name: null,
				approved_description: null,
				approved_image_url: null,
			} as never,
		]);

		renderOverview();

		const deleteButton = await screen.findByRole("button", { name: "删除" });
		await user.click(deleteButton);

		const confirmDialog = screen.getByRole("dialog");
		expect(confirmDialog).toHaveTextContent("删除角色");
		const cancelButton = within(confirmDialog).getByRole("button", { name: "取消" });
		await user.click(cancelButton);

		expect(charactersApi.delete).not.toHaveBeenCalled();
		expect(screen.getByText("不删除角色")).toBeInTheDocument();
	});

	it("hovering shot video preview triggers hover play/pause handlers", async () => {
		useEditorStore.getState().setShots([
			{
				id: 60,
				project_id: 7,
				order: 1,
				description: "带视频分镜",
				prompt: "prompt",
				image_prompt: "image-prompt",
				image_url: null,
				video_url: "/static/shots/60-video.mp4",
				duration: 4,
				camera: "镜头",
				motion_note: "运动",
				character_ids: [1],
				approval_state: "approved",
				approval_version: 1,
				approved_at: null,
				approved_description: null,
				approved_prompt: null,
				approved_image_prompt: null,
				approved_duration: null,
				approved_camera: null,
				approved_motion_note: null,
				approved_character_ids: [],
			} as never,
		]);

		const playSpy = vi
			.spyOn(window.HTMLVideoElement.prototype, "play")
			.mockResolvedValue(undefined);
		const pauseSpy = vi
			.spyOn(window.HTMLVideoElement.prototype, "pause")
			.mockImplementation(() => undefined);

		renderOverview();

		const shotVideoButton = (await screen.findAllByRole("button")).find(
			(button) => button.querySelector("video"),
		);
		expect(shotVideoButton).not.toBeNull();
		const videoEl = shotVideoButton!.querySelector("video") as HTMLVideoElement;

		Object.defineProperty(videoEl, "currentTime", {
			value: 5,
			writable: true,
		});

		fireEvent.mouseEnter(videoEl);
		expect(playSpy).toHaveBeenCalledTimes(1);

		fireEvent.mouseLeave(videoEl);
		expect(pauseSpy).toHaveBeenCalledTimes(1);
		expect(videoEl.currentTime).toBe(0);

		playSpy.mockRestore();
		pauseSpy.mockRestore();
	});

	it("opens shot video preview modal from card and closes it", async () => {
		const user = userEvent.setup();
		useEditorStore.getState().setShots([
			{
				id: 61,
				project_id: 7,
				order: 1,
				description: "仅视频分镜",
				prompt: "prompt",
				image_prompt: "image-prompt",
				image_url: "/static/shots/61-image.png",
				video_url: "/static/shots/61-video.mp4",
				duration: 3,
				camera: "镜头",
				motion_note: "运动",
				character_ids: [1],
				approval_state: "approved",
				approval_version: 1,
				approved_at: null,
				approved_description: null,
				approved_prompt: null,
				approved_image_prompt: null,
				approved_duration: null,
				approved_camera: null,
				approved_motion_note: null,
				approved_character_ids: [],
			} as never,
		]);

		renderOverview();

		const shotVideoButton = (await screen.findAllByRole("button")).find(
			(button) => button.querySelector("video"),
		);
		expect(shotVideoButton).not.toBeNull();
		await user.click(shotVideoButton as Element);

		const shotVideoDialog = await screen.findByRole("dialog", {
			name: "视频预览：镜头 1",
		});
		expect(shotVideoDialog).toBeInTheDocument();

		await user.click(within(shotVideoDialog).getByRole("button", { name: "关闭" }));
		expect(
			screen.queryByRole("dialog", { name: "视频预览：镜头 1" }),
		).not.toBeInTheDocument();
	});

	it("resets regenerating shot state when regenerate fails", async () => {
		const user = userEvent.setup();
		useEditorStore.getState().setShots([
			{
				id: 62,
				project_id: 7,
				order: 1,
				description: "失败重试镜头",
				prompt: "prompt",
				image_prompt: "image-prompt",
				image_url: "/static/shots/62-image.png",
				video_url: null,
				duration: 3,
				camera: "镜头",
				motion_note: "运动",
				character_ids: [1],
				approval_state: "approved",
				approval_version: 1,
				approved_at: null,
				approved_description: null,
				approved_prompt: null,
				approved_image_prompt: null,
				approved_duration: null,
				approved_camera: null,
				approved_motion_note: null,
				approved_character_ids: [],
			} as never,
		]);

		vi.mocked(shotsApi.regenerate).mockRejectedValueOnce(new Error("regen fail") as never);

		renderOverview();

		const redoImageButton = await screen.findByRole("button", {
			name: "重新生成图片",
		});
		await user.click(redoImageButton);

		await waitFor(() => {
			expect(shotsApi.regenerate).toHaveBeenCalledWith(62, "image");
		});
	});

	it("opens character rerun editing from the approved reference image before rerunning", async () => {
		const user = userEvent.setup();
		useEditorStore.getState().setCharacters([
			{
				id: 11,
				project_id: 7,
				name: "阿宁",
				description: "当前角色描述",
				image_url: "/static/characters/11-current.png",
				approval_state: "superseded",
				approval_version: 4,
				approved_at: "2026-04-11T10:00:00Z",
				approved_name: "阿宁",
				approved_description: "已批准的角色描述",
				approved_image_url: "/static/characters/11-approved.png",
			},
		]);
		vi.mocked(charactersApi.update).mockResolvedValue({
			id: 11,
			project_id: 7,
			name: "阿宁",
			description: "更新后的角色描述",
			image_url: "/static/characters/11-approved.png",
			approval_state: "superseded",
			approval_version: 4,
			approved_at: "2026-04-11T10:00:00Z",
			approved_name: "阿宁",
			approved_description: "已批准的角色描述",
			approved_image_url: "/static/characters/11-approved.png",
		} as never);
		vi.mocked(charactersApi.regenerate).mockResolvedValue({ id: 902 } as never);

		renderOverview();

		const characterRerunButton = await screen.findByRole("button", {
			name: "重新生成",
		});
		await user.click(characterRerunButton);

		expect(screen.getByLabelText("角色描述")).toHaveValue("已批准的角色描述");
		expect(screen.getByLabelText("主参考图像")).toHaveValue(
			"/static/characters/11-approved.png",
		);

		await user.clear(screen.getByLabelText("角色描述"));
		await user.type(screen.getByLabelText("角色描述"), "更新后的角色描述");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(charactersApi.update).toHaveBeenCalledWith(11, {
				description: "更新后的角色描述",
				image_url: "/static/characters/11-approved.png",
			});
			expect(charactersApi.regenerate).toHaveBeenCalledWith(11);
      });
  });

  it("keeps the final merged video visible with preview, download, and retry controls", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      blob: async () => new Blob(["final-video"]),
    } as never);

    useEditorStore.getState().setProjectVideoUrl("/static/videos/final-current.mp4");
    useEditorStore.getState().setCurrentRunId(42);
    useEditorStore.getState().setRecoverySummary({
      project_id: 7,
      run_id: 42,
      thread_id: "thread_42",
      current_stage: "deploy",
      next_stage: null,
      preserved_stages: [],
      stage_history: [],
      resumable: true,
    });

    const feedbackSpy = vi.mocked(projectsApi.feedback).mockResolvedValue({
      status: "accepted",
    } as never);

    renderOverview();

    await screen.findByRole("button", { name: "预览最终视频" });
    expect(screen.getByRole("button", { name: "预览最终视频" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下载最终视频" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试合成" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "预览最终视频" }));
    expect(screen.getByRole("dialog", { hidden: true })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "下载最终视频" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/projects/7/final-video");

    await user.click(screen.getByRole("button", { name: "重试合成" }));
    await waitFor(() => {
      expect(feedbackSpy).toHaveBeenCalledWith(
        7,
        expect.stringContaining("thread_42"),
        42
      );
    });

		fetchMock.mockRestore();
	});

	it("can open and close final video preview modal", async () => {
		const user = userEvent.setup();
		useEditorStore.getState().setProjectVideoUrl("/static/videos/final-current.mp4");
		vi.mocked(projectsApi.get).mockResolvedValue({
			...baseProject,
			status: "completed",
			video_url: "/static/videos/final-current.mp4",
		} as never);

		renderOverview();

		await screen.findByRole("button", { name: "预览最终视频" });
		await user.click(screen.getByRole("button", { name: "预览最终视频" }));

		const previewModal = await screen.findByRole("dialog", {
			name: "视频预览：创意项目",
		});
		expect(previewModal).toBeInTheDocument();

		await user.click(within(previewModal).getByRole("button", { name: "关闭" }));
		expect(
			screen.queryByRole("dialog", { name: "视频预览：创意项目" }),
		).not.toBeInTheDocument();
	});

	it("falls back with an error toast when final video download returns a non-OK response", async () => {
		const user = userEvent.setup();
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
			ok: false,
			status: 500,
			blob: async () => new Blob(["error-page"]),
		} as never);
		const openMock = vi.spyOn(window, "open").mockImplementation(() => null);
		const toastErrorSpy = vi.spyOn(toast, "error").mockImplementation(() => undefined);

		useEditorStore.getState().setProjectVideoUrl("/static/videos/final-current.mp4");

		renderOverview();

		await screen.findByRole("button", { name: "预览最终视频" });
		await user.click(screen.getByRole("button", { name: "下载最终视频" }));

		await waitFor(() => {
			expect(toastErrorSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					title: "下载失败",
				}),
			);
		});
		expect(openMock).toHaveBeenCalledWith("/api/v1/projects/7/final-video", "_blank");

		fetchMock.mockRestore();
		openMock.mockRestore();
		toastErrorSpy.mockRestore();
	});

	it("shows a retry error toast when final video rerun submission fails", async () => {
		const user = userEvent.setup();
		const toastErrorSpy = vi.spyOn(toast, "error").mockImplementation(() => undefined);
		vi.mocked(projectsApi.feedback).mockRejectedValue(new Error("network down") as never);

		useEditorStore.getState().setProjectVideoUrl("/static/videos/final-current.mp4");
		useEditorStore.getState().setCurrentRunId(42);
		vi.mocked(projectsApi.get).mockResolvedValue({
			...baseProject,
			status: "completed",
			video_url: "/static/videos/final-current.mp4",
		} as never);

		renderOverview();

		await screen.findByRole("button", { name: "预览最终视频" });
		await user.click(screen.getByRole("button", { name: "重试合成" }));

		await waitFor(() => {
			expect(toastErrorSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					title: "重试失败",
				}),
			);
		});

		toastErrorSpy.mockRestore();
	});
});

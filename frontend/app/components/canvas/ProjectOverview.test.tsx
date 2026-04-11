import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { charactersApi, projectsApi, shotsApi } from "~/services/api";
import { useEditorStore } from "~/stores/editorStore";
import { ProjectOverview } from "./ProjectOverview";

vi.mock("~/services/api", () => ({
	projectsApi: {
		get: vi.fn(),
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
});

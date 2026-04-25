import { expect, test, type Page } from "@playwright/test";

type JsonValue = Record<string, unknown> | unknown[];

declare global {
	interface Window {
		__mockWs: {
			count: () => number;
			dispatch: (event: Record<string, unknown>) => void;
		};
	}
}

const baseProject = {
	id: 7,
	title: "创意项目",
	story: null,
	style: null,
	summary: "夜色中的追踪故事",
	video_url: null,
	status: "active",
	provider_settings: {
		text: {
			selected_key: "openai",
			resolved_key: "openai",
			source: "project",
			valid: true,
			status: "valid",
			reason_message: null,
		},
		image: {
			selected_key: "fal",
			resolved_key: "fal",
			source: "project",
			valid: true,
			status: "valid",
			reason_message: null,
		},
		video: {
			selected_key: "runway",
			resolved_key: "runway",
			source: "project",
			valid: true,
			status: "valid",
			reason_message: null,
		},
	},
	created_at: "2026-04-18T00:00:00Z",
	updated_at: "2026-04-18T00:00:00Z",
};

async function installMockWebSocket(page: Page) {
	await page.addInitScript(() => {
		class MockWebSocket {
			static instances: MockWebSocket[] = [];
			static OPEN = 1;
			static CLOSED = 3;

			url: string;
			readyState = MockWebSocket.OPEN;
			onopen: null | ((event?: Event) => void) = null;
			onmessage: null | ((event: MessageEvent<string>) => void) = null;
			onerror: null | ((event?: Event) => void) = null;
			onclose: null | ((event?: Event) => void) = null;

			constructor(url: string) {
				this.url = url;
				MockWebSocket.instances.push(this);
				queueMicrotask(() => this.onopen?.(new Event("open")));
			}

			send(_data: string) {}

			close() {
				this.readyState = MockWebSocket.CLOSED;
				this.onclose?.(new Event("close"));
			}
		}

		Object.defineProperty(window, "WebSocket", {
			configurable: true,
			writable: true,
			value: MockWebSocket,
		});

		window.__mockWs = {
			count: () => MockWebSocket.instances.length,
			dispatch: (event: Record<string, unknown>) => {
				const activeSocket = MockWebSocket.instances.at(-1);
				if (!activeSocket?.onmessage) {
					throw new Error("No active mock websocket instance");
				}

				activeSocket.onmessage(
					new MessageEvent("message", {
						data: JSON.stringify(event),
					}),
				);
			},
		};
	});
}

async function mockProjectPageApis(
	page: Page,
	options?: {
		project?: Record<string, unknown>;
		characters?: JsonValue;
		shots?: JsonValue;
		messages?: JsonValue;
		generateResponse?: { status: number; body: JsonValue };
		resumeResponse?: JsonValue;
	},
) {
	const state = {
		generateCalls: 0,
		resumeCalls: 0,
	};

	const project = options?.project ?? baseProject;
	const characters = options?.characters ?? [];
	const shots = options?.shots ?? [];
	const messages = options?.messages ?? [];

	await page.route("**/api/v1/**", async (route) => {
		const url = new URL(route.request().url());
		const method = route.request().method();
		const path = url.pathname;

		const fulfillJson = async (body: JsonValue, status = 200) => {
			await route.fulfill({
				status,
				contentType: "application/json",
				body: JSON.stringify(body),
			});
		};

		if (path === "/api/v1/config" && method === "GET") {
			return fulfillJson([]);
		}

		if (path === "/api/v1/projects" && method === "GET") {
			return fulfillJson({ items: [project], total: 1 });
		}

		if (path === "/api/v1/projects/7" && method === "GET") {
			return fulfillJson(project);
		}

		if (path === "/api/v1/projects/7/characters" && method === "GET") {
			return fulfillJson(characters);
		}

		if (path === "/api/v1/projects/7/shots" && method === "GET") {
			return fulfillJson(shots);
		}

		if (path === "/api/v1/projects/7/messages" && method === "GET") {
			return fulfillJson(messages);
		}

		if (path === "/api/v1/projects/7/generate" && method === "POST") {
			state.generateCalls += 1;
			if (options?.generateResponse) {
				return fulfillJson(
					options.generateResponse.body,
					options.generateResponse.status,
				);
			}

			return fulfillJson({
				id: 901,
				current_agent: "scriptwriter",
				progress: 0,
				provider_snapshot: null,
			});
		}

		if (path === "/api/v1/projects/7/resume" && method === "POST") {
			state.resumeCalls += 1;
			return fulfillJson(
				options?.resumeResponse ?? {
					id: 501,
					current_agent: "scriptwriter",
					progress: 0.25,
					provider_snapshot: null,
				},
			);
		}

		return fulfillJson({ error: { message: `Unhandled route: ${method} ${path}` } }, 404);
	});

	return state;
}

test.beforeEach(async ({ page }) => {
	await installMockWebSocket(page);
});

test("canvas progressively reveals sections and stage header follows websocket progress", async ({
	page,
}) => {
	await mockProjectPageApis(page);

	await page.goto("/project/7");
	await page.waitForLoadState("networkidle");

	await expect
		.poll(() =>
			page.evaluate(() => window.__mockWs.count()),
		)
		.toBeGreaterThan(0);

	await expect(page.getByText("构思阶段")).toBeVisible();
	await expect(page.getByRole("heading", { name: "编剧" })).toBeVisible();
	await expect(page.getByText("剧本摘要")).toBeVisible();
	await expect(page.getByRole("heading", { name: "角色设计师" })).toHaveCount(0);
	await expect(page.getByRole("heading", { name: "分镜图" })).toHaveCount(0);
	await expect(page.getByRole("button", { name: "预览最终视频" })).toHaveCount(0);

	await page.evaluate(() => {
		window.__mockWs.dispatch({
			type: "run_started",
			data: {
				run_id: 1001,
				current_agent: "scriptwriter",
				current_stage: "script",
				stage: "script",
				progress: 0.1667,
			},
		});
	});

	await expect(page.getByText("剧本阶段")).toBeVisible();
	await expect(page.getByRole("heading", { name: "角色设计师" })).toHaveCount(0);

	await page.evaluate(() => {
		window.__mockWs.dispatch({
			type: "run_progress",
			data: {
				current_agent: "character_artist",
				current_stage: "character",
				stage: "character",
				progress: 0.3333,
			},
		});
	});

	await expect(page.getByText("角色阶段")).toBeVisible();
	await expect(page.getByRole("heading", { name: "角色设计师" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "分镜图" })).toHaveCount(0);

	await page.evaluate(() => {
		window.__mockWs.dispatch({
			type: "run_progress",
			data: {
				current_agent: "storyboard_artist",
				current_stage: "storyboard",
				stage: "storyboard",
				progress: 0.5,
			},
		});
	});

	await expect(page.getByText("分镜阶段")).toBeVisible();
	await expect(page.getByRole("heading", { name: "分镜图" })).toBeVisible();
	await expect(page.getByRole("button", { name: "预览最终视频" })).toHaveCount(0);

	await page.evaluate(() => {
		window.__mockWs.dispatch({
			type: "run_awaiting_confirm",
			data: {
				run_id: 1001,
				agent: "storyboard_artist",
				message: "分镜已生成，请确认后继续。",
				current_stage: "storyboard_approval",
				stage: "storyboard_approval",
				recovery_summary: {
					current_stage: "storyboard_approval",
					next_stage: "clip",
					preserved_stages: ["script", "character", "storyboard"],
				},
			},
		});
	});

	await expect(page.getByText("分镜阶段")).toBeVisible();
	await expect(page.getByText("待审核").first()).toBeVisible();
	await expect(page.getByRole("button", { name: /满意，继续下一步|继续/ })).toBeVisible();

	await page.evaluate(() => {
		window.__mockWs.dispatch({
			type: "run_progress",
			data: {
				current_agent: "video_merger",
				current_stage: "merge",
				stage: "merge",
				progress: 0.8333,
			},
		});
	});

	await expect(page.getByText("合成阶段")).toBeVisible();
});

test("recovery card keeps approval checkpoint as resume target", async ({ page }) => {
	const routes = await mockProjectPageApis(page, {
		generateResponse: {
			status: 409,
			body: {
				state: "recoverable",
				detail: "运行停在审批节点，可继续恢复。",
				thread_id: "thread-approval-7",
				active_run: {
					id: 2002,
					current_agent: "scriptwriter",
					progress: 0.25,
					provider_snapshot: null,
				},
				recovery_summary: {
					current_stage: "script_approval",
					next_stage: "script_approval",
					preserved_stages: ["script"],
				},
			},
		},
		resumeResponse: {
			id: 2002,
			current_agent: "scriptwriter",
			progress: 0.25,
			provider_snapshot: null,
		},
	});

	await page.goto("/project/7");
	await page.waitForLoadState("networkidle");

	await page.getByRole("button", { name: "开始生成" }).click();

	await expect(page.getByText("运行停在审批节点，可继续恢复。")).toBeVisible();
	await expect(page.getByText("script_approval")).toBeVisible();
	await expect(page.getByText("thread-approval-7")).toBeVisible();
	await expect(page.getByText("script", { exact: true })).toBeVisible();

	await page.getByRole("button", { name: "恢复运行" }).click();

	await expect.poll(() => routes.generateCalls).toBe(1);
	await expect.poll(() => routes.resumeCalls).toBe(1);
	await expect(page.getByText("剧本阶段")).toBeVisible();
	await expect(page.getByRole("button", { name: "恢复运行" })).toHaveCount(0);
});

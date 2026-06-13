import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StagePipeline } from "./StagePipeline";

function renderStagePipeline(props: Partial<Parameters<typeof StagePipeline>[0]> = {}) {
	return render(
		<StagePipeline
			currentStage="plan"
			isGenerating={false}
			awaitingConfirm={false}
			hasRecovery={false}
			onResume={vi.fn()}
			onCancel={vi.fn()}
			{...props}
		/>,
	);
}

describe("StagePipeline", () => {
	it("opens the chat drawer from the compact chat action", async () => {
		const user = userEvent.setup();
		const onToggleChat = vi.fn();

		renderStagePipeline({ onToggleChat });

		await user.click(screen.getByRole("button", { name: "打开对话面板" }));

		expect(onToggleChat).toHaveBeenCalledTimes(1);
	});

	it("omits the chat action when no handler is provided", () => {
		renderStagePipeline();

		expect(
			screen.queryByRole("button", { name: "打开对话面板" }),
		).not.toBeInTheDocument();
	});
});

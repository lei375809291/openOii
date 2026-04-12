import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ImagePreviewModal, VideoPreviewModal } from "./PreviewModals";

describe("PreviewModals", () => {
	it("keeps the image preview open when interacting with the image itself", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		render(<ImagePreviewModal src="/img.png" alt="封面图" onClose={onClose} />);

		await user.click(screen.getByAltText("封面图"));
		expect(onClose).not.toHaveBeenCalled();

		await user.click(screen.getByRole("dialog"));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("keeps the video preview open when interacting with the video element", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		render(<VideoPreviewModal src="/video.mp4" title="最终视频" onClose={onClose} />);

		const video = screen.getByRole("dialog").querySelector("video");
		if (!video) {
			throw new Error("video element not found");
		}
		await user.click(video);
		expect(onClose).not.toHaveBeenCalled();

		await user.click(screen.getByRole("dialog"));
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});

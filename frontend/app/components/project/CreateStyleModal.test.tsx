import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateStyleModal } from "./CreateStyleModal";
import { styleTemplatesApi } from "~/services/api";

vi.mock("~/services/api", () => ({
  styleTemplatesApi: {
    create: vi.fn(),
  },
}));

vi.mock("~/utils/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CreateStyleModal isOpen onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("CreateStyleModal", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes generated slugs to the backend slug pattern before create", async () => {
    const user = userEvent.setup();
    vi.mocked(styleTemplatesApi.create).mockResolvedValue({
      id: 1,
      name: "Cyber Punk",
      slug: "cyber-punk",
      category: "custom",
      description: null,
      style_prompt: "neon city",
      color_palette: [],
      negative_prompt: null,
      preview_image_url: null,
      sort_order: 0,
      is_active: true,
      created_at: "2026-06-13T00:00:00Z",
      updated_at: "2026-06-13T00:00:00Z",
    });

    renderModal();

    await user.type(screen.getByLabelText("风格名称"), "Cyber Punk!!");
    await user.type(screen.getByLabelText("风格提示词 (Style Prompt)"), "neon city");

    expect(screen.getByLabelText("Slug（URL标识）")).toHaveValue("cyber-punk");
    await user.click(screen.getByText("创建", { selector: "button" }));

    await waitFor(() => {
      expect(styleTemplatesApi.create).toHaveBeenCalled();
    });
    expect(vi.mocked(styleTemplatesApi.create).mock.calls[0][0]).toEqual(
      expect.objectContaining({ slug: "cyber-punk" }),
    );
  });

  it("does not submit a slug that the backend would reject", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText("风格名称"), "赛博朋克");
    await user.type(screen.getByLabelText("风格提示词 (Style Prompt)"), "neon city");

    expect(screen.getByLabelText("Slug（URL标识）")).toHaveValue("");
    expect(screen.getByText("创建", { selector: "button" })).toBeDisabled();
    expect(styleTemplatesApi.create).not.toHaveBeenCalled();
  });
});

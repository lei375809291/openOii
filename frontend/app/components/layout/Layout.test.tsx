import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Layout } from "./Layout";

vi.mock("./Sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>,
}));

vi.mock("~/stores/sidebarStore", () => ({
  useSidebarStore: vi.fn(() => ({ isOpen: false })),
}));

describe("Layout", () => {
  it("renders children", () => {
    render(<Layout><div>content</div></Layout>);
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("renders sidebar by default", () => {
    render(<Layout><div>content</div></Layout>);
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });

  it("hides sidebar when showSidebar is false", () => {
    render(<Layout showSidebar={false}><div>content</div></Layout>);
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
  });

  it("includes skip-to-content link", () => {
    render(<Layout><div>content</div></Layout>);
    expect(screen.getByText("跳到主内容")).toBeInTheDocument();
  });
});

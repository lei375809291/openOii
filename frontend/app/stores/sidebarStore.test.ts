import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("zustand/middleware", () => ({
  persist: (fn: any) => fn,
}));

import { useSidebarStore } from "./sidebarStore";

describe("sidebarStore", () => {
  beforeEach(() => {
    useSidebarStore.setState({ isOpen: true });
  });

  it("starts with isOpen true by default", () => {
    expect(useSidebarStore.getState().isOpen).toBe(true);
  });

  it("toggle flips isOpen", () => {
    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().isOpen).toBe(false);
    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().isOpen).toBe(true);
  });

  it("open sets isOpen to true", () => {
    useSidebarStore.setState({ isOpen: false });
    useSidebarStore.getState().open();
    expect(useSidebarStore.getState().isOpen).toBe(true);
  });

  it("close sets isOpen to false", () => {
    useSidebarStore.getState().close();
    expect(useSidebarStore.getState().isOpen).toBe(false);
  });
});

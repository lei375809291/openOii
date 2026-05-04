import { describe, it, expect, vi } from "vitest";

vi.mock("zustand/middleware", () => ({
  persist: (fn: any) => fn,
}));

// Import after mock so persist is a no-op (no localStorage needed)
const { useThemeStore } = await import("./themeStore");

describe("themeStore", () => {
  it("defaults to doodle theme", () => {
    expect(useThemeStore.getState().theme).toBe("doodle");
  });

  it("toggleTheme switches to doodle-dark", () => {
    useThemeStore.getState().setTheme("doodle");
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("doodle-dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("doodle-dark");
  });

  it("toggleTheme toggles back to doodle", () => {
    useThemeStore.getState().setTheme("doodle-dark");
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("doodle");
    expect(document.documentElement.getAttribute("data-theme")).toBe("doodle");
  });

  it("setTheme sets specific theme", () => {
    useThemeStore.getState().setTheme("doodle-dark");
    expect(useThemeStore.getState().theme).toBe("doodle-dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("doodle-dark");
  });
});

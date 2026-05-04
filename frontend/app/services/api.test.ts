import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getStaticUrl } from "./api";

vi.mock("~/utils/runtimeBase", () => ({
  getApiBase: () => "http://localhost:18765",
}));

describe("getStaticUrl", () => {
  it("returns null for null/undefined/empty", () => {
    expect(getStaticUrl(null)).toBeNull();
    expect(getStaticUrl(undefined)).toBeNull();
    expect(getStaticUrl("")).toBeNull();
  });

  it("passes through valid http URLs", () => {
    expect(getStaticUrl("http://example.com/img.png")).toBe("http://example.com/img.png");
  });

  it("passes through valid https URLs", () => {
    expect(getStaticUrl("https://example.com/img.png")).toBe("https://example.com/img.png");
  });

  it("blocks javascript: protocol", () => {
    expect(getStaticUrl("javascript:alert(1)")).toBeNull();
  });

  it("blocks data: protocol", () => {
    expect(getStaticUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("blocks vbscript: protocol", () => {
    expect(getStaticUrl("vbscript:msgbox")).toBeNull();
  });

  it("blocks file: protocol", () => {
    expect(getStaticUrl("file:///etc/passwd")).toBeNull();
  });

  it("blocks about: protocol", () => {
    expect(getStaticUrl("about:blank")).toBeNull();
  });

  it("prepends API_BASE to relative paths", () => {
    const result = getStaticUrl("/static/videos/test.mp4");
    expect(result).toContain("/static/videos/test.mp4");
  });

  it("trims whitespace", () => {
    const result = getStaticUrl("  /static/test.png  ");
    expect(result).toContain("/static/test.png");
  });

  it("returns null for invalid URL with http prefix", () => {
    expect(getStaticUrl("http://")).toBeNull();
  });
});

describe("fetchApi", () => {
  const mockFetch = vi.fn();
  let projectsApi: typeof import("./api").projectsApi;

  beforeEach(async () => {
    vi.stubGlobal("fetch", mockFetch);
    const mod = await import("./api");
    projectsApi = mod.projectsApi;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed data on 200", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [{ id: 1 }], total: 1 }), { status: 200 })
    );
    const result = await projectsApi.list();
    expect(result).toEqual([{ id: 1 }]);
  });

  it("returns undefined for 204", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await projectsApi.delete(1);
    // no error = success
  });

  it("throws on non-ok response with error body", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found" } }),
        { status: 404 }
      )
    );
    await expect(projectsApi.get(999)).rejects.toThrow("Not found");
  });

  it("throws on non-ok with non-JSON body", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("Internal error", { status: 500 })
    );
    await expect(projectsApi.get(1)).rejects.toThrow();
  });

  it("throws NETWORK_ERROR on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(projectsApi.get(1)).rejects.toThrow("网络连接失败");
  });
});

describe("projectsApi", () => {
  const mockFetch = vi.fn();
  let projectsApi: typeof import("./api").projectsApi;

  beforeEach(async () => {
    vi.stubGlobal("fetch", mockFetch);
    const mod = await import("./api");
    projectsApi = mod.projectsApi;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("list returns items array", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ items: [{ id: 1, name: "p1" }], total: 1 }),
        { status: 200 }
      )
    );
    const result = await projectsApi.list();
    expect(result).toEqual([{ id: 1, name: "p1" }]);
  });

  it("get fetches single project", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1, name: "p1" }), { status: 200 })
    );
    const result = await projectsApi.get(1);
    expect(result).toEqual({ id: 1, name: "p1" });
  });

  it("create sends POST with body", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 2 }), { status: 201 })
    );
    await projectsApi.create({ title: "new" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/projects"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("update sends PUT with body", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1 }), { status: 200 })
    );
    await projectsApi.update(1, { title: "updated" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/projects/1"),
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("delete sends DELETE", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await projectsApi.delete(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/projects/1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("generate sends POST", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1, status: "running" }), { status: 200 })
    );
    await projectsApi.generate(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/projects/1/generate"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("cancel sends POST", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "cancelled", cancelled: 1 }), { status: 200 })
    );
    const result = await projectsApi.cancel(1);
    expect(result).toEqual({ status: "cancelled", cancelled: 1 });
  });

  it("feedback sends POST with content", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "ok" }), { status: 200 })
    );
    await projectsApi.feedback(1, "good");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/projects/1/feedback"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("deleteMany sends batch delete POST", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await projectsApi.deleteMany([1, 2, 3]);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/projects/batch-delete"),
      expect.objectContaining({ method: "POST" })
    );
  });
});

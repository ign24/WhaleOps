import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { GET } from "@/app/api/workspace/tree/route";

const authMock = vi.mocked(auth);

describe("GET /api/workspace/tree", () => {
  beforeEach(() => {
    authMock.mockReset();
    vi.restoreAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null as never);
    const request = new NextRequest("http://localhost/api/workspace/tree?path=/tmp/analysis");

    const response = await GET(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when path query is missing", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    const request = new NextRequest("http://localhost/api/workspace/tree");

    const response = await GET(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "path parameter required" });
  });

  it("returns 400 on path traversal with double-dot", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    const request = new NextRequest("http://localhost/api/workspace/tree?path=../../etc/passwd");

    const response = await GET(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid path" });
  });

  it("returns 400 on encoded path traversal", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    const request = new NextRequest(
      "http://localhost/api/workspace/tree?path=" + encodeURIComponent("../../etc/passwd"),
    );

    const response = await GET(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid path" });
  });

  it("returns 400 on absolute path", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    const request = new NextRequest("http://localhost/api/workspace/tree?path=/etc/passwd");

    const response = await GET(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid path" });
  });

  it("accepts valid relative path", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    process.env.NAT_BACKEND_URL = "http://nat.test";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ path: "src/components", tree: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await GET(new NextRequest("http://localhost/api/workspace/tree?path=src/components"));

    expect(response.status).toBe(200);
  });

  it("proxies workspace tree response", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    process.env.NAT_BACKEND_URL = "http://nat.test";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          path: "tmp/analysis",
          tree: [],
          changedFiles: [],
          totalFiles: 0,
          totalDirs: 0,
          truncated: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const response = await GET(new NextRequest("http://localhost/api/workspace/tree?path=tmp/analysis"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ path: "tmp/analysis", totalFiles: 0 });
    expect(globalThis.fetch).toHaveBeenCalledWith("http://nat.test/workspace/tree?path=tmp%2Fanalysis", {
      method: "GET",
      cache: "no-store",
    });
  });

  it("preserves 403 from upstream guardrail", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    process.env.NAT_BACKEND_URL = "http://nat.test";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "path not allowed" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await GET(new NextRequest("http://localhost/api/workspace/tree?path=restricted-dir"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "path not allowed" });
  });
});

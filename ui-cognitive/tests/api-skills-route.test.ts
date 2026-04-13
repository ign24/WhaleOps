import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { GET } from "@/app/api/tools/route";

const authMock = vi.mocked(auth);

describe("GET /api/tools", () => {
  beforeEach(() => {
    authMock.mockReset();
    vi.restoreAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null as never);

    const response = await GET();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 502 when NAT backend errors", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("fail", { status: 500 }));

    const response = await GET();
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
  });

  it("collects and sorts unique tools from NAT response", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    process.env.NAT_BACKEND_URL = "http://nat.test";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ skills: [{ name: "qa" }, { skill: "qa" }, { name: "ops" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ tools: ["ops", "qa"] });
    expect(globalThis.fetch).toHaveBeenCalledWith("http://nat.test/mcp/client/tool/list", {
      method: "GET",
      cache: "no-store",
    });
  });
});

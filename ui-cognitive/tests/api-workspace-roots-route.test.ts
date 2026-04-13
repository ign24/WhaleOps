import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { GET } from "@/app/api/workspace/roots/route";

const authMock = vi.mocked(auth);

describe("GET /api/workspace/roots", () => {
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

  it("proxies roots from NAT backend", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    process.env.NAT_BACKEND_URL = "http://nat.test";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ roots: [{ path: "/tmp/analysis", label: "sandbox" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ roots: [{ path: "/tmp/analysis", label: "sandbox" }] });
    expect(globalThis.fetch).toHaveBeenCalledWith("http://nat.test/workspace/roots", {
      method: "GET",
      cache: "no-store",
    });
  });

  it("maps upstream server errors to 502", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "backend exploded" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await GET();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "backend exploded" });
  });
});

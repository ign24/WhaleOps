import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { GET } from "@/app/api/health/route";

const authMock = vi.mocked(auth);

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null as never);
    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ status: "unauthorized" });
  });

  it("returns 200 with ok for healthy NAT backend", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);

    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "ok", code: 200, upstreamStatus: 200 });
  });

  it("returns 502 when NAT backend fails with 5xx", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);

    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("fail", { status: 503 }));

    const response = await GET();
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: 503, upstreamStatus: 503 });
  });

  it("returns 502 when NAT backend returns non-2xx", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);

    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("missing", { status: 404 }));

    const response = await GET();
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: 404, upstreamStatus: 404 });
  });

  it("returns 502 when NAT health check throws", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const response = await GET();
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ status: "error", message: "network down" });
  });
});

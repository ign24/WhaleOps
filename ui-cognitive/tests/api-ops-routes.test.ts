import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { GET as GET_STATUS } from "@/app/api/ops/status/route";
import { GET as GET_NOTES } from "@/app/api/ops/notes/route";

const authMock = vi.mocked(auth);

describe("GET /api/ops/status", () => {
  beforeEach(() => {
    authMock.mockReset();
    vi.restoreAllMocks();
    process.env.NAT_BACKEND_URL = "http://nat.test";
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null as never);
    const response = await GET_STATUS();
    expect(response.status).toBe(401);
  });

  it("proxies status payload", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          containers: [
            {
              name: "redis",
              id: "abc123",
              image: "redis:7",
              status: "running",
              state: "running",
              ports: ["6379/tcp"],
              created_at: "2026-04-14T01:00:00Z",
              started_at: "2026-04-14T01:00:10Z",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const response = await GET_STATUS();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      containers: [
        {
          name: "redis",
          id: "abc123",
          image: "redis:7",
          status: "running",
          state: "running",
          ports: ["6379/tcp"],
          created_at: "2026-04-14T01:00:00Z",
          started_at: "2026-04-14T01:00:10Z",
        },
      ],
    });
  });

  it("returns normalized 503 on backend error", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "socket down" }), { status: 500 }),
    );

    const response = await GET_STATUS();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Ops status unavailable" });
  });
});

describe("GET /api/ops/notes", () => {
  beforeEach(() => {
    authMock.mockReset();
    vi.restoreAllMocks();
    process.env.NAT_BACKEND_URL = "http://nat.test";
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null as never);
    const request = new Request("http://localhost/api/ops/notes");
    const response = await GET_NOTES(request);
    expect(response.status).toBe(401);
  });

  it("forwards filters and returns notes", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ notes: [{ id: "n1", container_name: "redis", note_type: "anomaly", content: "OOM", created_at: "2026-04-14T01:00:00Z" }] }),
        { status: 200 },
      ),
    );

    const request = new Request("http://localhost/api/ops/notes?limit=10&note_type=anomaly");
    const response = await GET_NOTES(request);

    expect(response.status).toBe(200);
    const calledUrl = String(fetchSpy.mock.calls[0]?.[0] ?? "");
    expect(calledUrl).toContain("/api/ops/notes?");
    expect(calledUrl).toContain("limit=10");
    expect(calledUrl).toContain("note_type=anomaly");
    await expect(response.json()).resolves.toEqual({
      notes: [{ id: "n1", container_name: "redis", note_type: "anomaly", content: "OOM", created_at: "2026-04-14T01:00:00Z" }],
    });
  });

  it("returns safe fallback on backend error", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "db unavailable" }), { status: 503 }),
    );

    const request = new Request("http://localhost/api/ops/notes");
    const response = await GET_NOTES(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ notes: [] });
  });
});

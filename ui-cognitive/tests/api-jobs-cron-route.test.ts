import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { GET, POST } from "@/app/api/jobs/cron/route";
import { DELETE } from "@/app/api/jobs/cron/[jobId]/route";

const authMock = vi.mocked(auth);

const MOCK_JOB = {
  id: "abc123",
  description: "Daily scan",
  cron_expr: "0 9 * * *",
  next_run: "2026-04-14T09:00:00+00:00",
  status: "active",
};

describe("GET /api/jobs/cron", () => {
  beforeEach(() => {
    authMock.mockReset();
    vi.restoreAllMocks();
    process.env.NAT_BACKEND_URL = "http://nat.test";
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null as never);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("maps jobs from backend", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([MOCK_JOB]), { status: 200 })
    );
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("abc123");
  });

  it("returns empty array when no jobs", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    );
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
  });

  it("returns 503 when backend returns 503", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "scheduler not initialized" }), { status: 503 })
    );
    const response = await GET();
    expect(response.status).toBe(503);
  });
});

describe("POST /api/jobs/cron", () => {
  beforeEach(() => {
    authMock.mockReset();
    vi.restoreAllMocks();
    process.env.NAT_BACKEND_URL = "http://nat.test";
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null as never);
    const req = new Request("http://localhost/api/jobs/cron", {
      method: "POST",
      body: JSON.stringify({ cron_expr: "0 9 * * *", prompt: "scan", description: "daily" }),
    });
    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it("creates job and returns 201", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(MOCK_JOB), { status: 201 })
    );
    const req = new Request("http://localhost/api/jobs/cron", {
      method: "POST",
      body: JSON.stringify({ cron_expr: "0 9 * * *", prompt: "scan", description: "daily" }),
    });
    const response = await POST(req);
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBe("abc123");
  });

  it("forwards 422 from backend", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Invalid cron expression" }), { status: 422 })
    );
    const req = new Request("http://localhost/api/jobs/cron", {
      method: "POST",
      body: JSON.stringify({ cron_expr: "bad", prompt: "x", description: "y" }),
    });
    const response = await POST(req);
    expect(response.status).toBe(422);
    const data = await response.json();
    expect(data.error).toBeTruthy();
  });
});

describe("DELETE /api/jobs/cron/[jobId]", () => {
  beforeEach(() => {
    authMock.mockReset();
    vi.restoreAllMocks();
    process.env.NAT_BACKEND_URL = "http://nat.test";
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null as never);
    const req = new Request("http://localhost/api/jobs/cron/abc123", { method: "DELETE" });
    const response = await DELETE(req, { params: Promise.resolve({ jobId: "abc123" }) });
    expect(response.status).toBe(401);
  });

  it("cancels job and returns 200", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ cancelled: true, id: "abc123" }), { status: 200 })
    );
    const req = new Request("http://localhost/api/jobs/cron/abc123", { method: "DELETE" });
    const response = await DELETE(req, { params: Promise.resolve({ jobId: "abc123" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ cancelled: true, id: "abc123" });
  });

  it("returns 404 for unknown job", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "job not found" }), { status: 404 })
    );
    const req = new Request("http://localhost/api/jobs/cron/ghost", { method: "DELETE" });
    const response = await DELETE(req, { params: Promise.resolve({ jobId: "ghost" }) });
    expect(response.status).toBe(404);
  });
});

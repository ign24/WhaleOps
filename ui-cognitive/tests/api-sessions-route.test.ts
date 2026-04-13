import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/sessions", () => ({
  listSessions: vi.fn(),
  createSession: vi.fn(),
}));

const CREATOR = { id: "u1", name: "Test User" };

import { auth } from "@/auth";
import { createSession, listSessions } from "@/lib/sessions";
import { GET, POST } from "@/app/api/sessions/route";

const authMock = vi.mocked(auth);
const listSessionsMock = vi.mocked(listSessions);
const createSessionMock = vi.mocked(createSession);

describe("/api/sessions route", () => {
  beforeEach(() => {
    authMock.mockReset();
    listSessionsMock.mockReset();
    createSessionMock.mockReset();
  });

  it("GET returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null as never);

    const req = new Request("http://localhost/api/sessions");
    const response = await GET(req);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("GET returns persisted sessions including createdBy", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    listSessionsMock.mockResolvedValue([
      { sessionKey: "s-2", title: "Session 2", updatedAt: "2026-03-09T20:02:00.000Z", createdBy: CREATOR },
      { sessionKey: "s-1", title: "Session 1", updatedAt: "2026-03-09T20:01:00.000Z", createdBy: { id: "system", name: "Sistema" } },
    ]);

    const req = new Request("http://localhost/api/sessions");
    const response = await GET(req);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sessions: [
        { sessionKey: "s-2", title: "Session 2", updatedAt: "2026-03-09T20:02:00.000Z", createdBy: CREATOR },
        { sessionKey: "s-1", title: "Session 1", updatedAt: "2026-03-09T20:01:00.000Z", createdBy: { id: "system", name: "Sistema" } },
      ],
    });
    expect(listSessionsMock).toHaveBeenCalledOnce();
  });

  it("POST creates and returns a new persisted session", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    createSessionMock.mockResolvedValue({
      sessionKey: "abc12345",
      title: "Nueva conversacion",
      updatedAt: "2026-03-09T20:03:00.000Z",
      createdBy: CREATOR,
    });

    const req = new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await POST(req);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sessionKey: "abc12345",
      title: "Nueva conversacion",
      updatedAt: "2026-03-09T20:03:00.000Z",
      createdBy: CREATOR,
    });
    expect(createSessionMock).toHaveBeenCalledOnce();
  });

  it("POST passes createdBy from authenticated user to createSession", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", name: "Test User" } } as never);
    createSessionMock.mockResolvedValue({
      sessionKey: "abc12345",
      title: "Nueva conversacion",
      updatedAt: "2026-03-09T20:03:00.000Z",
      createdBy: CREATOR,
    });

    const req = new Request("http://localhost/api/sessions", { method: "POST" });
    await POST(req);

    expect(createSessionMock).toHaveBeenCalledWith(
      expect.any(String),
      { id: "u1", name: "Test User" },
    );
  });

  it("POST uses fallback name when user has no name", async () => {
    authMock.mockResolvedValue({ user: { id: "u2", name: null } } as never);
    createSessionMock.mockResolvedValue({
      sessionKey: "xyz99",
      title: "Nueva conversacion",
      updatedAt: "2026-03-09T20:03:00.000Z",
      createdBy: { id: "u2", name: "Usuario" },
    });

    const req = new Request("http://localhost/api/sessions", { method: "POST" });
    await POST(req);

    expect(createSessionMock).toHaveBeenCalledWith(
      expect.any(String),
      { id: "u2", name: "Usuario" },
    );
  });
});

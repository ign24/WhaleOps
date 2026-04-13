import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/sessions", () => ({
  deleteSession: vi.fn(),
  renameSession: vi.fn(),
  getSessionOwnership: vi.fn(),
}));

import { auth } from "@/auth";
import { deleteSession, getSessionOwnership, renameSession } from "@/lib/sessions";
import { DELETE, PATCH } from "@/app/api/sessions/[sessionKey]/route";

const authMock = vi.mocked(auth);
const deleteSessionMock = vi.mocked(deleteSession);
const renameSessionMock = vi.mocked(renameSession);
const getSessionOwnershipMock = vi.mocked(getSessionOwnership);

describe("/api/sessions/[sessionKey] route", () => {
  beforeEach(() => {
    authMock.mockReset();
    deleteSessionMock.mockReset();
    renameSessionMock.mockReset();
    getSessionOwnershipMock.mockReset();
  });

  it("PATCH returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null as never);

    const response = await PATCH(
      new Request("http://localhost/api/sessions/main", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      }),
      { params: Promise.resolve({ sessionKey: "main" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("PATCH returns 400 on malformed JSON body", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);

    const response = await PATCH(
      new Request("http://localhost/api/sessions/main", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "not valid json{{",
      }),
      { params: Promise.resolve({ sessionKey: "main" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON in request body" });
  });

  it("PATCH renames a session", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);

    const response = await PATCH(
      new Request("http://localhost/api/sessions/main", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      }),
      { params: Promise.resolve({ sessionKey: "main" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(renameSessionMock).toHaveBeenCalledWith("main", "Updated");
  });

  it("PATCH returns generic error on internal failure", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    renameSessionMock.mockRejectedValue(new Error("ENOENT: /var/data/sessions.json"));

    const response = await PATCH(
      new Request("http://localhost/api/sessions/main", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      }),
      { params: Promise.resolve({ sessionKey: "main" }) },
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
    expect(body.error).not.toContain("ENOENT");
    expect(body.error).not.toContain("/var/data");
  });

  it("DELETE returns generic error on internal failure", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "user" } } as never);
    getSessionOwnershipMock.mockResolvedValue({ createdBy: { id: "u1", name: "Test User" } });
    deleteSessionMock.mockRejectedValue(new Error("EACCES: permission denied"));

    const response = await DELETE(new Request("http://localhost/api/sessions/main"), {
      params: Promise.resolve({ sessionKey: "main" }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
    expect(body.error).not.toContain("EACCES");
  });

  it("DELETE removes a session when caller is the creator", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "user" } } as never);
    getSessionOwnershipMock.mockResolvedValue({ createdBy: { id: "u1", name: "Test User" } });

    const response = await DELETE(new Request("http://localhost/api/sessions/main"), {
      params: Promise.resolve({ sessionKey: "main" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(deleteSessionMock).toHaveBeenCalledWith("main");
  });

  it("DELETE returns 403 when caller is not creator and not admin", async () => {
    authMock.mockResolvedValue({ user: { id: "u2", role: "user" } } as never);
    getSessionOwnershipMock.mockResolvedValue({ createdBy: { id: "u1", name: "Test User" } });

    const response = await DELETE(new Request("http://localhost/api/sessions/main"), {
      params: Promise.resolve({ sessionKey: "main" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "No tienes permiso para borrar esta sesión" });
    expect(deleteSessionMock).not.toHaveBeenCalled();
  });

  it("DELETE allows admin to delete any session", async () => {
    authMock.mockResolvedValue({ user: { id: "admin1", role: "admin" } } as never);
    getSessionOwnershipMock.mockResolvedValue({ createdBy: { id: "u1", name: "Test User" } });

    const response = await DELETE(new Request("http://localhost/api/sessions/main"), {
      params: Promise.resolve({ sessionKey: "main" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(deleteSessionMock).toHaveBeenCalledWith("main");
  });

  it("DELETE returns 403 for legacy session (system owner) when caller is not admin", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "user" } } as never);
    getSessionOwnershipMock.mockResolvedValue({ createdBy: { id: "system", name: "Sistema" } });

    const response = await DELETE(new Request("http://localhost/api/sessions/legacy"), {
      params: Promise.resolve({ sessionKey: "legacy" }),
    });

    expect(response.status).toBe(403);
    expect(deleteSessionMock).not.toHaveBeenCalled();
  });

  it("DELETE returns 404 when session does not exist", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "user" } } as never);
    getSessionOwnershipMock.mockResolvedValue(null);

    const response = await DELETE(new Request("http://localhost/api/sessions/missing"), {
      params: Promise.resolve({ sessionKey: "missing" }),
    });

    expect(response.status).toBe(404);
    expect(deleteSessionMock).not.toHaveBeenCalled();
  });
});

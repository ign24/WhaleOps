import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/users", () => ({ setUserActive: vi.fn() }));

import { auth } from "@/auth";
import { setUserActive } from "@/lib/users";
import { PATCH } from "@/app/api/users/[userId]/route";

const authMock = vi.mocked(auth);
const setUserActiveMock = vi.mocked(setUserActive);

describe("PATCH /api/users/[userId]", () => {
  beforeEach(() => {
    authMock.mockReset();
    setUserActiveMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null as never);

    const request = new Request("http://localhost/api/users/u1", {
      method: "PATCH",
      body: JSON.stringify({ active: true }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ userId: "u1" }) });

    expect(response.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    authMock.mockResolvedValue({ user: { role: "user" } } as never);

    const request = new Request("http://localhost/api/users/u1", {
      method: "PATCH",
      body: JSON.stringify({ active: true }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ userId: "u1" }) });

    expect(response.status).toBe(403);
  });

  it("returns 400 on malformed JSON body", async () => {
    authMock.mockResolvedValue({ user: { role: "admin" } } as never);

    const request = new Request("http://localhost/api/users/u1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{",
    });
    const response = await PATCH(request, { params: Promise.resolve({ userId: "u1" }) });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON in request body" });
  });

  it("validates active as boolean", async () => {
    authMock.mockResolvedValue({ user: { role: "admin" } } as never);

    const request = new Request("http://localhost/api/users/u1", {
      method: "PATCH",
      body: JSON.stringify({ active: "yes" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ userId: "u1" }) });

    expect(response.status).toBe(400);
  });

  it("returns 404 when user does not exist", async () => {
    authMock.mockResolvedValue({ user: { role: "admin" } } as never);
    setUserActiveMock.mockResolvedValue(null);

    const request = new Request("http://localhost/api/users/u1", {
      method: "PATCH",
      body: JSON.stringify({ active: true }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ userId: "u1" }) });

    expect(response.status).toBe(404);
  });

  it("updates active status", async () => {
    authMock.mockResolvedValue({ user: { role: "admin" } } as never);
    setUserActiveMock.mockResolvedValue({ id: "u1", active: false } as never);

    const request = new Request("http://localhost/api/users/u1", {
      method: "PATCH",
      body: JSON.stringify({ active: false }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ userId: "u1" }) });

    expect(response.status).toBe(200);
    expect(setUserActiveMock).toHaveBeenCalledWith("u1", false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn() } }));
vi.mock("@/lib/users", () => ({
  listPublicUsers: vi.fn(),
  createUser: vi.fn(),
}));

import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { createUser, listPublicUsers } from "@/lib/users";
import { GET, POST } from "@/app/api/users/route";

const authMock = vi.mocked(auth);
const listPublicUsersMock = vi.mocked(listPublicUsers);
const createUserMock = vi.mocked(createUser);
const hashMock = vi.mocked(bcrypt.hash);

describe("/api/users route", () => {
  beforeEach(() => {
    authMock.mockReset();
    listPublicUsersMock.mockReset();
    createUserMock.mockReset();
    hashMock.mockReset();
  });

  it("GET returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null as never);

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("GET returns 403 for non-admin", async () => {
    authMock.mockResolvedValue({ user: { role: "user" } } as never);

    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("GET returns users for admin", async () => {
    authMock.mockResolvedValue({ user: { role: "admin" } } as never);
    listPublicUsersMock.mockResolvedValue([{ id: "u1", name: "A" }] as never);

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ users: [{ id: "u1", name: "A" }] });
  });

  it("POST validates payload", async () => {
    authMock.mockResolvedValue({ user: { role: "admin" } } as never);

    const request = new Request("http://localhost/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", email: "", password: "123" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("POST creates user when valid", async () => {
    authMock.mockResolvedValue({ user: { role: "admin" } } as never);
    hashMock.mockResolvedValue("hash-1" as never);
    createUserMock.mockResolvedValue({ id: "u2", name: "B", email: "b@cgn.local" } as never);

    const request = new Request("http://localhost/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "B", email: "b@cgn.local", password: "password1", role: "user" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(hashMock).toHaveBeenCalledWith("password1", 12);
    expect(createUserMock).toHaveBeenCalledWith({
      name: "B",
      email: "b@cgn.local",
      passwordHash: "hash-1",
      role: "user",
    });
  });

  it("POST returns 400 on malformed JSON body", async () => {
    authMock.mockResolvedValue({ user: { role: "admin" } } as never);

    const request = new Request("http://localhost/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{",
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON in request body" });
  });

  it("POST returns 400 on empty body", async () => {
    authMock.mockResolvedValue({ user: { role: "admin" } } as never);

    const request = new Request("http://localhost/api/users", {
      method: "POST",
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON in request body" });
  });

  it("POST maps duplicate email error to 409", async () => {
    authMock.mockResolvedValue({ user: { role: "admin" } } as never);
    hashMock.mockResolvedValue("hash-1" as never);
    createUserMock.mockRejectedValue(new Error("email-already-exists"));

    const request = new Request("http://localhost/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "B", email: "b@cgn.local", password: "password1", role: "user" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(409);
  });
});

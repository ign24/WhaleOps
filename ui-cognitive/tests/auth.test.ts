import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn((config) => config),
}));

vi.mock("next-auth", () => ({
  default: vi.fn((config) => {
    (globalThis as { __AUTH_CONFIG__?: unknown }).__AUTH_CONFIG__ = config;
    return {
      handlers: {},
      auth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    };
  }),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
  },
}));

vi.mock("@/lib/users", () => ({
  findActiveUserByEmail: vi.fn(),
}));

import bcrypt from "bcryptjs";
import { findActiveUserByEmail } from "@/lib/users";

const compareMock = vi.mocked(bcrypt.compare);
const findActiveUserByEmailMock = vi.mocked(findActiveUserByEmail);

type AuthConfig = {
  providers: Array<{
    authorize: (credentials: Record<string, unknown>) => Promise<unknown>;
  }>;
  callbacks: {
    jwt: (params: { token: Record<string, unknown>; user?: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    session: (params: {
      session: { user?: Record<string, unknown> };
      token: Record<string, unknown>;
    }) => Promise<{ user?: Record<string, unknown> }>;
  };
};

const loadAuthConfig = async (): Promise<AuthConfig> => {
  vi.resetModules();
  await import("@/auth");
  return (globalThis as { __AUTH_CONFIG__?: AuthConfig }).__AUTH_CONFIG__ as AuthConfig;
};

describe("auth config", () => {
  beforeEach(() => {
    compareMock.mockReset();
    findActiveUserByEmailMock.mockReset();
  });

  it("authorize returns null when credentials are missing", async () => {
    const config = await loadAuthConfig();
    const authorize = config.providers[0].authorize;

    await expect(authorize({})).resolves.toBeNull();
  });

  it("authorize returns null when user is not found", async () => {
    findActiveUserByEmailMock.mockResolvedValue(undefined);
    const config = await loadAuthConfig();
    const authorize = config.providers[0].authorize;

    await expect(authorize({ email: "user@cgn.local", password: "secret" })).resolves.toBeNull();
    expect(findActiveUserByEmailMock).toHaveBeenCalledWith("user@cgn.local");
  });

  it("authorize returns null when password is invalid", async () => {
    findActiveUserByEmailMock.mockResolvedValue({
      id: "u1",
      name: "User",
      email: "user@cgn.local",
      role: "user",
      passwordHash: "hash",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    compareMock.mockResolvedValue(false as never);

    const config = await loadAuthConfig();
    const authorize = config.providers[0].authorize;

    await expect(authorize({ email: "user@cgn.local", password: "bad" })).resolves.toBeNull();
  });

  it("authorize returns normalized public user shape on success", async () => {
    findActiveUserByEmailMock.mockResolvedValue({
      id: "u1",
      name: "User",
      email: "user@cgn.local",
      role: "admin",
      passwordHash: "hash",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    compareMock.mockResolvedValue(true as never);

    const config = await loadAuthConfig();
    const authorize = config.providers[0].authorize;

    await expect(authorize({ email: "user@cgn.local", password: "good" })).resolves.toEqual({
      id: "u1",
      name: "User",
      email: "user@cgn.local",
      role: "admin",
    });
  });

  it("jwt callback persists role from user", async () => {
    const config = await loadAuthConfig();
    const token = await config.callbacks.jwt({ token: { sub: "u1" }, user: { role: "admin" } });

    expect(token).toMatchObject({ sub: "u1", role: "admin" });
  });

  it("session callback maps token values into session.user", async () => {
    const config = await loadAuthConfig();
    const session = await config.callbacks.session({
      session: { user: { email: "user@cgn.local" } },
      token: { sub: "u1", role: "user" },
    });

    expect(session.user).toMatchObject({
      email: "user@cgn.local",
      id: "u1",
      role: "user",
    });
  });
});

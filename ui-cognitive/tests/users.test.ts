import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fs", () => {
  return {
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
    },
  };
});

import { promises as fs } from "fs";

import { createUser, findActiveUserByEmail, listPublicUsers, setUserActive } from "@/lib/users";

const readFileMock = vi.mocked(fs.readFile);
const writeFileMock = vi.mocked(fs.writeFile);

const seedUsers = [
  {
    id: "u-admin",
    name: "Admin",
    email: "admin@cgn.local",
    passwordHash: "hash-1",
    role: "admin",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "u-user",
    name: "Disabled",
    email: "user@cgn.local",
    passwordHash: "hash-2",
    role: "user",
    active: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
] as const;

describe("users data store", () => {
  beforeEach(() => {
    readFileMock.mockResolvedValue(JSON.stringify(seedUsers));
    writeFileMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("finds active users by normalized email", async () => {
    const found = await findActiveUserByEmail("  ADMIN@CGN.LOCAL ");
    expect(found?.id).toBe("u-admin");

    const disabled = await findActiveUserByEmail("user@cgn.local");
    expect(disabled).toBeUndefined();
  });

  it("lists users without passwordHash", async () => {
    const users = await listPublicUsers();

    expect(users).toHaveLength(2);
    expect(users[0]).not.toHaveProperty("passwordHash");
  });

  it("creates a user with normalized fields", async () => {
    const uuidSpy = vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("u-new");
    const nowSpy = vi.spyOn(Date.prototype, "toISOString").mockReturnValue("2026-01-05T12:00:00.000Z");

    const created = await createUser({
      name: "  Tester  ",
      email: "  TEST@CGN.LOCAL ",
      passwordHash: "hash-3",
      role: "user",
    });

    expect(created).toMatchObject({
      id: "u-new",
      name: "Tester",
      email: "test@cgn.local",
      role: "user",
      active: true,
      createdAt: "2026-01-05T12:00:00.000Z",
    });

    expect(writeFileMock).toHaveBeenCalledOnce();
    uuidSpy.mockRestore();
    nowSpy.mockRestore();
  });

  it("rejects duplicate emails", async () => {
    await expect(
      createUser({
        name: "Another",
        email: "ADMIN@CGN.LOCAL",
        passwordHash: "hash",
        role: "user",
      }),
    ).rejects.toThrow("email-already-exists");
  });

  it("toggles user active status and returns null when missing", async () => {
    const updated = await setUserActive("u-admin", false);
    expect(updated?.active).toBe(false);
    expect(writeFileMock).toHaveBeenCalled();

    const missing = await setUserActive("missing", true);
    expect(missing).toBeNull();
  });
});

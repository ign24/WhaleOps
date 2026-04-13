import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("bcryptjs", () => ({ compare: vi.fn() }));

import { auth } from "@/auth";
import { compare } from "bcryptjs";
import { POST } from "@/app/api/workspace/delete/confirm/route";
import {
  lookupDeleteToken,
  registerDeleteToken,
} from "@/lib/workspace-delete-tokens";

const authMock = vi.mocked(auth);
const compareMock = vi.mocked(compare);

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function makeRequest(body: object): Request {
  return new Request("http://localhost/api/workspace/delete/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  authMock.mockReset();
  compareMock.mockReset();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Task 3.1 — Core status codes
// ---------------------------------------------------------------------------

describe("POST /api/workspace/delete/confirm", () => {
  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null as never);

    const response = await POST(makeRequest({ token: "t1", pin: "1234" }));

    expect(response.status).toBe(401);
  });

  it("returns 503 when WORKSPACE_DELETE_PIN_HASH is not set", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    vi.stubEnv("WORKSPACE_DELETE_PIN_HASH", "");

    const response = await POST(makeRequest({ token: "any-token", pin: "1234" }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "pin_not_configured" });
  });

  it("returns 404 when token is not in store", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    vi.stubEnv("WORKSPACE_DELETE_PIN_HASH", "$2b$12$validhash");

    const response = await POST(makeRequest({ token: "unknown-token-xyz", pin: "1234" }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "token_not_found" });
  });

  it("returns 403 when PIN is wrong and does not consume token", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);

    const token = registerDeleteToken({
      path: "/app/workspace/django",
      size_mb: 142,
      location: "workspace",
      target: "django",
    });

    vi.stubEnv("WORKSPACE_DELETE_PIN_HASH", "$2b$12$validhash");
    compareMock.mockResolvedValue(false as never);

    const response = await POST(makeRequest({ token, pin: "wrongpin" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_pin" });

    // Token must NOT be consumed — still findable
    expect(lookupDeleteToken(token)).not.toBeNull();
  });

  it("returns 200 with deleted info when PIN is correct and token valid", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);

    const token = registerDeleteToken({
      path: "/app/workspace/fastapi",
      size_mb: 23,
      location: "workspace",
      target: "fastapi",
    });

    vi.stubEnv("WORKSPACE_DELETE_PIN_HASH", "$2b$12$validhash");
    compareMock.mockResolvedValue(true as never);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ status: "deleted", size_freed_mb: 23, target_path: "/app/workspace/fastapi" }),
        { status: 200 },
      ),
    );

    const response = await POST(makeRequest({ token, pin: "correctpin" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("deleted");
    expect(body.size_freed_mb).toBe(23);
  });

  // ---------------------------------------------------------------------------
  // Task 3.2 — Token is single-use
  // ---------------------------------------------------------------------------

  it("returns 404 on second use of same token after successful delete", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);

    const token = registerDeleteToken({
      path: "/app/workspace/react",
      size_mb: 5,
      location: "workspace",
      target: "react",
    });

    vi.stubEnv("WORKSPACE_DELETE_PIN_HASH", "$2b$12$validhash");
    compareMock.mockResolvedValue(true as never);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "deleted", size_freed_mb: 5 }), { status: 200 }),
    );

    // First call succeeds
    const first = await POST(makeRequest({ token, pin: "correctpin" }));
    expect(first.status).toBe(200);

    // Second call with same token
    const second = await POST(makeRequest({ token, pin: "correctpin" }));
    expect(second.status).toBe(404);
    await expect(second.json()).resolves.toMatchObject({ error: "token_not_found" });
  });

  // ---------------------------------------------------------------------------
  // Task 3.3 — Token expires after 300 seconds
  // ---------------------------------------------------------------------------

  it("returns 410 when token TTL has expired", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);

    const token = registerDeleteToken(
      { path: "/app/workspace/old", size_mb: 1, location: "workspace", target: "old" },
      Date.now() - 1000, // already expired
    );

    vi.stubEnv("WORKSPACE_DELETE_PIN_HASH", "$2b$12$validhash");

    const response = await POST(makeRequest({ token, pin: "anypin" }));

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({ error: "token_expired" });
  });
});

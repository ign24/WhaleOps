import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { POST } from "@/app/api/workspace/delete/register-token/route";
import {
  checkTokenStatus,
  _tokenExists,
} from "@/lib/workspace-delete-tokens";

const authMock = auth as ReturnType<typeof vi.fn>;

function makeRequest(body: object): Request {
  return new Request("http://localhost/api/workspace/delete/register-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  token: "test-uuid-from-python",
  path: "/app/workspace/django",
  size_mb: 120.5,
  location: "workspace",
  target: "django",
};

beforeEach(() => {
  authMock.mockReset();
});

describe("POST /api/workspace/delete/register-token", () => {
  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 400 when token is missing", async () => {
    authMock.mockResolvedValue({ user: { name: "test" }, expires: "" });
    const { token, ...noToken } = VALID_BODY;
    const res = await POST(makeRequest(noToken));
    expect(res.status).toBe(400);
  });

  it("returns 400 when path is missing", async () => {
    authMock.mockResolvedValue({ user: { name: "test" }, expires: "" });
    const { path, ...noPath } = VALID_BODY;
    const res = await POST(makeRequest(noPath));
    expect(res.status).toBe(400);
  });

  it("returns 400 when location is missing", async () => {
    authMock.mockResolvedValue({ user: { name: "test" }, expires: "" });
    const { location, ...noLoc } = VALID_BODY;
    const res = await POST(makeRequest(noLoc));
    expect(res.status).toBe(400);
  });

  it("returns 400 when target is missing", async () => {
    authMock.mockResolvedValue({ user: { name: "test" }, expires: "" });
    const { target, ...noTarget } = VALID_BODY;
    const res = await POST(makeRequest(noTarget));
    expect(res.status).toBe(400);
  });

  it("returns 200 and registers token on valid request", async () => {
    authMock.mockResolvedValue({ user: { name: "test" }, expires: "" });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);

    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);

    expect(_tokenExists(VALID_BODY.token)).toBe(true);
    expect(checkTokenStatus(VALID_BODY.token)).toBe("valid");
  });
});

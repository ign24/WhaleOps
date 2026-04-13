import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/sessions", () => ({ getSessionMessages: vi.fn() }));

import { auth } from "@/auth";
import { getSessionMessages } from "@/lib/sessions";
import { GET } from "@/app/api/sessions/[sessionKey]/history/route";

const authMock = vi.mocked(auth);
const getSessionMessagesMock = vi.mocked(getSessionMessages);

describe("GET /api/sessions/[sessionKey]/history", () => {
  beforeEach(() => {
    authMock.mockReset();
    getSessionMessagesMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null as never);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ sessionKey: "main" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns persisted session history", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    getSessionMessagesMock.mockResolvedValue([
      { role: "user", content: "hola" },
      { role: "assistant", content: "ok" },
    ]);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ sessionKey: "main" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      messages: [
        { role: "user", content: "hola" },
        { role: "assistant", content: "ok" },
      ],
    });
    expect(getSessionMessagesMock).toHaveBeenCalledWith("main");
  });
});

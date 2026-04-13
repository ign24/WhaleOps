import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/sessions", () => ({ setSessionMessageFeedback: vi.fn() }));

import { auth } from "@/auth";
import { setSessionMessageFeedback } from "@/lib/sessions";
import { POST } from "@/app/api/sessions/[sessionKey]/feedback/route";

const authMock = vi.mocked(auth);
const setSessionMessageFeedbackMock = vi.mocked(setSessionMessageFeedback);

describe("POST /api/sessions/[sessionKey]/feedback", () => {
  beforeEach(() => {
    authMock.mockReset();
    setSessionMessageFeedbackMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null as never);

    const response = await POST(
      new Request("http://localhost/api/sessions/main/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: "a-1", reaction: "up" }),
      }),
      { params: Promise.resolve({ sessionKey: "main" }) },
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 on malformed JSON body", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);

    const response = await POST(
      new Request("http://localhost/api/sessions/main/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json{{",
      }),
      { params: Promise.resolve({ sessionKey: "main" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON in request body" });
  });

  it("returns generic error on internal failure", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    setSessionMessageFeedbackMock.mockRejectedValue(new Error("SQLITE_ERROR: no such table"));

    const response = await POST(
      new Request("http://localhost/api/sessions/main/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: "a-1", reaction: "up" }),
      }),
      { params: Promise.resolve({ sessionKey: "main" }) },
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
    expect(body.error).not.toContain("SQLITE");
  });

  it("stores feedback for a message", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    setSessionMessageFeedbackMock.mockResolvedValue(true);

    const response = await POST(
      new Request("http://localhost/api/sessions/main/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: "a-1", reaction: "down" }),
      }),
      { params: Promise.resolve({ sessionKey: "main" }) },
    );

    expect(response.status).toBe(200);
    expect(setSessionMessageFeedbackMock).toHaveBeenCalledWith("main", "a-1", "down", undefined);
  });
});

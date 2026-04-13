import { describe, expect, it } from "vitest";

import { normalizeSessions } from "@/lib/session-normalizers";

describe("normalizeSessions", () => {
  it("normalizes sessions from result.sessions", () => {
    const payload = {
      result: {
        sessions: [{ sessionKey: "abc", title: "Alpha", updatedAt: "2026-01-01", createdBy: { id: "u1", name: "Test User" } }],
      },
    };

    expect(normalizeSessions(payload)).toEqual([
      { sessionKey: "abc", title: "Alpha", updatedAt: "2026-01-01", createdBy: { id: "u1", name: "Test User" } },
    ]);
  });

  it("falls back to sessionId and label", () => {
    const payload = {
      sessions: [{ sessionId: "s-1", label: "Label", lastActiveAt: "now" }],
    };

    expect(normalizeSessions(payload)).toEqual([
      { sessionKey: "s-1", title: "Label", updatedAt: "now", createdBy: { id: "system", name: "Sistema" } },
    ]);
  });

  it("uses defaults when fields are missing", () => {
    const payload = { sessions: [{}] };
    expect(normalizeSessions(payload)).toEqual([
      { sessionKey: "main", title: "main", updatedAt: "", createdBy: { id: "system", name: "Sistema" } },
    ]);
  });

  it("returns empty array for invalid payload", () => {
    expect(normalizeSessions(undefined)).toEqual([]);
    expect(normalizeSessions("bad")).toEqual([]);
  });
});

// @vitest-environment happy-dom

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { __resetSessionsCacheForTests, useSessions } from "@/hooks/use-sessions";

describe("useSessions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetSessionsCacheForTests();
  });

  it("loads and normalizes sessions on mount", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          sessions: [{ sessionKey: "main", title: "Main", updatedAt: "2026-03-09T20:00:00.000Z", createdBy: { id: "u1", name: "Test User" } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { result } = renderHook(() => useSessions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.sessions).toEqual([
        { sessionKey: "main", title: "Main", updatedAt: "2026-03-09T20:00:00.000Z", createdBy: { id: "u1", name: "Test User" } },
      ]);
    });
  });

  it("sets error when refresh fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useSessions());

    await waitFor(() => {
      expect(result.current.error).toBe("network down");
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("reuses cached sessions across remounts", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          sessions: [{ sessionKey: "main", title: "Main", updatedAt: "2026-03-09T20:00:00.000Z" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const firstMount = renderHook(() => useSessions());

    await waitFor(() => {
      expect(firstMount.result.current.isLoading).toBe(false);
      expect(firstMount.result.current.sessions).toHaveLength(1);
    });

    firstMount.unmount();

    const secondMount = renderHook(() => useSessions());

    expect(secondMount.result.current.isLoading).toBe(false);
    expect(secondMount.result.current.sessions).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

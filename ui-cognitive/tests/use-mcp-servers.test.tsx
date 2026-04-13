// @vitest-environment happy-dom

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { __resetMcpServersCacheForTests, useMcpServers } from "@/hooks/use-mcp-servers";

describe("useMcpServers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetMcpServersCacheForTests();
  });

  it("loads MCP servers on mount", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          servers: [
            {
              name: "filesystem",
              displayName: "Filesystem",
              healthy: true,
              availableTools: 2,
              totalTools: 2,
              tools: [],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { result } = renderHook(() => useMcpServers());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.servers).toHaveLength(1);
    });
  });

  it("reuses cached MCP servers across remounts", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          servers: [
            {
              name: "filesystem",
              displayName: "Filesystem",
              healthy: true,
              availableTools: 2,
              totalTools: 2,
              tools: [],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const firstMount = renderHook(() => useMcpServers());

    await waitFor(() => {
      expect(firstMount.result.current.isLoading).toBe(false);
      expect(firstMount.result.current.servers).toHaveLength(1);
    });

    firstMount.unmount();

    const secondMount = renderHook(() => useMcpServers());

    expect(secondMount.result.current.isLoading).toBe(false);
    expect(secondMount.result.current.servers).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

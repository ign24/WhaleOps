// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import { GatewayStatus } from "@/components/chat/gateway-status";

describe("GatewayStatus", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("shows retry connection action on inactive gateway and retries health check", async () => {
    const onRetryConnection = vi.fn();
    let calls = 0;

    vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      calls += 1;
      if (calls === 1) {
        return Promise.resolve(new Response("{}", { status: 503 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    render(<GatewayStatus onRetryConnection={onRetryConnection} pollIntervalMs={60000} />);

    await waitFor(() => {
      expect(screen.getByText("Gateway inactivo")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Reintentar conexión" }));

    await waitFor(() => {
      expect(screen.getByText("Gateway activo")).toBeTruthy();
    });

    expect(onRetryConnection).toHaveBeenCalledTimes(1);
  });

  it("polls gateway health periodically", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

    render(<GatewayStatus pollIntervalMs={20} />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("treats unexpected health payload as inactive gateway", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "error" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    render(<GatewayStatus pollIntervalMs={60000} />);

    await waitFor(() => {
      expect(screen.getByText("Gateway inactivo")).toBeTruthy();
    });
  });
});

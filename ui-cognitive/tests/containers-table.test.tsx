// @vitest-environment happy-dom

import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OpsContainer } from "@/types/ops";

afterEach(() => cleanup());

const mockContainer = (overrides: Partial<OpsContainer> = {}): OpsContainer => ({
  name: "nginx-proxy",
  id: "abc123",
  image: "nginx:latest",
  status: "running",
  state: "running",
  ports: ["8080:80/tcp"],
  created_at: "2026-04-13T10:00:00Z",
  started_at: "2026-04-13T10:00:05Z",
  ...overrides,
});

describe("ContainersTable", () => {
  it("renders a row per container", async () => {
    const { ContainersTable } = await import("@/components/ops/containers-table");
    const containers = [
      mockContainer({ name: "nginx-proxy" }),
      mockContainer({ id: "def456", name: "redis-cache", image: "redis:7" }),
    ];
    render(<ContainersTable containers={containers} isLoading={false} error={null} onRetry={() => {}} />);
    expect(screen.getAllByText("nginx-proxy").length).toBeGreaterThan(0);
    expect(screen.getAllByText("redis-cache").length).toBeGreaterThan(0);
  });

  it("shows skeleton when loading", async () => {
    const { ContainersTable } = await import("@/components/ops/containers-table");
    const { container } = render(
      <ContainersTable containers={[]} isLoading={true} error={null} onRetry={() => {}} />,
    );
    const skeleton = container.querySelector("[data-testid='containers-skeleton']");
    expect(skeleton).not.toBeNull();
  });

  it("shows error message with retry button on error", async () => {
    const { ContainersTable } = await import("@/components/ops/containers-table");
    const retry = vi.fn();
    render(
      <ContainersTable
        containers={[]}
        isLoading={false}
        error="Docker daemon unavailable: socket not found"
        onRetry={retry}
      />,
    );
    expect(screen.getByText(/Docker daemon unavailable/)).toBeTruthy();
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    expect(retry).toHaveBeenCalledOnce();
  });

  it("running container badge has green indicator", async () => {
    const { ContainersTable } = await import("@/components/ops/containers-table");
    const { container } = render(
      <ContainersTable
        containers={[mockContainer({ state: "running" })]}
        isLoading={false}
        error={null}
        onRetry={() => {}}
      />,
    );
    const badge = container.querySelector("[data-status='running']");
    expect(badge).not.toBeNull();
  });

  it("exited container badge has grey indicator", async () => {
    const { ContainersTable } = await import("@/components/ops/containers-table");
    const { container } = render(
      <ContainersTable
        containers={[mockContainer({ state: "exited", status: "exited" })]}
        isLoading={false}
        error={null}
        onRetry={() => {}}
      />,
    );
    const badge = container.querySelector("[data-status='exited']");
    expect(badge).not.toBeNull();
  });

  it("shows ports column", async () => {
    const { ContainersTable } = await import("@/components/ops/containers-table");
    render(
      <ContainersTable
        containers={[mockContainer({ ports: ["8080:80/tcp", "443:443/tcp"] })]}
        isLoading={false}
        error={null}
        onRetry={() => {}}
      />,
    );
    expect(screen.getAllByText(/8080:80\/tcp/).length).toBeGreaterThan(0);
  });
});

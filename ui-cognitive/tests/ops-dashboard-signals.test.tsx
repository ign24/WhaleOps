// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-ops-status", () => ({ useOpsStatus: vi.fn() }));
vi.mock("@/hooks/use-ops-jobs", () => ({ useOpsJobs: vi.fn() }));
vi.mock("@/hooks/use-ops-observability", () => ({ useOpsObservability: vi.fn() }));
vi.mock("@/hooks/use-ops-strategic-signals", () => ({ useOpsStrategicSignals: vi.fn() }));

import { useOpsStatus } from "@/hooks/use-ops-status";
import { useOpsJobs } from "@/hooks/use-ops-jobs";
import { useOpsObservability } from "@/hooks/use-ops-observability";
import { useOpsStrategicSignals } from "@/hooks/use-ops-strategic-signals";
import { OpsDashboard } from "@/components/ops/ops-dashboard";

const useOpsStatusMock = vi.mocked(useOpsStatus);
const useOpsJobsMock = vi.mocked(useOpsJobs);
const useOpsObservabilityMock = vi.mocked(useOpsObservability);
const useOpsStrategicSignalsMock = vi.mocked(useOpsStrategicSignals);

afterEach(() => cleanup());

describe("OpsDashboard strategic signals", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    useOpsStatusMock.mockReturnValue({
      containers: [
        {
          name: "web",
          id: "c1",
          image: "nginx",
          status: "running",
          state: "running",
          ports: ["80/tcp"],
          created_at: "",
          started_at: "",
        },
      ],
      isLoading: false,
      error: null,
      refresh: vi.fn(async () => {}),
    });

    useOpsJobsMock.mockReturnValue({ jobs: [], isLoading: false, error: null });
    useOpsObservabilityMock.mockReturnValue({ summary: null, isLoading: false, error: null });
  });

  it("renders KPIs and no alerts in normal state", () => {
    useOpsStrategicSignalsMock.mockReturnValue({
      generatedAt: "2026-04-14T02:00:00Z",
      running: 1,
      total: 1,
      degraded: 0,
      degradedNames: [],
      activeJobs: 0,
      avgLatencyMs: 400,
      errorCount: 0,
      sources: {
        status: { status: "ok", reason: null },
        jobs: { status: "ok", reason: null },
        observability: { status: "ok", reason: null },
      },
      alerts: [],
    });

    render(<OpsDashboard />);

    expect(screen.getByText("Running/Total")).toBeTruthy();
    expect(screen.getByText("1/1")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows alerts only when exceptions exist", () => {
    useOpsStrategicSignalsMock.mockReturnValue({
      generatedAt: "2026-04-14T02:00:00Z",
      running: 0,
      total: 1,
      degraded: 1,
      degradedNames: ["web"],
      activeJobs: 0,
      avgLatencyMs: 2100,
      errorCount: 2,
      sources: {
        status: { status: "ok", reason: null },
        jobs: { status: "degraded", reason: "timeout" },
        observability: { status: "ok", reason: null },
      },
      alerts: [
        {
          code: "degraded_containers",
          severity: "error",
          message: "Hay 1 contenedor degradado",
        },
      ],
    });

    render(<OpsDashboard />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/contenedor degradado/i)).toBeTruthy();
  });

});

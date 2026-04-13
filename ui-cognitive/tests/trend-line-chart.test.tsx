// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Recharts uses ResizeObserver internally — stub it for happy-dom
vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

import { TrendLineChart } from "@/components/observability/charts/trend-line-chart";

afterEach(() => {
  cleanup();
});

const baseBuckets = [
  { timestamp: 1700000000000, p50Ms: 120, p95Ms: 350, costUsd: 0.05 },
  { timestamp: 1700003600000, p50Ms: 130, p95Ms: 400, costUsd: 0.08 },
  { timestamp: 1700007200000, p50Ms: 110, p95Ms: 300, costUsd: 0.03 },
];

describe("TrendLineChart", () => {
  it("renders placeholder when fewer than 3 data points", () => {
    render(
      <TrendLineChart
        data={[baseBuckets[0], baseBuckets[1]]}
        dataKeys={["p50Ms", "p95Ms"]}
        title="Latency trend"
      />,
    );

    expect(screen.getByText("Datos insuficientes para tendencias")).toBeTruthy();
  });

  it("renders chart title and no placeholder when enough data points", () => {
    render(
      <TrendLineChart
        data={baseBuckets}
        dataKeys={["p50Ms", "p95Ms"]}
        title="Latency trend"
      />,
    );

    expect(screen.getByText("Latency trend")).toBeTruthy();
    expect(screen.queryByText("Datos insuficientes para tendencias")).toBeNull();
  });

  it("renders with single data key without placeholder", () => {
    render(
      <TrendLineChart
        data={baseBuckets}
        dataKeys={["costUsd"]}
        title="Cost trend"
      />,
    );

    expect(screen.getByText("Cost trend")).toBeTruthy();
    expect(screen.queryByText("Datos insuficientes para tendencias")).toBeNull();
  });
});

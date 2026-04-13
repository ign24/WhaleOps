// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

import { TrendAreaChart } from "@/components/observability/charts/trend-area-chart";

afterEach(() => {
  cleanup();
});

const makeBuckets = (rates: number[]) =>
  rates.map((rate, i) => ({
    timestamp: 1700000000000 + i * 3600000,
    successRate: rate,
  }));

describe("TrendAreaChart", () => {
  it("renders placeholder when fewer than 3 data points", () => {
    render(
      <TrendAreaChart
        data={makeBuckets([95, 98])}
        dataKey="successRate"
        title="Success rate"
      />,
    );

    expect(screen.getByText("Datos insuficientes para tendencias")).toBeTruthy();
  });

  it("renders chart title and no placeholder with enough data", () => {
    render(
      <TrendAreaChart
        data={makeBuckets([95, 98, 100])}
        dataKey="successRate"
        title="Success rate"
      />,
    );

    expect(screen.getByText("Success rate")).toBeTruthy();
    expect(screen.queryByText("Datos insuficientes para tendencias")).toBeNull();
  });

  it("renders SLO reference line label when provided", () => {
    render(
      <TrendAreaChart
        data={makeBuckets([95, 98, 100])}
        dataKey="successRate"
        title="Success rate"
        sloThreshold={95}
      />,
    );

    expect(screen.getByText("Success rate")).toBeTruthy();
  });
});

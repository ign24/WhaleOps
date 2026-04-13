// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GaugeIndicator } from "@/components/observability/charts/gauge-indicator";

afterEach(() => {
  cleanup();
});

describe("GaugeIndicator", () => {
  it("shows green at 0 overflows", () => {
    const { container } = render(<GaugeIndicator value={0} label="Context overflow" />);
    const indicator = container.querySelector("[data-testid='gauge']") as HTMLElement;
    expect(indicator).toBeTruthy();
    expect(indicator.dataset.level).toBe("ok");
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("shows yellow at 1-2 overflows", () => {
    const { container } = render(<GaugeIndicator value={2} label="Context overflow" />);
    const indicator = container.querySelector("[data-testid='gauge']") as HTMLElement;
    expect(indicator.dataset.level).toBe("warning");
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("shows red at 3+ overflows", () => {
    const { container } = render(<GaugeIndicator value={5} label="Context overflow" />);
    const indicator = container.querySelector("[data-testid='gauge']") as HTMLElement;
    expect(indicator.dataset.level).toBe("critical");
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("renders label", () => {
    render(<GaugeIndicator value={0} label="Context overflow" />);
    expect(screen.getByText("Context overflow")).toBeTruthy();
  });
});

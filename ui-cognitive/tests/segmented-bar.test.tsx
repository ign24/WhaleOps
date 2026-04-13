// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SegmentedBar } from "@/components/observability/charts/segmented-bar";

afterEach(() => {
  cleanup();
});

describe("SegmentedBar", () => {
  it("renders proportional segments for completed/failed/running", () => {
    const { container } = render(
      <SegmentedBar completed={8} failed={2} running={1} />,
    );

    const segments = container.querySelectorAll("[data-testid='segment']");
    expect(segments.length).toBeGreaterThanOrEqual(2); // at least completed + failed
  });

  it("renders labels with counts", () => {
    render(<SegmentedBar completed={8} failed={2} running={1} />);

    expect(screen.getByText(/8/)).toBeTruthy();
    expect(screen.getByText(/2/)).toBeTruthy();
    expect(screen.getByText(/1/)).toBeTruthy();
  });

  it("renders fully green bar when all completed", () => {
    const { container } = render(
      <SegmentedBar completed={10} failed={0} running={0} />,
    );

    const segments = container.querySelectorAll("[data-testid='segment']");
    expect(segments.length).toBe(1);
    expect((segments[0] as HTMLElement).style.width).toBe("100%");
  });

  it("shows empty state when no entries", () => {
    render(<SegmentedBar completed={0} failed={0} running={0} />);
    expect(screen.getByText("Sin actividad")).toBeTruthy();
  });
});

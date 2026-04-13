// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProportionalBarList } from "@/components/observability/charts/proportional-bar-list";

afterEach(() => {
  cleanup();
});

describe("ProportionalBarList", () => {
  it("renders items with correct proportional widths based on max count", () => {
    const items = [
      { label: "shell_execute", count: 200 },
      { label: "read_file", count: 100 },
      { label: "write_file", count: 50 },
    ];

    render(<ProportionalBarList items={items} />);

    expect(screen.getByText("shell_execute")).toBeTruthy();
    expect(screen.getByText("read_file")).toBeTruthy();
    expect(screen.getByText("write_file")).toBeTruthy();
    expect(screen.getByText("200")).toBeTruthy();
    expect(screen.getByText("100")).toBeTruthy();
    expect(screen.getByText("50")).toBeTruthy();
  });

  it("renders empty state message when no items", () => {
    render(<ProportionalBarList items={[]} emptyMessage="No data available" />);
    expect(screen.getByText("No data available")).toBeTruthy();
  });

  it("renders default empty message when none specified", () => {
    render(<ProportionalBarList items={[]} />);
    expect(screen.getByText("Sin datos.")).toBeTruthy();
  });

  it("sets bar widths as percentage of max count", () => {
    const items = [
      { label: "tool_a", count: 100 },
      { label: "tool_b", count: 50 },
    ];

    const { container } = render(<ProportionalBarList items={items} />);
    const bars = container.querySelectorAll("[data-testid='bar-fill']");

    expect(bars.length).toBe(2);
    expect((bars[0] as HTMLElement).style.width).toBe("100%");
    expect((bars[1] as HTMLElement).style.width).toBe("50%");
  });

  it("applies color variant for error styling", () => {
    const items = [{ label: "timeout", count: 5 }];

    const { container } = render(<ProportionalBarList items={items} variant="error" />);
    const bar = container.querySelector("[data-testid='bar-fill']") as HTMLElement;

    expect(bar).toBeTruthy();
  });

  it("handles single item at 100%", () => {
    const items = [{ label: "only_tool", count: 42 }];

    const { container } = render(<ProportionalBarList items={items} />);
    const bar = container.querySelector("[data-testid='bar-fill']") as HTMLElement;

    expect(bar.style.width).toBe("100%");
    expect(screen.getByText("42")).toBeTruthy();
  });
});

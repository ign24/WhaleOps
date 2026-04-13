// @vitest-environment happy-dom

import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("useChartTheme", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns fallback colors when CSS vars are not available", async () => {
    const { useChartTheme } = await import("@/hooks/use-chart-theme");
    const { result } = renderHook(() => useChartTheme());

    expect(result.current).toHaveProperty("accent");
    expect(result.current).toHaveProperty("success");
    expect(result.current).toHaveProperty("error");
    expect(result.current).toHaveProperty("warning");
    expect(typeof result.current.accent).toBe("string");
    expect(result.current.accent.length).toBeGreaterThan(0);
  });

  it("resolves CSS custom properties from the document", async () => {
    const root = document.documentElement;
    root.style.setProperty("--success", "#22c55e");
    root.style.setProperty("--error", "#ef4444");
    root.style.setProperty("--warning", "#f59e0b");

    const { useChartTheme } = await import("@/hooks/use-chart-theme");
    const { result } = renderHook(() => useChartTheme());

    expect(result.current.accent).toBeTruthy();
    expect(result.current.success).toBeTruthy();
    expect(result.current.error).toBeTruthy();
    expect(result.current.warning).toBeTruthy();

    root.style.removeProperty("--success");
    root.style.removeProperty("--error");
    root.style.removeProperty("--warning");
  });

  it("returns all required theme keys", async () => {
    const { useChartTheme } = await import("@/hooks/use-chart-theme");
    const { result } = renderHook(() => useChartTheme());

    const keys = Object.keys(result.current);
    expect(keys).toContain("accent");
    expect(keys).toContain("success");
    expect(keys).toContain("error");
    expect(keys).toContain("warning");
    expect(keys).toContain("border");
    expect(keys).toContain("surface");
    expect(keys).toContain("textPrimary");
    expect(keys).toContain("trackBg");
  });
});

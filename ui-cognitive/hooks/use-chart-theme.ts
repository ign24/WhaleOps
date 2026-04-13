"use client";

import { useMemo } from "react";

export type ChartTheme = {
  accent: string;
  success: string;
  error: string;
  warning: string;
  border: string;
  surface: string;
  textPrimary: string;
  trackBg: string;
};

const FALLBACKS: ChartTheme = {
  accent: "#3b82f6",
  success: "#22c55e",
  error: "#ef4444",
  warning: "#f59e0b",
  border: "#27272a",
  surface: "#18181b",
  textPrimary: "#fafafa",
  trackBg: "rgba(128,128,128,0.15)",
};

const resolveTheme = (): ChartTheme => {
  if (typeof document === "undefined") {
    return FALLBACKS;
  }

  const style = getComputedStyle(document.documentElement);
  const get = (v: string) => style.getPropertyValue(v).trim();

  return {
    // Vibrant colors that work in both light and dark mode
    accent: "#3b82f6",
    success: get("--success") || FALLBACKS.success,
    error: get("--error") || FALLBACKS.error,
    warning: get("--warning") || FALLBACKS.warning,
    border: get("--border") || FALLBACKS.border,
    surface: get("--surface") || FALLBACKS.surface,
    textPrimary: get("--text-primary") || FALLBACKS.textPrimary,
    trackBg: "color-mix(in srgb, var(--text-primary) 10%, transparent)",
  };
};

export const useChartTheme = (): ChartTheme => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => resolveTheme(), []);
};

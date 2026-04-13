// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ObservabilityDashboardView } from "@/components/observability/dashboard-view";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ObservabilityDashboardView", () => {
  it("shows parser/parity warnings when diagnostics indicate mismatch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          generatedAt: new Date().toISOString(),
          monitorUsers: { active_requests: 0 },
          traceStats: {
            requests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            successRate: 0,
            failureRate: 0,
            p50LatencyMs: null,
            p95LatencyMs: null,
            avgLatencyMs: null,
            contextOverflowCount: 0,
            totalEstimatedCostUsd: 0,
            avgCostPerTraceUsd: null,
            topToolFailures: [],
            topErrorCategories: [],
            topToolsByUsage: [],
            tracesWithCost: 0,
            trendBuckets: [],
            sourcePath: "/tmp/agent_traces.jsonl",
            linesProcessed: 20,
            parserDiagnostics: {
              skippedLines: 8,
              malformedJsonLines: 1,
              missingTraceIdEvents: 7,
              nestedFieldEvents: 10,
              flatFieldEvents: 10,
            },
            parity: {
              recentWindowMinutes: 15,
              recentRuns: 0,
              recentToolEvents: 0,
              status: "warning",
              reason: "No se pudieron correlacionar requests desde trazas válidas",
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(<ObservabilityDashboardView />);

    await waitFor(() => {
      expect(screen.getByText(/Se omitieron/i)).toBeTruthy();
      expect(screen.getByText(/Paridad observabilidad/i)).toBeTruthy();
    });
  });
});

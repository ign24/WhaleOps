import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/observability", () => ({ computeTraceStats: vi.fn() }));

import { auth } from "@/auth";
import { GET } from "@/app/api/observability/summary/route";
import { computeTraceStats } from "@/lib/observability";

const authMock = vi.mocked(auth);
const computeTraceStatsMock = vi.mocked(computeTraceStats);

describe("GET /api/observability/summary", () => {
  beforeEach(() => {
    authMock.mockReset();
    computeTraceStatsMock.mockReset();
    vi.restoreAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null as never);

    const response = await GET();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns trace stats including diagnostics and parity", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    computeTraceStatsMock.mockResolvedValue({
      requests: 2,
      successfulRequests: 2,
      failedRequests: 0,
      successRate: 100,
      failureRate: 0,
      p50LatencyMs: 120,
      p95LatencyMs: 300,
      avgLatencyMs: 210,
      contextOverflowCount: 0,
      totalEstimatedCostUsd: 0,
      avgCostPerTraceUsd: 0,
      topToolFailures: [],
      topErrorCategories: [],
      topToolsByUsage: [{ tool: "shell_execute", count: 2 }],
      tracesWithCost: 0,
      sourcePath: "/tmp/agent_traces.jsonl",
      linesProcessed: 12,
      parserDiagnostics: {
        skippedLines: 1,
        malformedJsonLines: 0,
        missingTraceIdEvents: 1,
        nestedFieldEvents: 10,
        flatFieldEvents: 2,
      },
      parity: {
        recentWindowMinutes: 15,
        recentRuns: 2,
        recentToolEvents: 2,
        status: "ok",
        reason: null,
      },
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ active_requests: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await GET();
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      traceStats: { requests: number; parserDiagnostics: { skippedLines: number }; parity: { status: string } };
      costSummary: { userTotalUsd: number; perModel: Array<{ model: string; totalUsd: number }> };
    };

    expect(payload.traceStats.requests).toBe(2);
    expect(payload.traceStats.parserDiagnostics.skippedLines).toBe(1);
    expect(payload.traceStats.parity.status).toBe("ok");
    expect(payload.costSummary.userTotalUsd).toBe(0);
    expect(payload.costSummary.perModel).toEqual([]);
  });
});

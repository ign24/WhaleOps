import { describe, expect, it } from "vitest";
import { computeTrendBuckets, type TraceSummary } from "@/lib/observability";

const makeTrace = (
  startedAt: number,
  endedAt: number,
  opts: { failed?: boolean; costUsd?: number } = {},
): TraceSummary => ({
  startedAt,
  endedAt,
  durationMs: endedAt - startedAt,
  failed: opts.failed ?? false,
  estimatedCostUsd: opts.costUsd ?? 0,
});

describe("computeTrendBuckets", () => {
  it("returns empty array when fewer than 3 traces", () => {
    const traces = [makeTrace(1000, 2000), makeTrace(3000, 4000)];
    const buckets = computeTrendBuckets(traces);
    expect(buckets).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(computeTrendBuckets([])).toEqual([]);
  });

  it("produces up to 10 buckets across the time range", () => {
    const baseTime = 1_700_000_000_000;
    const traces: TraceSummary[] = [];
    // 20 traces spread over 10 hours
    for (let i = 0; i < 20; i++) {
      const start = baseTime + i * 1_800_000; // 30 min apart
      traces.push(makeTrace(start, start + 5000));
    }

    const buckets = computeTrendBuckets(traces);
    expect(buckets.length).toBeLessThanOrEqual(10);
    expect(buckets.length).toBeGreaterThanOrEqual(1);

    for (const bucket of buckets) {
      expect(bucket).toHaveProperty("timestamp");
      expect(bucket).toHaveProperty("requests");
      expect(bucket).toHaveProperty("failures");
      expect(bucket).toHaveProperty("p50Ms");
      expect(bucket).toHaveProperty("p95Ms");
      expect(bucket).toHaveProperty("costUsd");
    }
  });

  it("aggregates requests and failures per bucket", () => {
    const baseTime = 1_700_000_000_000;
    const traces = [
      makeTrace(baseTime, baseTime + 1000),
      makeTrace(baseTime + 100, baseTime + 2000, { failed: true }),
      makeTrace(baseTime + 200, baseTime + 3000),
      // All in same time window -> single bucket
    ];

    const buckets = computeTrendBuckets(traces);
    const totalRequests = buckets.reduce((sum, b) => sum + b.requests, 0);
    const totalFailures = buckets.reduce((sum, b) => sum + b.failures, 0);

    expect(totalRequests).toBe(3);
    expect(totalFailures).toBe(1);
  });

  it("calculates cost per bucket", () => {
    const baseTime = 1_700_000_000_000;
    const gap = 3_600_000; // 1 hour apart
    const traces = [
      makeTrace(baseTime, baseTime + 1000, { costUsd: 0.05 }),
      makeTrace(baseTime + gap, baseTime + gap + 1000, { costUsd: 0.10 }),
      makeTrace(baseTime + gap * 2, baseTime + gap * 2 + 1000, { costUsd: 0.15 }),
    ];

    const buckets = computeTrendBuckets(traces);
    const totalCost = buckets.reduce((sum, b) => sum + b.costUsd, 0);
    expect(totalCost).toBeCloseTo(0.30, 2);
  });

  it("returns single bucket when all traces are in same time window", () => {
    const baseTime = 1_700_000_000_000;
    const traces = [
      makeTrace(baseTime, baseTime + 100),
      makeTrace(baseTime + 10, baseTime + 200),
      makeTrace(baseTime + 20, baseTime + 300),
    ];

    const buckets = computeTrendBuckets(traces);
    expect(buckets.length).toBe(1);
    expect(buckets[0].requests).toBe(3);
  });
});

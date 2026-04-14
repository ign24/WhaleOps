import { describe, expect, it } from "vitest";

import { buildStrategicSignals } from "@/lib/ops-strategic-signals";

describe("buildStrategicSignals", () => {
  it("computes deterministic KPIs for normal fixtures", () => {
    const result = buildStrategicSignals({
      generatedAt: "2026-04-14T02:00:00Z",
      containers: {
        data: [
          {
            name: "web",
            id: "c1",
            image: "nginx",
            status: "running",
            state: "running",
            ports: [],
            created_at: "",
            started_at: "",
          },
          {
            name: "worker",
            id: "c2",
            image: "python",
            status: "running",
            state: "running",
            ports: [],
            created_at: "",
            started_at: "",
          },
        ],
        error: null,
      },
      jobs: {
        data: [
          { id: "j1", description: "daily", cron_expr: "0 2 * * *", next_run: null, status: "paused" },
          { id: "j2", description: "hourly", cron_expr: "0 * * * *", next_run: "2026-04-14T03:00:00Z", status: "active" },
        ],
        error: null,
      },
      observability: {
        data: { monitorUsers: { avg_latency_ms: 400, error_count: 0 } },
        error: null,
      },
    });

    expect(result.generatedAt).toBe("2026-04-14T02:00:00Z");
    expect(result.running).toBe(2);
    expect(result.total).toBe(2);
    expect(result.degraded).toBe(0);
    expect(result.activeJobs).toBe(1);
    expect(result.avgLatencyMs).toBe(400);
    expect(result.errorCount).toBe(0);
    expect(result.alerts).toHaveLength(0);
  });

  it("creates alerts for degraded and partial source failures", () => {
    const result = buildStrategicSignals({
      generatedAt: "2026-04-14T02:00:00Z",
      containers: {
        data: [
          {
            name: "web",
            id: "c1",
            image: "nginx",
            status: "running",
            state: "restarting",
            ports: [],
            created_at: "",
            started_at: "",
          },
        ],
        error: null,
      },
      jobs: {
        data: null,
        error: "jobs timeout",
      },
      observability: {
        data: { traceStats: { avgLatencyMs: 2100, failedRequests: 3 } },
        error: null,
      },
      latencyAlertThresholdMs: 1200,
      errorAlertThreshold: 0,
    });

    expect(result.degraded).toBe(1);
    expect(result.degradedNames).toEqual(["web"]);
    expect(result.alerts.map((a) => a.code)).toContain("degraded_containers");
    expect(result.alerts.map((a) => a.code)).toContain("high_latency");
    expect(result.alerts.map((a) => a.code)).toContain("high_error_rate");
    expect(result.alerts.map((a) => a.code)).toContain("source_unavailable");
    expect(result.sources.jobs.status).toBe("degraded");
  });
});

import { promises as fs } from "fs";
import os from "os";
import path from "path";

import { afterEach, describe, expect, it } from "vitest";

import { computeTraceStats } from "@/lib/observability";

const envBackup = {
  tracesPath: process.env.TRACES_PATH,
  inputCost: process.env.OBS_COST_INPUT_PER_1K,
  outputCost: process.env.OBS_COST_OUTPUT_PER_1K,
  nodeEnv: process.env.NODE_ENV,
};

afterEach(async () => {
  process.env.TRACES_PATH = envBackup.tracesPath;
  process.env.OBS_COST_INPUT_PER_1K = envBackup.inputCost;
  process.env.OBS_COST_OUTPUT_PER_1K = envBackup.outputCost;
  process.env.NODE_ENV = envBackup.nodeEnv;
});

describe("computeTraceStats", () => {
  it("counts context overflow in top error categories", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "obs-test-"));
    const tracesPath = path.join(tempDir, "agent_traces.jsonl");

    const event = {
      workflow_run_id: "trace-ctx-1",
      timestamp: Date.now(),
      event_type: "LLM_END",
      payload: {
        message: "maximum context length exceeded",
      },
    };

    await fs.writeFile(tracesPath, `${JSON.stringify(event)}\n`, "utf8");
    process.env.TRACES_PATH = tracesPath;

    const stats = await computeTraceStats();

    expect(stats.requests).toBe(1);
    expect(stats.contextOverflowCount).toBe(1);
    expect(stats.topErrorCategories).toContainEqual({
      category: "context_overflow",
      count: 1,
    });

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("computes p50 and p95 latency using duration when timestamp is absent", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "obs-test-"));
    const tracesPath = path.join(tempDir, "agent_traces.jsonl");

    const lines = [120, 300, 600, 1200].map((duration, index) =>
      JSON.stringify({
        workflow_run_id: `trace-lat-${index + 1}`,
        event_type: "WORKFLOW_END",
        payload: { duration_ms: duration },
      }),
    );

    await fs.writeFile(tracesPath, `${lines.join("\n")}\n`, "utf8");
    process.env.TRACES_PATH = tracesPath;

    const stats = await computeTraceStats();

    expect(stats.requests).toBe(4);
    expect(stats.p50LatencyMs).toBe(300);
    expect(stats.p95LatencyMs).toBe(1200);

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("estimates trace cost from token usage and configured rates", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "obs-test-"));
    const tracesPath = path.join(tempDir, "agent_traces.jsonl");

    const first = {
      workflow_run_id: "trace-cost-1",
      timestamp: Date.now(),
      event_type: "LLM_END",
      usage_info: { token_usage: { prompt_tokens: 1000, completion_tokens: 500 } },
    };
    const second = {
      workflow_run_id: "trace-cost-2",
      timestamp: Date.now() + 1,
      event_type: "LLM_END",
      usage_info: { token_usage: { prompt_tokens: 500, completion_tokens: 500 } },
    };

    await fs.writeFile(tracesPath, `${JSON.stringify(first)}\n${JSON.stringify(second)}\n`, "utf8");
    process.env.TRACES_PATH = tracesPath;
    process.env.OBS_COST_INPUT_PER_1K = "0.002";
    process.env.OBS_COST_OUTPUT_PER_1K = "0.004";

    const stats = await computeTraceStats();

    expect(stats.requests).toBe(2);
    expect(stats.totalEstimatedCostUsd).toBeCloseTo(0.007, 6);
    expect(stats.avgCostPerTraceUsd).toBeCloseTo(0.0035, 6);
    expect(stats.tracesWithCost).toBe(2);

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("parses nested NAT trace schema and counts requests", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "obs-test-"));
    const tracesPath = path.join(tempDir, "agent_traces.jsonl");

    const lines = [
      {
        payload: {
          event_type: "WORKFLOW_START",
          event_timestamp: 1_775_000_000.1,
          metadata: {
            provided_metadata: {
              workflow_run_id: "run-nested-1",
              conversation_id: "conv-1",
            },
          },
        },
      },
      {
        payload: {
          event_type: "TOOL_START",
          event_timestamp: 1_775_000_001.1,
          name: "shell_execute",
          metadata: {
            provided_metadata: {
              workflow_run_id: "run-nested-1",
              conversation_id: "conv-1",
            },
          },
        },
      },
      {
        payload: {
          event_type: "WORKFLOW_END",
          event_timestamp: 1_775_000_003.1,
          metadata: {
            provided_metadata: {
              workflow_run_id: "run-nested-1",
              conversation_id: "conv-1",
            },
          },
        },
      },
    ];

    await fs.writeFile(tracesPath, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`, "utf8");
    process.env.TRACES_PATH = tracesPath;

    const stats = await computeTraceStats();

    expect(stats.requests).toBe(1);
    expect(stats.topToolsByUsage).toContainEqual({ tool: "shell_execute", count: 1 });
    expect(stats.parserDiagnostics.nestedFieldEvents).toBeGreaterThan(0);
    expect(stats.parserDiagnostics.missingTraceIdEvents).toBe(0);

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("handles mixed schema traces and reports diagnostics", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "obs-test-"));
    const tracesPath = path.join(tempDir, "agent_traces.jsonl");

    const validFlat = {
      workflow_run_id: "run-flat-1",
      event_type: "WORKFLOW_END",
      timestamp: Date.now(),
    };
    const validNested = {
      payload: {
        event_type: "WORKFLOW_END",
        event_timestamp: 1_775_000_005.5,
        metadata: {
          provided_metadata: {
            workflow_run_id: "run-nested-2",
          },
        },
      },
    };
    const invalidNoRunId = {
      payload: {
        event_type: "WORKFLOW_END",
        event_timestamp: 1_775_000_006.5,
      },
    };

    await fs.writeFile(
      tracesPath,
      `${JSON.stringify(validFlat)}\n${JSON.stringify(validNested)}\n${JSON.stringify(invalidNoRunId)}\n{bad json}\n`,
      "utf8",
    );
    process.env.TRACES_PATH = tracesPath;

    const stats = await computeTraceStats();

    expect(stats.requests).toBe(2);
    expect(stats.parserDiagnostics.flatFieldEvents).toBeGreaterThan(0);
    expect(stats.parserDiagnostics.nestedFieldEvents).toBeGreaterThan(0);
    expect(stats.parserDiagnostics.missingTraceIdEvents).toBe(1);
    expect(stats.parserDiagnostics.malformedJsonLines).toBe(1);
    expect(stats.parserDiagnostics.skippedLines).toBe(2);

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("marks observability as warning when TRACES_PATH is missing in production", async () => {
    delete process.env.TRACES_PATH;
    process.env.NODE_ENV = "production";

    const stats = await computeTraceStats();

    expect(stats.sourcePath).toBeNull();
    expect(stats.parity.status).toBe("warning");
    expect(stats.parity.reason).toContain("TRACES_PATH");
  });
});

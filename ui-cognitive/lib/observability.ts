import { createReadStream, existsSync } from "fs";
import path from "path";
import readline from "readline";

type TraceEvent = Record<string, unknown>;

type TraceStats = {
  requests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  failureRate: number;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  avgLatencyMs: number | null;
  contextOverflowCount: number;
  totalEstimatedCostUsd: number;
  avgCostPerTraceUsd: number | null;
  topToolFailures: Array<{ tool: string; count: number }>;
  topErrorCategories: Array<{ category: string; count: number }>;
  topToolsByUsage: Array<{ tool: string; count: number }>;
  tracesWithCost: number;
  sourcePath: string | null;
  linesProcessed: number;
  parserDiagnostics: {
    skippedLines: number;
    malformedJsonLines: number;
    missingTraceIdEvents: number;
    nestedFieldEvents: number;
    flatFieldEvents: number;
  };
  parity: {
    recentWindowMinutes: number;
    recentRuns: number;
    recentToolEvents: number;
    status: "ok" | "warning";
    reason: string | null;
  };
  trendBuckets: TrendBucket[];
};

export type TrendBucket = {
  timestamp: number;
  requests: number;
  failures: number;
  p50Ms: number | null;
  p95Ms: number | null;
  costUsd: number;
};

export type TraceSummary = {
  startedAt: number;
  endedAt: number;
  durationMs: number;
  failed: boolean;
  estimatedCostUsd: number;
};

type TraceBucket = {
  startedAt: number | null;
  endedAt: number | null;
  fallbackDurationMs: number | null;
  failed: boolean;
  contextOverflow: boolean;
  errorCategories: Set<string>;
  estimatedCostUsd: number;
};

const MAX_TRACE_LINES = 60_000;
const DEFAULT_PARITY_WINDOW_MINUTES = 15;

const parseEnvNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
};

const estimateCostUsd = (event: TraceEvent): number => {
  const tokenUsage = getRecord(getPath(event, ["usage_info", "token_usage"])) ??
    getRecord(getPath(event, ["token_usage"]));

  if (!tokenUsage) {
    return 0;
  }

  const promptTokens = getNumber(tokenUsage.prompt_tokens) ?? 0;
  const completionTokens = getNumber(tokenUsage.completion_tokens) ?? 0;

  const inputCostPer1k = parseEnvNumber(process.env.OBS_COST_INPUT_PER_1K, 0);
  const outputCostPer1k = parseEnvNumber(process.env.OBS_COST_OUTPUT_PER_1K, 0);

  if (inputCostPer1k === 0 && outputCostPer1k === 0) {
    return 0;
  }

  const promptCost = (promptTokens / 1000) * inputCostPer1k;
  const completionCost = (completionTokens / 1000) * outputCostPer1k;
  return promptCost + completionCost;
};

const getPath = (value: unknown, keys: string[]): unknown => {
  let current: unknown = value;
  for (const key of keys) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
};

const getRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const getNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const toLowerText = (value: unknown): string => {
  if (typeof value === "string") {
    return value.toLowerCase();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).toLowerCase();
  }
  return "";
};

const pickTraceId = (event: TraceEvent): string | null => {
  const direct = event["nat.workflow.run_id"];
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct.trim();
  }

  const candidates = [
    event.workflow_run_id,
    event.workflowRunId,
    event.trace_id,
    event.traceId,
    getPath(event, ["payload", "metadata", "provided_metadata", "workflow_run_id"]),
    getPath(event, ["payload", "metadata", "provided_metadata", "workflow_trace_id"]),
    getPath(event, ["payload", "workflow_run_id"]),
    getPath(event, ["payload", "trace_id"]),
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
};

const pickEventType = (event: TraceEvent): string => {
  const candidates = [
    event.event_type,
    getPath(event, ["payload", "event_type"]),
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return "";
};

const pickTimestampMs = (event: TraceEvent): number | null => {
  const candidates = [
    event.timestamp,
    event.time,
    event.created_at,
    event.createdAt,
    getPath(event, ["payload", "event_timestamp"]),
    getPath(event, ["payload", "span_event_timestamp"]),
    getPath(event, ["payload", "timestamp"]),
  ];

  for (const candidate of candidates) {
    const numeric = getNumber(candidate);
    if (numeric !== null) {
      if (numeric > 1_000_000_000_000) {
        return Math.floor(numeric);
      }
      if (numeric > 1_000_000_000) {
        return Math.floor(numeric * 1000);
      }
    }

    if (typeof candidate === "string") {
      const parsed = Date.parse(candidate);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return null;
};

const pickDurationMs = (event: TraceEvent): number | null => {
  const direct = [
    event.duration_ms,
    getPath(event, ["payload", "duration_ms"]),
    getPath(event, ["payload", "latency_ms"]),
  ];

  for (const candidate of direct) {
    const value = getNumber(candidate);
    if (value !== null && value >= 0) {
      return value;
    }
  }

  const eventTimestamp = getNumber(getPath(event, ["payload", "event_timestamp"]));
  const spanTimestamp = getNumber(getPath(event, ["payload", "span_event_timestamp"]));
  if (eventTimestamp !== null && spanTimestamp !== null && eventTimestamp >= spanTimestamp) {
    return Math.max(0, (eventTimestamp - spanTimestamp) * 1000);
  }

  return null;
};

const pickToolName = (event: TraceEvent): string | null => {
  const candidates = [
    event.name,
    event.tool,
    event.tool_name,
    getPath(event, ["payload", "tool_name"]),
    getPath(event, ["payload", "name"]),
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
};

const isToolEvent = (event: TraceEvent): boolean => {
  const eventType = toLowerText(pickEventType(event));
  if (eventType.includes("tool")) {
    return true;
  }
  const name = toLowerText(pickToolName(event));
  return name.includes("tool");
};

const isFailedEvent = (event: TraceEvent): boolean => {
  const values = [
    pickEventType(event),
    event.status,
    event.state,
    getPath(event, ["payload", "status"]),
    getPath(event, ["payload", "state"]),
    getPath(event, ["payload", "metadata", "tool_outputs", "status"]),
    getPath(event, ["payload", "error"]),
    getPath(event, ["payload", "metadata", "tool_outputs", "content"]),
    getPath(event, ["error"]),
  ];

  return values.some((value) => {
    const text = toLowerText(value);
    return text.includes("fail") || text.includes("error") || text.includes("abort") || text.includes("timeout");
  });
};

const hasContextOverflow = (event: TraceEvent): boolean => {
  const values = [
    event.error,
    event.output,
    getPath(event, ["payload", "error"]),
    getPath(event, ["payload", "message"]),
    getPath(event, ["payload", "output"]),
  ];

  return values.some((value) => {
    const text = toLowerText(value);
    return (
      text.includes("context window") ||
      text.includes("maximum context") ||
      text.includes("context length") ||
      text.includes("too many tokens")
    );
  });
};

const classifyErrorCategory = (event: TraceEvent): string | null => {
  const merged = [
    toLowerText(event.error),
    toLowerText(pickEventType(event)),
    toLowerText(event.status),
    toLowerText(getPath(event, ["payload", "status"])),
    toLowerText(getPath(event, ["payload", "error"])),
    toLowerText(getPath(event, ["payload", "message"])),
    toLowerText(getPath(event, ["payload", "metadata", "tool_outputs", "content"])),
  ].join(" ");

  if (!merged.trim()) {
    return null;
  }

  if (merged.includes("context window") || merged.includes("too many tokens") || merged.includes("context length")) {
    return "context_overflow";
  }
  if (merged.includes("timeout") || merged.includes("timed out")) {
    return "timeout";
  }
  if (merged.includes("rate limit") || merged.includes("429")) {
    return "rate_limit";
  }
  if (merged.includes("auth") || merged.includes("unauthorized") || merged.includes("forbidden") || merged.includes("401")) {
    return "auth";
  }
  if (merged.includes("network") || merged.includes("connection") || merged.includes("dns") || merged.includes("econn")) {
    return "network";
  }
  if (merged.includes("tool")) {
    return "tool_failure";
  }
  return "other";
};

const percentile = (sorted: number[], p: number): number | null => {
  if (sorted.length === 0) {
    return null;
  }
  const clamped = Math.max(0, Math.min(100, p));
  const index = Math.ceil((clamped / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? null;
};

const resolveTracePath = (): { sourcePath: string | null; warningReason: string | null } => {
  const configured = process.env.TRACES_PATH?.trim();
  const isProduction = process.env.NODE_ENV === "production";

  if (configured) {
    if (existsSync(configured)) {
      return { sourcePath: configured, warningReason: null };
    }

    if (isProduction) {
      return {
        sourcePath: null,
        warningReason: "TRACES_PATH esta configurado pero no es accesible desde la UI",
      };
    }
  }

  if (isProduction) {
    return {
      sourcePath: null,
      warningReason: "TRACES_PATH es obligatorio en produccion",
    };
  }

  const candidates = [
    path.join(process.cwd(), "traces", "agent_traces.jsonl"),
    path.join(process.cwd(), "..", "traces", "agent_traces.jsonl"),
    "/app/traces/agent_traces.jsonl",
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return { sourcePath: candidate, warningReason: null };
    }
  }

  return { sourcePath: null, warningReason: null };
};

const TREND_BUCKET_COUNT = 10;

export const computeTrendBuckets = (traces: TraceSummary[]): TrendBucket[] => {
  if (traces.length < 3) {
    return [];
  }

  let minTime = Infinity;
  let maxTime = -Infinity;
  for (const trace of traces) {
    if (trace.startedAt < minTime) minTime = trace.startedAt;
    if (trace.endedAt > maxTime) maxTime = trace.endedAt;
  }

  const range = maxTime - minTime;
  const bucketCount = range === 0 ? 1 : Math.min(TREND_BUCKET_COUNT, traces.length);
  const bucketWidth = range === 0 ? 1 : range / bucketCount;

  const buckets: Array<{
    timestamp: number;
    durations: number[];
    failures: number;
    requests: number;
    costUsd: number;
  }> = [];

  for (let i = 0; i < bucketCount; i++) {
    buckets.push({
      timestamp: minTime + bucketWidth * i + bucketWidth / 2,
      durations: [],
      failures: 0,
      requests: 0,
      costUsd: 0,
    });
  }

  for (const trace of traces) {
    const index = range === 0 ? 0 : Math.min(Math.floor((trace.startedAt - minTime) / bucketWidth), bucketCount - 1);
    const bucket = buckets[index];
    bucket.requests += 1;
    bucket.durations.push(trace.durationMs);
    if (trace.failed) bucket.failures += 1;
    bucket.costUsd += trace.estimatedCostUsd;
  }

  return buckets
    .filter((b) => b.requests > 0)
    .map((b) => {
      const sorted = [...b.durations].sort((a, c) => a - c);
      return {
        timestamp: b.timestamp,
        requests: b.requests,
        failures: b.failures,
        p50Ms: percentile(sorted, 50),
        p95Ms: percentile(sorted, 95),
        costUsd: b.costUsd,
      };
    });
};

export const computeTraceStats = async (): Promise<TraceStats> => {
  const { sourcePath, warningReason } = resolveTracePath();
  if (!sourcePath) {
    return {
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
      sourcePath: null,
      linesProcessed: 0,
      parserDiagnostics: {
        skippedLines: 0,
        malformedJsonLines: 0,
        missingTraceIdEvents: 0,
        nestedFieldEvents: 0,
        flatFieldEvents: 0,
      },
      parity: {
        recentWindowMinutes: DEFAULT_PARITY_WINDOW_MINUTES,
        recentRuns: 0,
        recentToolEvents: 0,
        status: warningReason ? "warning" : "ok",
        reason: warningReason,
      },
      trendBuckets: [],
    };
  }

  const traces = new Map<string, TraceBucket>();
  const toolFailures = new Map<string, number>();
  const toolUsage = new Map<string, number>();
  const recentToolEventByTrace = new Map<string, number>();

  let linesProcessed = 0;
  let skippedLines = 0;
  let malformedJsonLines = 0;
  let missingTraceIdEvents = 0;
  let nestedFieldEvents = 0;
  let flatFieldEvents = 0;
  let maxTimestampSeen: number | null = null;

  const stream = createReadStream(sourcePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const rawLine of rl) {
    if (linesProcessed >= MAX_TRACE_LINES) {
      break;
    }

    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    linesProcessed += 1;

    let event: TraceEvent;
    try {
      event = JSON.parse(line) as TraceEvent;
    } catch {
      malformedJsonLines += 1;
      skippedLines += 1;
      continue;
    }

    if (getPath(event, ["payload", "event_type"]) !== undefined) {
      nestedFieldEvents += 1;
    }
    if (event.event_type !== undefined || event.trace_id !== undefined || event.workflow_run_id !== undefined) {
      flatFieldEvents += 1;
    }

    const traceId = pickTraceId(event);
    if (!traceId) {
      missingTraceIdEvents += 1;
      skippedLines += 1;
      continue;
    }

    const timestamp = pickTimestampMs(event);
    const durationMs = pickDurationMs(event);
    if (timestamp !== null) {
      maxTimestampSeen = maxTimestampSeen === null ? timestamp : Math.max(maxTimestampSeen, timestamp);
    }
    const eventType = pickEventType(event).toLowerCase();
    const failedEvent = isFailedEvent(event);

    const bucket = traces.get(traceId) ?? {
      startedAt: null,
      endedAt: null,
      fallbackDurationMs: null,
      failed: false,
      contextOverflow: false,
      errorCategories: new Set<string>(),
      estimatedCostUsd: 0,
    };

    if (timestamp !== null) {
      bucket.startedAt = bucket.startedAt === null ? timestamp : Math.min(bucket.startedAt, timestamp);
      bucket.endedAt = bucket.endedAt === null ? timestamp : Math.max(bucket.endedAt, timestamp);
    }

    if (timestamp !== null && durationMs !== null) {
      const end = timestamp + durationMs;
      bucket.endedAt = bucket.endedAt === null ? end : Math.max(bucket.endedAt, end);
    }

    if (timestamp === null && durationMs !== null) {
      bucket.fallbackDurationMs =
        bucket.fallbackDurationMs === null
          ? durationMs
          : Math.max(bucket.fallbackDurationMs, durationMs);
    }

    if (failedEvent) {
      bucket.failed = true;
      const category = classifyErrorCategory(event);
      if (category) {
        bucket.errorCategories.add(category);
      }
    }

    if (hasContextOverflow(event)) {
      bucket.contextOverflow = true;
      bucket.errorCategories.add("context_overflow");
    }

    const tool = pickToolName(event);
    if (isToolEvent(event) && tool) {
      const shouldCountUsage = eventType.includes("tool_start") || eventType === "";
      if (shouldCountUsage) {
        toolUsage.set(tool, (toolUsage.get(tool) ?? 0) + 1);
      }

      const shouldCountFailure = failedEvent && (!eventType.includes("tool_start") || eventType === "");
      if (shouldCountFailure) {
        toolFailures.set(tool, (toolFailures.get(tool) ?? 0) + 1);
      }

      if (timestamp !== null) {
        recentToolEventByTrace.set(traceId, Math.max(recentToolEventByTrace.get(traceId) ?? 0, timestamp));
      }
    }

    bucket.estimatedCostUsd += estimateCostUsd(event);
    traces.set(traceId, bucket);
  }

  const durations: number[] = [];
  let failedRequests = 0;
  let contextOverflowCount = 0;
  let totalEstimatedCostUsd = 0;
  let tracesWithCost = 0;
  const errorCategories = new Map<string, number>();

  for (const [, trace] of traces) {
    const duration =
      trace.startedAt !== null && trace.endedAt !== null
        ? trace.endedAt - trace.startedAt
        : trace.fallbackDurationMs;
    if (duration !== null && duration >= 0) {
      durations.push(duration);
    }

    if (trace.failed) {
      failedRequests += 1;
    }
    if (trace.contextOverflow) {
      contextOverflowCount += 1;
    }

    for (const category of trace.errorCategories) {
      errorCategories.set(category, (errorCategories.get(category) ?? 0) + 1);
    }

    totalEstimatedCostUsd += trace.estimatedCostUsd;
    if (trace.estimatedCostUsd > 0) {
      tracesWithCost += 1;
    }
  }

  const requests = traces.size;
  const successfulRequests = Math.max(0, requests - failedRequests);
  const successRate = requests > 0 ? (successfulRequests / requests) * 100 : 0;
  const failureRate = requests > 0 ? (failedRequests / requests) * 100 : 0;

  const sortedDurations = [...durations].sort((a, b) => a - b);
  const p50LatencyMs = percentile(sortedDurations, 50);
  const p95LatencyMs = percentile(sortedDurations, 95);
  const avgLatencyMs =
    durations.length > 0 ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null;

  const topToolFailures = Array.from(toolFailures.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tool, count]) => ({ tool, count }));

  const topToolsByUsage = Array.from(toolUsage.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tool, count]) => ({ tool, count }));

  const topErrorCategories = Array.from(errorCategories.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, count]) => ({ category, count }));

  const parityWindowMinutes = parseEnvNumber(
    process.env.OBS_PARITY_WINDOW_MINUTES,
    DEFAULT_PARITY_WINDOW_MINUTES,
  );
  const windowMs = Math.max(1, Math.floor(parityWindowMinutes * 60 * 1000));
  const latestTimestamp = maxTimestampSeen ?? Date.now();
  const thresholdTimestamp = latestTimestamp - windowMs;
  let recentRuns = 0;
  for (const [, trace] of traces) {
    const traceLatest = trace.endedAt ?? trace.startedAt;
    if (traceLatest !== null && traceLatest >= thresholdTimestamp) {
      recentRuns += 1;
    }
  }
  let recentToolEvents = 0;
  for (const [, timestamp] of recentToolEventByTrace) {
    if (timestamp >= thresholdTimestamp) {
      recentToolEvents += 1;
    }
  }

  let parityStatus: "ok" | "warning" = "ok";
  let parityReason: string | null = null;
  if (linesProcessed > 0 && requests === 0) {
    parityStatus = "warning";
    parityReason = "No se pudieron correlacionar requests desde trazas válidas";
  } else if (skippedLines > 0 && skippedLines >= Math.max(5, Math.floor(linesProcessed * 0.2))) {
    parityStatus = "warning";
    parityReason = "Muchas trazas fueron omitidas por incompatibilidad de esquema";
  }

  const traceSummaries: TraceSummary[] = [];
  for (const [, trace] of traces) {
    if (trace.startedAt !== null && trace.endedAt !== null) {
      traceSummaries.push({
        startedAt: trace.startedAt,
        endedAt: trace.endedAt,
        durationMs: trace.endedAt - trace.startedAt,
        failed: trace.failed,
        estimatedCostUsd: trace.estimatedCostUsd,
      });
    }
  }
  const trendBuckets = computeTrendBuckets(traceSummaries);

  return {
    requests,
    successfulRequests,
    failedRequests,
    successRate,
    failureRate,
    p50LatencyMs,
    p95LatencyMs,
    avgLatencyMs,
    contextOverflowCount,
    totalEstimatedCostUsd,
    avgCostPerTraceUsd: requests > 0 ? totalEstimatedCostUsd / requests : null,
    topToolFailures,
    topErrorCategories,
    topToolsByUsage,
    tracesWithCost,
    sourcePath,
    linesProcessed,
    parserDiagnostics: {
      skippedLines,
      malformedJsonLines,
      missingTraceIdEvents,
      nestedFieldEvents,
      flatFieldEvents,
    },
    parity: {
      recentWindowMinutes: parityWindowMinutes,
      recentRuns,
      recentToolEvents,
      status: parityStatus,
      reason: parityReason,
    },
    trendBuckets,
  };
};

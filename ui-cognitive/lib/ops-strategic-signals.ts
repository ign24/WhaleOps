import type {
  CronJobItem,
  OpsContainer,
  OpsExceptionAlert,
  OpsStrategicSignals,
} from "@/types/ops";

type ObservabilitySummary = {
  traceStats?: {
    avgLatencyMs?: number | null;
    failedRequests?: number;
  };
  monitorUsers?: {
    avg_latency_ms?: number;
    error_count?: number;
  } | null;
};

type SourceData<T> = {
  data: T | null;
  error: string | null;
};

export type BuildSignalsInput = {
  containers: SourceData<OpsContainer[]>;
  jobs: SourceData<CronJobItem[]>;
  observability: SourceData<ObservabilitySummary>;
  generatedAt?: string;
  latencyAlertThresholdMs?: number;
  errorAlertThreshold?: number;
};

const DEGRADED_STATES = new Set(["restarting", "exited", "dead", "unhealthy", "paused"]);

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
};

export const buildStrategicSignals = (input: BuildSignalsInput): OpsStrategicSignals => {
  const latencyThreshold = input.latencyAlertThresholdMs ?? 1_200;
  const errorThreshold = input.errorAlertThreshold ?? 0;

  const containers = input.containers.data ?? [];
  const jobs = input.jobs.data ?? [];
  const observability = input.observability.data;

  const degradedContainers = containers.filter((container) =>
    DEGRADED_STATES.has(container.state.toLowerCase()),
  );
  const running = containers.filter((container) => container.state.toLowerCase() === "running").length;
  const activeJobs = jobs.filter((job) => job.status === "active").length;

  const latencyFromMonitor = asNumber(observability?.monitorUsers?.avg_latency_ms);
  const latencyFromTraces = asNumber(observability?.traceStats?.avgLatencyMs ?? null);
  const avgLatencyMs = latencyFromMonitor ?? latencyFromTraces;

  const errorsFromMonitor = asNumber(observability?.monitorUsers?.error_count);
  const errorsFromTraces = asNumber(observability?.traceStats?.failedRequests ?? null);
  const errorCount = Math.max(0, errorsFromMonitor ?? errorsFromTraces ?? 0);

  const alerts: OpsExceptionAlert[] = [];

  if (degradedContainers.length > 0) {
    alerts.push({
      code: "degraded_containers",
      severity: "error",
      message: `Hay ${degradedContainers.length} contenedor(es) degradado(s): ${degradedContainers
        .map((c) => c.name)
        .join(", ")}`,
    });
  }

  if (avgLatencyMs !== null && avgLatencyMs > latencyThreshold) {
    alerts.push({
      code: "high_latency",
      severity: "warning",
      message: `Latencia promedio alta: ${Math.round(avgLatencyMs)}ms (umbral ${latencyThreshold}ms).`,
    });
  }

  if (errorCount > errorThreshold) {
    alerts.push({
      code: "high_error_rate",
      severity: "warning",
      message: `Errores recientes detectados: ${errorCount}.`,
    });
  }

  if (input.containers.error || input.jobs.error || input.observability.error) {
    const failedSources = [
      input.containers.error ? "status" : null,
      input.jobs.error ? "jobs" : null,
      input.observability.error ? "observability" : null,
    ].filter(Boolean);
    alerts.push({
      code: "source_unavailable",
      severity: "warning",
      message: `Fuentes degradadas: ${failedSources.join(", ")}.`,
    });
  }

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    running,
    total: containers.length,
    degraded: degradedContainers.length,
    degradedNames: degradedContainers.map((c) => c.name),
    activeJobs,
    avgLatencyMs,
    errorCount,
    sources: {
      status: {
        status: input.containers.error ? "degraded" : "ok",
        reason: input.containers.error,
      },
      jobs: {
        status: input.jobs.error ? "degraded" : "ok",
        reason: input.jobs.error,
      },
      observability: {
        status: input.observability.error ? "degraded" : "ok",
        reason: input.observability.error,
      },
    },
    alerts,
  };
};

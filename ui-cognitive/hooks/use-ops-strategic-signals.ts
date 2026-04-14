"use client";

import { useMemo } from "react";
import type { CronJobItem, OpsContainer, OpsStrategicSignals } from "@/types/ops";
import { buildStrategicSignals } from "@/lib/ops-strategic-signals";

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

type OpsSignalsInput = {
  containers: OpsContainer[];
  statusError: string | null;
  jobs: CronJobItem[];
  jobsError: string | null;
  observability: ObservabilitySummary | null;
  observabilityError: string | null;
};

export const useOpsStrategicSignals = (input: OpsSignalsInput): OpsStrategicSignals => {
  return useMemo(
    () =>
      buildStrategicSignals({
        containers: { data: input.containers, error: input.statusError },
        jobs: { data: input.jobs, error: input.jobsError },
        observability: { data: input.observability, error: input.observabilityError },
      }),
    [
      input.containers,
      input.statusError,
      input.jobs,
      input.jobsError,
      input.observability,
      input.observabilityError,
    ],
  );
};

"use client";

import { useCallback, useEffect, useState } from "react";

const REFRESH_INTERVAL_MS = 30_000;

export type OpsObservabilitySummary = {
  traceStats?: {
    avgLatencyMs?: number | null;
    failedRequests?: number;
  };
  monitorUsers?: {
    avg_latency_ms?: number;
    error_count?: number;
  } | null;
};

export type OpsObservabilityState = {
  summary: OpsObservabilitySummary | null;
  isLoading: boolean;
  error: string | null;
};

export const useOpsObservability = (): OpsObservabilityState => {
  const [summary, setSummary] = useState<OpsObservabilitySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/observability/summary");
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setSummary(null);
        setError(payload.error ?? `Error ${res.status}`);
      } else {
        const payload = (await res.json()) as OpsObservabilitySummary;
        setSummary(payload);
        setError(null);
      }
    } catch {
      setSummary(null);
      setError("No se pudo cargar observabilidad");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSummary();
    const id = setInterval(() => void fetchSummary(), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchSummary]);

  return { summary, isLoading, error };
};

"use client";

import { useCallback, useEffect, useState } from "react";
import type { CronJobItem } from "@/types/ops";

const REFRESH_INTERVAL_MS = 30_000;

export type OpsJobsState = {
  jobs: CronJobItem[];
  isLoading: boolean;
  error: string | null;
};

export const useOpsJobs = (): OpsJobsState => {
  const [jobs, setJobs] = useState<CronJobItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs/cron");
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setJobs([]);
        setError(payload.error ?? `Error ${res.status}`);
      } else {
        const payload = (await res.json()) as CronJobItem[];
        setJobs(Array.isArray(payload) ? payload : []);
        setError(null);
      }
    } catch {
      setError("No se pudo cargar jobs");
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchJobs();
    const id = setInterval(() => void fetchJobs(), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchJobs]);

  return { jobs, isLoading, error };
};

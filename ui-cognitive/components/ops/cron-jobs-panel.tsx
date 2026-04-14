"use client";

import { useCallback, useEffect, useState } from "react";
import type { CronJobItem } from "@/types/ops";

type Props = {
  className?: string;
};

const formatNextRun = (iso: string | null): string => {
  if (!iso) return "pausado";
  const d = new Date(iso);
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
};

export function CronJobsPanel({ className }: Props) {
  const [jobs, setJobs] = useState<CronJobItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs/cron");
      if (res.ok) {
        const data = (await res.json()) as CronJobItem[];
        setJobs(Array.isArray(data) ? data : []);
      }
    } catch {
      // silently keep empty
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchJobs();
    const id = setInterval(() => void fetchJobs(), 60_000);
    return () => clearInterval(id);
  }, [fetchJobs]);

  return (
    <div className={className ?? "space-y-2"}>
      <h2 id="ops-jobs-heading" className="text-sm font-semibold">
        Tareas programadas
      </h2>
      {isLoading ? (
        <div className="text-sm text-muted">
          Cargando...
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-sm text-muted">
          Sin tareas programadas
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="flex flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-sm"
            >
              <span className="font-medium">{job.description}</span>
              <span className="font-mono text-xs text-muted">
                {job.cron_expr}
              </span>
              <span className="text-xs text-muted">
                Próx: {formatNextRun(job.next_run)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

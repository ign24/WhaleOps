"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Trash2 } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

type CronJob = {
  id: string;
  description: string;
  cron_expr: string;
  next_run: string | null;
  status: "active" | "paused";
};

const StatusDot = ({ active }: { active: boolean }) => (
  <span
    className="h-1.5 w-1.5 shrink-0 rounded-full"
    style={{
      background: active ? "var(--success)" : "var(--text-muted)",
      boxShadow: active ? "0 0 4px var(--success)" : "none",
    }}
  />
);

const formatNextRun = (iso: string | null): string => {
  if (!iso) return "pausado";
  const d = new Date(iso);
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
};

type CronJobsProps = {
  isCollapsed: boolean;
};

export const CronJobs = ({ isCollapsed }: CronJobsProps) => {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs/cron", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as CronJob[];
      setJobs(Array.isArray(data) ? data : []);
    } catch {
      // silently ignore — scheduler may not be running
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const deleteJob = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/jobs/cron/${id}`, { method: "DELETE" });
      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  if (isCollapsed) {
    if (isLoading || jobs.length === 0) return null;
    return (
      <Tooltip
        content={`${jobs.length} tarea${jobs.length === 1 ? "" : "s"} programada${jobs.length === 1 ? "" : "s"}`}
        placement="right"
      >
        <div className="flex h-10 w-full items-center justify-center gap-1 text-muted sm:h-8">
          <CalendarClock size={15} />
          <span className="text-[10px] font-medium">{jobs.length}</span>
        </div>
      </Tooltip>
    );
  }

  return (
    <div className="mb-2.5 sm:mb-3">
      <div className="mb-1 flex items-center gap-1.5">
        <CalendarClock size={12} className="text-muted" />
        <p className="text-[11px] uppercase tracking-wide text-muted">Tareas programadas</p>
      </div>

      {isLoading ? (
        <div className="space-y-1 px-1">
          <div className="h-8 animate-pulse rounded bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)]" />
        </div>
      ) : jobs.length === 0 ? (
        <p className="px-2 text-[11px] text-muted">Sin tareas programadas</p>
      ) : (
        <div className="space-y-0.5">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-[12px] hover:bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] sm:py-1.5"
            >
              <StatusDot active={job.status === "active"} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium leading-tight">{job.description || job.id}</p>
                <p className="truncate text-[11px] text-muted">{job.cron_expr}</p>
                <p className="truncate text-[11px] text-muted">{formatNextRun(job.next_run)}</p>
              </div>
              <button
                type="button"
                onClick={() => void deleteJob(job.id)}
                disabled={deletingId === job.id}
                className="shrink-0 rounded p-2 text-muted transition-colors duration-150 hover:text-[var(--error)] disabled:opacity-40 sm:p-1"
                aria-label={`Cancelar ${job.description || job.id}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

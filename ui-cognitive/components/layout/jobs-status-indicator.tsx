"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { cancelJob, CronJob, fetchJobs } from "@/lib/jobs-api";

const POLL_INTERVAL_MS = 30_000;

export const JobsStatusIndicator = () => {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchJobs();
      setJobs(data);
    } catch {
      // leave previous state; show neutral dot
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), POLL_INTERVAL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  const handleCancel = async (id: string) => {
    try {
      await cancelJob(id);
      await load();
    } catch {
      // silently ignore — UX: leave job in list
    }
  };

  const hasJobs = !isLoading && jobs.length > 0;
  const isPulsing = hasJobs;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        data-testid="jobs-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-[var(--surface)]"
        aria-label={`${jobs.length} scheduled jobs`}
      >
        <span
          data-testid="jobs-dot"
          data-pulsing={isPulsing ? "true" : "false"}
          className={`h-2 w-2 rounded-full ${
            isPulsing
              ? "animate-pulse bg-[var(--success)]"
              : "bg-[var(--text-secondary)]"
          }`}
        />
        {hasJobs && (
          <span data-testid="jobs-count" className="font-medium text-[var(--text-secondary)]">
            {jobs.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          data-testid="jobs-panel"
          className={[
            "absolute right-0 top-full z-50 mt-1 w-72 rounded-xl",
            "bg-[var(--surface)] shadow-md ring-1 ring-[var(--border)]",
            "p-3",
          ].join(" ")}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-primary)]">Scheduled Jobs</span>
            <Link
              href="/jobs"
              onClick={() => setIsOpen(false)}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Manage jobs
            </Link>
          </div>

          {jobs.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--text-secondary)]">
              No scheduled jobs
            </p>
          ) : (
            <ul className="space-y-1">
              {jobs.map((job) => (
                <li
                  key={job.id}
                  className="flex items-start justify-between gap-2 rounded-lg p-2 text-xs hover:bg-[var(--bg)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--text-primary)]">{job.description}</p>
                    <p className="text-[var(--text-secondary)]">{job.cron_expr}</p>
                    {job.next_run && (
                      <p className="text-[var(--text-secondary)]">
                        {new Date(job.next_run).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    data-testid={`cancel-job-${job.id}`}
                    onClick={() => void handleCancel(job.id)}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[var(--text-secondary)] hover:bg-[var(--error)] hover:text-white"
                    aria-label={`Cancel job ${job.description}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

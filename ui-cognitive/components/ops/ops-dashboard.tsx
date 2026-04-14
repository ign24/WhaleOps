"use client";

import { useOpsStatus } from "@/hooks/use-ops-status";
import { useOpsJobs } from "@/hooks/use-ops-jobs";
import { useOpsObservability } from "@/hooks/use-ops-observability";
import { useOpsStrategicSignals } from "@/hooks/use-ops-strategic-signals";
import { OpsHeader } from "./ops-header";
import { ContainersTable } from "./containers-table";
import { CronJobsPanel } from "./cron-jobs-panel";
import { NotesPanel } from "./notes-panel";
import { StrategicSignals } from "./strategic-signals";

export function OpsDashboard() {
  const { containers, isLoading, error, refresh } = useOpsStatus();
  const { jobs, error: jobsError } = useOpsJobs();
  const { summary, error: observabilityError } = useOpsObservability();

  const signals = useOpsStrategicSignals({
    containers,
    statusError: error,
    jobs,
    jobsError,
    observability: summary,
    observabilityError,
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
      <OpsHeader containers={containers} isLoading={isLoading} />
      <StrategicSignals signals={signals} />

      <section
        aria-label="Paneles operativos"
        className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        <section
          aria-labelledby="ops-jobs-heading"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <CronJobsPanel />
        </section>

        <section
          aria-labelledby="ops-notes-heading"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <NotesPanel />
        </section>
      </section>

      <section aria-labelledby="ops-containers-heading" className="space-y-3">
        <h2 id="ops-containers-heading" className="text-sm font-semibold">
          Containers
        </h2>
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <ContainersTable
            containers={containers}
            isLoading={isLoading}
            error={error}
            onRetry={() => void refresh(true)}
          />
        </div>
      </section>
    </main>
  );
}

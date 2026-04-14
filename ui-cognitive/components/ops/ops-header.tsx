"use client";

import type { OpsContainer } from "@/types/ops";

type Props = {
  containers: OpsContainer[];
  isLoading: boolean;
};

export function OpsHeader({ containers, isLoading }: Props) {
  const running = containers.filter((c) => c.state === "running").length;
  const total = containers.length;

  return (
    <header className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Ops Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Estado de contenedores, tareas y notas operativas</p>
        </div>
      {!isLoading && (
        <span
          className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1.5 text-sm font-medium"
          style={{ color: running > 0 ? "var(--success, #10b981)" : "var(--text-secondary, #4a5568)" }}
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: running > 0 ? "var(--success, #10b981)" : "var(--text-secondary, #4a5568)" }}
          />
          {running} running / {total} total
        </span>
      )}
      </div>
    </header>
  );
}

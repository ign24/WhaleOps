"use client";

import type { OpsStrategicSignals } from "@/types/ops";

type Props = {
  signals: OpsStrategicSignals;
};

export function StrategicSignals({ signals }: Props) {
  return (
    <section aria-label="Señales estratégicas" className="space-y-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-xs text-muted">Running/Total</p>
          <p className="text-base font-semibold tracking-tight">
            {signals.running}/{signals.total}
          </p>
        </article>
        <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-xs text-muted">Degradados</p>
          <p className="text-base font-semibold tracking-tight">{signals.degraded}</p>
        </article>
        <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-xs text-muted">Jobs activos</p>
          <p className="text-base font-semibold tracking-tight">{signals.activeJobs}</p>
        </article>
        <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-xs text-muted">Latencia promedio</p>
          <p className="text-base font-semibold tracking-tight">
            {signals.avgLatencyMs === null ? "—" : `${Math.round(signals.avgLatencyMs)}ms`}
          </p>
        </article>
        <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-xs text-muted">Errores</p>
          <p className="text-base font-semibold tracking-tight">{signals.errorCount}</p>
        </article>
      </div>

      {signals.alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {signals.alerts.map((alert) => (
            <div
              key={alert.code}
              role="alert"
              className="rounded-xl border px-3 py-2 text-sm"
              style={
                alert.severity === "error"
                  ? {
                      borderColor: "color-mix(in srgb, var(--error) 45%, var(--border) 55%)",
                      background: "color-mix(in srgb, var(--error) 9%, var(--surface) 91%)",
                    }
                  : {
                      borderColor: "color-mix(in srgb, var(--warning) 45%, var(--border) 55%)",
                      background: "color-mix(in srgb, var(--warning) 10%, var(--surface) 90%)",
                    }
              }
            >
              {alert.message}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

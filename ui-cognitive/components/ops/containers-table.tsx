"use client";

import type { OpsContainer } from "@/types/ops";

type Props = {
  containers: OpsContainer[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
};

const STATE_COLORS: Record<string, string> = {
  running: "var(--success, #10b981)",
  restarting: "var(--warning, #f59e0b)",
  exited: "var(--text-secondary, #6b7280)",
  dead: "var(--error, #ef4444)",
  paused: "var(--text-secondary, #6b7280)",
};

function StatusBadge({ state }: { state: string }) {
  const color = STATE_COLORS[state] ?? STATE_COLORS.exited;
  return (
    <span
      data-status={state}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        fontSize: "0.75rem",
        fontWeight: 500,
        color,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      {state}
    </span>
  );
}

function MobileContainerCard({ container }: { container: OpsContainer }) {
  return (
    <li className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs sm:text-sm">{container.name}</p>
          <p className="mt-1 truncate text-xs text-muted">{container.image}</p>
        </div>
        <StatusBadge state={container.state} />
      </div>

      <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        <p className="text-muted">
          <span className="font-medium text-[var(--text-primary)]">Puertos:</span>{" "}
          {container.ports.length > 0 ? container.ports.join(", ") : "—"}
        </p>
        <p className="text-muted">
          <span className="font-medium text-[var(--text-primary)]">Estado:</span> {container.status}
        </p>
      </div>
    </li>
  );
}

export function ContainersTable({ containers, isLoading, error, onRetry }: Props) {
  if (isLoading) {
    return (
      <div data-testid="containers-skeleton" className="p-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="mb-2 h-10 rounded-md border border-[var(--border)] bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] opacity-70"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-3 p-4 text-[var(--error)]">
        <span className="text-sm">{error}</span>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-10 w-fit items-center rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--surface)_82%,var(--text-primary)_18%)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (containers.length === 0) {
    return (
      <div className="p-4 text-sm text-muted">
        Sin containers detectados
      </div>
    );
  }

  return (
    <div className="w-full">
      <ul className="space-y-2 p-3 md:hidden">
        {containers.map((container) => (
          <MobileContainerCard key={container.id} container={container} />
        ))}
      </ul>

      <div className="hidden md:block">
        <table className="w-full border-collapse text-[0.8125rem]">
        <thead>
          <tr className="border-b border-[var(--border)]">
            {["Nombre", "Imagen", "Estado", "Puertos"].map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-left text-xs font-semibold text-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {containers.map((c) => (
            <tr
              key={c.id}
              className="border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)]"
            >
              <td className="max-w-[220px] px-3 py-2 font-mono text-xs lg:max-w-[300px] lg:text-[0.8125rem]">
                {c.name}
              </td>
              <td className="max-w-[250px] truncate px-3 py-2 text-muted lg:max-w-[340px]">
                {c.image}
              </td>
              <td className="px-3 py-2">
                <StatusBadge state={c.state} />
              </td>
              <td className="max-w-[250px] px-3 py-2 font-mono text-xs text-muted">
                {c.ports.length > 0 ? c.ports.join(", ") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
}

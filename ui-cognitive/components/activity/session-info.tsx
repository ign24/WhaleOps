import { ActivityEntry } from "@/types/chat";
import { deriveSessionMeta, formatDuration } from "@/components/activity/session-meta";
import { getModelDisplayName } from "@/lib/model-registry";
import { ModelVendorBadge } from "@/components/activity/model-vendor-badge";

type SessionInfoProps = {
  entries: ActivityEntry[];
  isLive: boolean;
  selectedModelKey?: string | null;
};

export const SessionInfo = ({ entries, isLive, selectedModelKey = null }: SessionInfoProps) => {
  const meta = deriveSessionMeta(entries, isLive);
  const selectedModelLabel = getModelDisplayName(selectedModelKey);
  const displayedModel = selectedModelLabel ?? getModelDisplayName(meta.model);

  return (
    <header className="border-b border-[var(--border)] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Actividad</h2>
        {meta.isLive ? (
          <span className="flex items-center gap-1.5 text-xs text-[var(--success)]">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--success)] motion-safe:animate-pulse"
              style={{ boxShadow: "0 0 5px var(--success)" }}
            />
            Activo
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-center divide-x divide-[var(--border)] text-xs text-muted">
        <span className="pr-3">Herramientas: {meta.toolCount}</span>
        <span className="px-3">Duración: {formatDuration(meta.totalDuration)}</span>
      </div>
      {displayedModel ? (
        <div className="mt-1 flex items-center gap-2">
          <p className="truncate text-xs text-muted">Modelo: {displayedModel}</p>
          <ModelVendorBadge model={selectedModelKey ?? meta.model} />
        </div>
      ) : null}
    </header>
  );
};

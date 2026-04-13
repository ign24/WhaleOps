import { ActivityEntry } from "@/types/chat";
import { formatDuration, getEntryDuration } from "@/components/activity/session-meta";

type SessionSummaryProps = {
  entries: ActivityEntry[];
};

export const SessionSummary = ({ entries }: SessionSummaryProps) => {
  const totalDuration = entries.reduce((sum, entry) => sum + getEntryDuration(entry), 0);

  return (
    <footer className="border-t border-[var(--border)] px-4 py-3 text-xs text-muted">
      <div className="flex items-center divide-x divide-[var(--border)] text-[11px]">
        <span className="pr-3">Total: {entries.length}</span>
        <span className="pl-3">Duracion: {formatDuration(totalDuration)}</span>
      </div>
    </footer>
  );
};

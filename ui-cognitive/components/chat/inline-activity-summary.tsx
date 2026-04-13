"use client";

import { ActivityEntry } from "@/types/chat";
import { formatDuration, getEntryDuration } from "@/components/activity/session-meta";
import { ACTIVITY_UI_COPY } from "@/components/activity/activity-copy";

type InlineActivitySummaryProps = {
  entries: ActivityEntry[];
  onOpen: () => void;
  activeTool?: string | null;
  isLive?: boolean;
};

export const InlineActivitySummary = ({ entries, onOpen, activeTool, isLive }: InlineActivitySummaryProps) => {
  if (entries.length === 0) {
    return null;
  }

  const toolEntries = entries.filter((entry) => entry.kind === "tool");
  const activeAgentLabels = entries
    .filter((entry) => entry.kind === "agent" && (entry.status === "running" || entry.status === "pending"))
    .map((entry) => entry.label.trim())
    .filter((label) => label.length > 0);
  const uniqueActiveAgentLabels = Array.from(new Set(activeAgentLabels));
  const totalDuration = entries.reduce((sum, entry) => sum + getEntryDuration(entry), 0);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="chat-rich-block mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-[var(--text)]"
      data-chat-block="activity"
      data-chat-motion-profile="activity"
      aria-label={ACTIVITY_UI_COPY.openPanelAriaLabel}
    >
      <span>
        {isLive && uniqueActiveAgentLabels.length > 0 ? (
          <span className="mr-1 inline-flex items-center gap-1 text-[var(--warning)]">
            {uniqueActiveAgentLabels.map((label) => (
              <span key={label} className="inline-flex items-center gap-1" data-active-agent="true">
                <span className="inline-activity-indicator" aria-hidden="true" />
                {label}
              </span>
            ))}
            <span>·</span>
          </span>
        ) : isLive && activeTool ? (
          <span className="text-[var(--warning)]">{activeTool} · </span>
        ) : null}
        {toolEntries.length} {ACTIVITY_UI_COPY.toolsLabelPlural} · {formatDuration(totalDuration)}
      </span>
      <span aria-hidden="true">→</span>
    </button>
  );
};

"use client";

import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { SessionInfo } from "@/components/activity/session-info";
import { SessionSummary } from "@/components/activity/session-summary";
import { SessionWorkspace } from "@/components/activity/session-workspace";
import { ActivityEntry } from "@/types/chat";

export type ActivityPanelProps = {
  entries: ActivityEntry[];
  workspaceEntries?: ActivityEntry[];
  activeTool: string | null;
  isLive: boolean;
  selectedModelKey?: string | null;
  onClose: () => void;
  onBackToLive?: () => void;
  canGoBackToLive?: boolean;
};

export const ActivityPanel = ({
  entries,
  workspaceEntries,
  activeTool,
  isLive,
  selectedModelKey,
  onClose,
  onBackToLive,
  canGoBackToLive = false,
}: ActivityPanelProps) => {
  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-transparent px-3 py-1.5 sm:px-4 sm:py-2">
        <p className="text-xs font-medium sm:text-sm">Panel de actividad</p>
        <div className="flex items-center gap-2">
          {canGoBackToLive && onBackToLive ? (
            <button
              type="button"
              onClick={onBackToLive}
              className="cursor-pointer rounded-md border border-[var(--border)] px-2 py-0.5 text-[11px] transition-colors duration-200 hover:border-[var(--text-secondary)] hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] sm:py-1 sm:text-xs"
            >
              Volver a vivo
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md border border-[var(--border)] px-2 py-0.5 text-[11px] transition-colors duration-200 hover:border-[var(--text-secondary)] hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] sm:py-1 sm:text-xs"
          >
            Cerrar
          </button>
        </div>
      </div>

      <SessionInfo entries={entries} isLive={isLive} selectedModelKey={selectedModelKey} />
      <div className="min-h-0 flex-1">
        <ActivityTimeline entries={entries} activeTool={activeTool} isLive={isLive} />
      </div>
      <SessionWorkspace entries={workspaceEntries ?? entries} />
      <SessionSummary entries={entries} />
    </aside>
  );
};

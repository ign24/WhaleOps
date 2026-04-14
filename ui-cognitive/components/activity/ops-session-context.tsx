"use client";

import { useMemo, useState } from "react";
import { BookOpen, CalendarClock, ChevronDown, ChevronRight, Container, FileText, ScrollText } from "lucide-react";

import type { ActivityEntry, OpsSnapshot } from "@/types/chat";

// ---------------------------------------------------------------------------
// Pure snapshot derivation
// ---------------------------------------------------------------------------

export function deriveOpsSnapshot(entries: ActivityEntry[]): OpsSnapshot {
  const containerSet = new Set<string>();
  const logsFetched: OpsSnapshot["logsFetched"] = [];
  const notesSaved: OpsSnapshot["notesSaved"] = [];
  const schedulesCreated: OpsSnapshot["schedulesCreated"] = [];

  for (const entry of entries) {
    if (entry.kind !== "tool") continue;
    const args = entry.toolArgs ?? {};
    const tool = entry.toolNameNormalized ?? "";

    // Collect container references from any tool that carries container_name/id
    const containerRef =
      (typeof args.container_name === "string" ? args.container_name : null) ??
      (typeof args.container_id === "string" ? args.container_id : null);

    if (containerRef) {
      containerSet.add(containerRef);
    }

    // Per-tool extraction
    if (tool === "get_container_logs" && containerRef) {
      logsFetched.push({
        container: containerRef,
        lines: typeof args.lines === "number" ? args.lines : 100,
      });
    }

    if (tool === "save_note") {
      notesSaved.push({
        type: typeof args.note_type === "string" ? args.note_type : "note",
        container: containerRef ?? undefined,
      });
    }

    if (tool === "schedule_task" && args.action === "create") {
      schedulesCreated.push({
        name: typeof args.name === "string" ? args.name : "task",
        cron: typeof args.cron === "string" ? args.cron : "",
      });
    }
  }

  const containersReferenced = Array.from(containerSet);

  const isEmpty =
    containersReferenced.length === 0 &&
    logsFetched.length === 0 &&
    notesSaved.length === 0 &&
    schedulesCreated.length === 0;

  return { containersReferenced, logsFetched, notesSaved, schedulesCreated, isEmpty };
}

// ---------------------------------------------------------------------------
// Sub-sections
// ---------------------------------------------------------------------------

const SectionHeader = ({ icon: Icon, label, count }: { icon: React.ElementType; label: string; count: number }) => (
  <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
    <Icon size={10} />
    {label}
    <span className="ml-1.5 rounded-full bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-1.5 py-0.5 text-[10px]">
      {count}
    </span>
  </p>
);

const ContainersSection = ({ containers }: { containers: string[] }) => {
  if (containers.length === 0) return null;
  return (
    <div>
      <SectionHeader icon={Container} label="Containers consultados" count={containers.length} />
      <div className="space-y-0.5">
        {containers.map((c) => (
          <p key={c} className="truncate font-mono text-[10px] text-muted">
            {c}
          </p>
        ))}
      </div>
    </div>
  );
};

const LogsSection = ({ logs }: { logs: OpsSnapshot["logsFetched"] }) => {
  if (logs.length === 0) return null;
  return (
    <div>
      <SectionHeader icon={ScrollText} label="Logs obtenidos" count={logs.length} />
      <div className="space-y-0.5">
        {logs.map((l, i) => (
          <p key={i} className="truncate font-mono text-[10px] text-muted">
            {l.container}
            <span className="ml-1.5 text-[9px] opacity-60">{l.lines} líneas</span>
          </p>
        ))}
      </div>
    </div>
  );
};

const NotesSection = ({ notes }: { notes: OpsSnapshot["notesSaved"] }) => {
  if (notes.length === 0) return null;
  return (
    <div>
      <SectionHeader icon={FileText} label="Notas guardadas" count={notes.length} />
      <div className="space-y-0.5">
        {notes.map((n, i) => (
          <p key={i} className="truncate font-mono text-[10px] text-muted">
            <span className="mr-1 rounded bg-[var(--border)]/60 px-1 py-0.5 text-[9px]">{n.type}</span>
            {n.container ?? "—"}
          </p>
        ))}
      </div>
    </div>
  );
};

const SchedulesSection = ({ schedules }: { schedules: OpsSnapshot["schedulesCreated"] }) => {
  if (schedules.length === 0) return null;
  return (
    <div>
      <SectionHeader icon={CalendarClock} label="Tareas programadas" count={schedules.length} />
      <div className="space-y-0.5">
        {schedules.map((s, i) => (
          <p key={i} className="truncate font-mono text-[10px] text-muted">
            {s.name}
            <span className="ml-1.5 text-[9px] opacity-60">{s.cron}</span>
          </p>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type OpsSessionContextProps = {
  entries: ActivityEntry[];
};

export const OpsSessionContext = ({ entries }: OpsSessionContextProps) => {
  const snapshot = useMemo(() => deriveOpsSnapshot(entries), [entries]);

  const total =
    snapshot.containersReferenced.length +
    snapshot.logsFetched.length +
    snapshot.notesSaved.length +
    snapshot.schedulesCreated.length;

  const [isExpanded, setIsExpanded] = useState<boolean | null>(null);
  const expanded = isExpanded ?? total <= 10;

  if (snapshot.isEmpty) return null;

  return (
    <div className="border-t border-[var(--border)]">
      <button
        type="button"
        onClick={() => setIsExpanded(!expanded)}
        className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left text-xs text-muted transition-colors duration-150 hover:bg-[var(--surface)]"
      >
        <span className="flex items-center gap-1 font-medium">
          <BookOpen size={12} />
          Contexto de operaciones
        </span>
        <div className="flex items-center gap-1 text-[10px]">
          <span>
            {total} {total === 1 ? "elemento" : "elementos"}
          </span>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </div>
      </button>

      {expanded ? (
        <div className="space-y-3 px-3 pb-3 pt-1 text-xs">
          <ContainersSection containers={snapshot.containersReferenced} />
          <LogsSection logs={snapshot.logsFetched} />
          <NotesSection notes={snapshot.notesSaved} />
          <SchedulesSection schedules={snapshot.schedulesCreated} />
        </div>
      ) : null}
    </div>
  );
};

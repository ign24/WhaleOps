"use client";

import { useOpsNotes } from "@/hooks/use-ops-notes";
import type { OpsNote } from "@/types/ops";

type Props = {
  className?: string;
};

const NOTE_TYPE_LABELS: Record<OpsNote["note_type"], string> = {
  anomaly: "Anomalía",
  pattern: "Patrón",
  instruction: "Instrucción",
  daily_summary: "Resumen",
};

function NoteChip({ type }: { type: OpsNote["note_type"] }) {
  const isAnomaly = type === "anomaly";
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold"
      style={
        isAnomaly
          ? {
              borderColor: "var(--error)",
              color: "var(--error)",
              background: "color-mix(in srgb, var(--error) 10%, transparent)",
            }
          : {
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
              background: "transparent",
            }
      }
    >
      {NOTE_TYPE_LABELS[type] ?? type}
    </span>
  );
}

export function NotesPanel({ className }: Props) {
  const { notes, isLoading } = useOpsNotes({ limit: 10 });

  return (
    <div className={className ?? "space-y-2"}>
      <h2 id="ops-notes-heading" className="text-sm font-semibold">
        Notas recientes
      </h2>
      {isLoading ? (
        <div className="text-sm text-muted">
          Cargando...
        </div>
      ) : notes.length === 0 ? (
        <div className="text-sm text-muted">
          Sin notas registradas
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex flex-col gap-1 rounded-lg border p-2.5 text-sm"
              style={
                note.note_type === "anomaly"
                  ? {
                      borderColor: "color-mix(in srgb, var(--error) 45%, var(--border) 55%)",
                      background: "color-mix(in srgb, var(--error) 8%, var(--surface) 92%)",
                    }
                  : {
                      borderColor: "var(--border)",
                      background: "var(--surface)",
                    }
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <NoteChip type={note.note_type} />
                {note.container_name && (
                  <span className="font-mono text-xs text-muted">
                    {note.container_name}
                  </span>
                )}
              </div>
              <p
                className="m-0 overflow-hidden text-sm text-[var(--text-primary)]"
                style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
              >
                {note.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

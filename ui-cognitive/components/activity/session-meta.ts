import { ActivityEntry, SessionMeta } from "@/types/chat";
import {
  ACTIVITY_LABELS,
  ACTIVITY_UI_COPY,
  ARG_KEY_LABELS,
} from "@/components/activity/activity-copy";

export const humanizeArgKey = (key: string): string => {
  const lower = key.toLowerCase();
  if (ARG_KEY_LABELS[lower]) return ARG_KEY_LABELS[lower];
  return key.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
};

export type ToolCategory = "terminal" | "file" | "search" | "agent" | "repo" | "lifecycle" | "default";

export const getToolCategory = (label: string): ToolCategory => {
  const lower = label.toLowerCase();
  // lifecycle: function start/complete/end, system events
  if (/function\s*(start|complete|end)|lifecycle|start:|end:|iniciando|finalizando|system|sistema/.test(lower)) return "lifecycle";
  if (/bash|shell|terminal|execute|run_command|run_shell/.test(lower)) return "terminal";
  if (/read|write|create|delete|move|file|dir|tree|list|patch|apply|readme|docstring/.test(lower)) return "file";
  if (/search|grep|find|web/.test(lower)) return "search";
  if (/schedule|cron|task/.test(lower)) return "default";
  if (/code.?gen|generat.*code|generate_code/.test(lower)) return "default";
  if (/think|plan|orchestr|agent|model|mistral|devstral|llama|claude|gpt/.test(lower)) return "agent";
  if (/clone|repo|git/.test(lower)) return "repo";
  return "default";
};

export const stripLabelPrefixes = (raw: string): string => {
  let s = raw.trim();
  const lower = s.toLowerCase();
  for (const p of ["function complete: ", "function start: ", "function end: ", "tool: "]) {
    if (lower.startsWith(p)) {
      s = s.slice(p.length).trim();
      break;
    }
  }
  // strip tool namespace prefixes: "fs tools ", "fs_tools__", etc.
  s = s.replace(/^(fs[_ ]?tools?[_:\s]+|shell[_ ]?tools?[_:\s]+|clone[_ ]?tools?[_:\s]+)/i, "").trim();
  s = s.replace(/^[a-z0-9_]+?__/i, "").trim();
  return s;
};

const toLabelKey = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export const humanizeActivityLabel = (label: string): string => {
  const stripped = stripLabelPrefixes(label.trim());
  if (!stripped) return ACTIVITY_UI_COPY.defaultActivityLabel;
  const lower = stripped.toLowerCase();
  if (ACTIVITY_LABELS[lower]) return ACTIVITY_LABELS[lower];

  const normalized = toLabelKey(stripped);
  if (ACTIVITY_LABELS[normalized]) return ACTIVITY_LABELS[normalized];

  const readable = stripped.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return readable.charAt(0).toUpperCase() + readable.slice(1);
};

export const getEntryDuration = (entry: ActivityEntry): number => {
  const endedAt = entry.completedAt ?? entry.startedAt;
  return Math.max(0, endedAt - entry.startedAt);
};

export const formatDuration = (durationMs: number): string => {
  if (durationMs <= 0) {
    return "-";
  }

  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
};

export const formatClockTime = (timestamp: number): string => {
  if (!Number.isFinite(timestamp)) {
    return "--:--:--";
  }

  const date = new Date(timestamp);
  return date.toLocaleTimeString("es-AR", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export const deriveSessionMeta = (entries: ActivityEntry[], isLive: boolean): SessionMeta => {
  const toolCount = entries.filter((entry) => entry.kind === "tool").length;
  const totalDuration = entries.reduce((sum, entry) => sum + getEntryDuration(entry), 0);
  const activeToolCount = entries.filter(
    (entry) => entry.kind === "tool" && (entry.status === "running" || entry.status === "pending"),
  ).length;
  const failedCount = entries.filter((entry) => entry.kind === "tool" && entry.status === "failed").length;
  const modelEntry = [...entries].reverse().find((entry) => typeof entry.model === "string" && entry.model.trim().length > 0);

  return {
    toolCount,
    totalDuration,
    activeToolCount,
    failedCount,
    model: modelEntry?.model ?? null,
    isLive,
  };
};

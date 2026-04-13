"use client";

import { memo, useState } from "react";
import { Bot, ChevronDown, FileText, GitBranch, Search, Terminal, Wrench, Zap } from "lucide-react";

import { AgentStepCard } from "@/components/activity/agent-step-card";
import { TerminalBlock } from "@/components/activity/terminal-block";
import { ToolCallCard } from "@/components/activity/tool-call-card";
import {
  formatClockTime,
  formatDuration,
  getEntryDuration,
  getToolCategory,
  humanizeActivityLabel,
  ToolCategory,
} from "@/components/activity/session-meta";
import { ActivityEntry } from "@/types/chat";

type TimelineEntryProps = {
  entry: ActivityEntry;
  isActiveTool: boolean;
  isLast?: boolean;
};

const iconStatusColor: Record<ActivityEntry["status"], string> = {
  pending: "text-[var(--warning)]",
  running: "text-[var(--primary)]",
  completed: "text-[var(--success)]",
  failed: "text-[var(--error)]",
};


const categoryIcon: Record<ToolCategory, React.ComponentType<{ className?: string }>> = {
  terminal: Terminal,
  file: FileText,
  search: Search,
  agent: Bot,
  repo: GitBranch,
  lifecycle: Zap,
  default: Wrench,
};

const TimelineEntryComponent = ({ entry, isActiveTool, isLast = false }: TimelineEntryProps) => {
  const [expanded, setExpanded] = useState(false);
  const duration = formatDuration(getEntryDuration(entry));
  const timestamp = formatClockTime(entry.startedAt);

  const category = getToolCategory(entry.label);
  const isTerminal = category === "terminal";
  const Icon = categoryIcon[category];
  const isLifecycle = entry.kind === "lifecycle";
  const rawSubtitle =
    entry.kind === "tool"
      ? (entry.commandSummary ?? entry.sandboxPath ?? null)
      : null;

  const hasExpandableContent =
    !isTerminal &&
    ((entry.kind === "tool" &&
        ((entry.toolArgs && Object.keys(entry.toolArgs).length > 0) ||
          (typeof entry.toolResult === "string" && entry.toolResult.trim().length > 0))) ||
      ((entry.kind === "agent" || entry.kind === "lifecycle") &&
        typeof entry.detail === "string" && entry.detail.trim().length > 0));

  const displaySubtitle = isTerminal ? null : rawSubtitle;
  const fullLabel = humanizeActivityLabel(entry.label);

  const terminalCommand = isTerminal
    ? (() => {
        if (entry.commandSummary) return entry.commandSummary;
        const args = entry.toolArgs;
        if (!args) return null;
        // known command keys first
        for (const key of ["command", "cmd", "script", "shell_command", "bash_command", "run", "exec"]) {
          if (typeof args[key] === "string" && (args[key] as string).trim().length > 0) {
            return (args[key] as string).trim();
          }
        }
        // fallback: first short string value that looks like a command (< 300 chars, no newlines)
        for (const val of Object.values(args)) {
          if (typeof val === "string" && val.trim().length > 0 && val.length < 300 && !val.includes("\n")) {
            return val.trim();
          }
        }
        return null;
      })()
    : null;

  return (
    <li className={`rounded-md border border-[var(--border)] transition-colors duration-150 ${isLifecycle ? "px-2 py-1 opacity-50" : "p-2"} ${hasExpandableContent ? "hover:bg-[var(--surface)]" : ""}`}>
      <button
        type="button"
        className={`flex w-full items-start justify-between gap-2 text-left ${hasExpandableContent ? "cursor-pointer" : "cursor-default"}`}
        onClick={() => setExpanded((previous) => !previous)}
        aria-expanded={expanded}
        disabled={!hasExpandableContent}
      >
        <div className="flex min-w-0 items-start gap-2">
          <div className="relative flex w-3.5 shrink-0 justify-center">
            <Icon
              className={`h-3.5 w-3.5 ${iconStatusColor[entry.status]} ${isActiveTool ? "motion-safe:animate-pulse" : ""}`}
              aria-hidden="true"
            />
            {!isLast ? (
              <div className="activity-connector absolute left-1/2 top-4 bottom-0 w-px -translate-x-1/2 bg-[var(--border)]" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm ${isLifecycle ? "text-muted" : ""}`} title={fullLabel}>
              {fullLabel}
            </p>
            {displaySubtitle ? (
              <p className="mt-0.5 truncate font-mono text-[10px] text-muted" title={rawSubtitle ?? undefined}>{displaySubtitle}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-1.5">
          <div className="text-right text-xs text-muted">
            <p>{timestamp}</p>
            <p>{duration}</p>
          </div>
          {hasExpandableContent ? (
            <ChevronDown
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          ) : (
            <span className="w-3.5" />
          )}
        </div>
      </button>
      {entry.kind === "tool" && isTerminal ? (
        <TerminalBlock
          command={terminalCommand}
          output={entry.toolResult ?? null}
          returnCodeSummary={entry.returnCodeSummary}
        />
      ) : expanded && hasExpandableContent ? (
        entry.kind === "tool" ? (
          <ToolCallCard
            toolArgs={entry.toolArgs}
            toolResult={entry.toolResult}
            sandboxPath={entry.sandboxPath}
            commandSummary={entry.commandSummary}
            returnCodeSummary={entry.returnCodeSummary}
          />
        ) : (
          <AgentStepCard detail={entry.detail} />
        )
      ) : null}
    </li>
  );
};

export const TimelineEntry = memo(TimelineEntryComponent);

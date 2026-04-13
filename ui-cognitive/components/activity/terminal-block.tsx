"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy, Terminal } from "lucide-react";

import { rcIsSuccess, tryParseJson } from "@/components/activity/tool-call-card";

type TerminalBlockProps = {
  command: string | null;
  output: string | null;
  returnCodeSummary?: string;
};

const extractOutput = (raw: string | null): string | null => {
  if (!raw || raw.trim().length === 0) return null;
  const parsed = tryParseJson(raw);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;
    if (typeof record.content === "string" && record.content.trim().length > 0) {
      return record.content;
    }
  }
  return raw;
};

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copiar comando"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
    >
      {copied ? (
        <Check className="h-3 w-3 text-[var(--success)]" />
      ) : (
        <Copy className="h-3 w-3 text-white/40 hover:text-white/70" />
      )}
    </button>
  );
};

export const TerminalBlock = ({
  command,
  output,
  returnCodeSummary,
}: TerminalBlockProps) => {
  const [expanded, setExpanded] = useState(false);
  const cleanOutput = extractOutput(output);
  const hasOutput = cleanOutput !== null;

  if (!command && !hasOutput && !returnCodeSummary) return null;

  const isSuccess = returnCodeSummary ? rcIsSuccess(returnCodeSummary) : null;

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-white/8 bg-[#0d0d0d] text-white shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
      {/* window chrome */}
      <div className="flex h-7 items-center gap-2 border-b border-white/8 bg-[#161616] px-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex flex-1 items-center justify-center gap-1.5 text-[10px] text-white/30">
          <Terminal className="h-3 w-3" />
          <span>terminal</span>
        </div>
        {/* right spacer to balance the dots */}
        <div className="w-[52px]" />
      </div>

      {/* command row — div to avoid nested <button> with CopyButton */}
      <div className="flex w-full items-center gap-2 px-3 py-2">
        {/* clickable expand area */}
        <div
          role={hasOutput ? "button" : undefined}
          tabIndex={hasOutput ? 0 : undefined}
          onClick={hasOutput ? () => setExpanded((p) => !p) : undefined}
          onKeyDown={hasOutput ? (e) => { if (e.key === "Enter" || e.key === " ") setExpanded((p) => !p); } : undefined}
          className={`flex min-w-0 flex-1 items-center gap-2 ${hasOutput ? "cursor-pointer" : "cursor-default"}`}
        >
          <span className="shrink-0 select-none font-mono text-[11px] text-[#6eff6e]">$</span>
          <span data-testid="terminal-command" className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/90">
            {command ?? <span className="italic text-white/30">sin comando</span>}
          </span>
          {returnCodeSummary ? (
            <span
              className={`shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-[10px] font-medium ${
                isSuccess
                  ? "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]"
                  : "border-[var(--error)]/30 bg-[var(--error)]/10 text-[var(--error)]"
              }`}
            >
              {returnCodeSummary}
            </span>
          ) : null}
          {hasOutput ? (
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-white/30 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          ) : null}
        </div>
        {command ? <CopyButton text={command} /> : null}
      </div>

      {/* output area */}
      {expanded && hasOutput ? (
        <div className="border-t border-white/8 bg-[#0a0a0a]">
          <pre className="chat-scrollbar max-h-52 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-white/60 whitespace-pre-wrap break-all">
            {cleanOutput}
          </pre>
        </div>
      ) : null}
    </div>
  );
};

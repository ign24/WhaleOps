"use client";

import { useState } from "react";

import { MessageMarkdown } from "@/components/chat/message-markdown";
import { humanizeActivityLabel, humanizeArgKey } from "@/components/activity/session-meta";

type ToolCallCardProps = {
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  sandboxPath?: string;
  commandSummary?: string;
  returnCodeSummary?: string;
};

// --- spawn agent input shape ---

type SpawnAgentInput = {
  task: string;
  tools?: string[];
  max_iterations?: number;
};

export const isSpawnAgentShape = (value: unknown): value is SpawnAgentInput => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return typeof (value as Record<string, unknown>).task === "string";
};

export const tryParsePythonDict = (raw: string): unknown | null => {
  // Try standard JSON first
  try {
    return JSON.parse(raw);
  } catch {
    // fall through
  }
  // Convert Python dict literals to JSON (single → double quotes, Python constants)
  try {
    const converted = raw
      .replace(/'/g, '"')
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false")
      .replace(/\bNone\b/g, "null");
    return JSON.parse(converted);
  } catch {
    return null;
  }
};

const SpawnAgentCard = ({ value }: { value: SpawnAgentInput }) => (
  <div className="space-y-2">
    <p className="text-xs leading-relaxed">{value.task}</p>
    {Array.isArray(value.tools) && value.tools.length > 0 ? (
      <div className="flex flex-wrap gap-1">
        {value.tools.map((tool) => (
          <span
            key={tool}
            title={tool}
            className="rounded bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[10px] text-muted"
          >
            {humanizeActivityLabel(tool)}
          </span>
        ))}
      </div>
    ) : null}
    {typeof value.max_iterations === "number" ? (
      <span className="inline-block rounded bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[10px] text-muted">
        máx. {value.max_iterations} iter.
      </span>
    ) : null}
  </div>
);

// --- value classifiers ---

const isPythonRepr = (value: string): boolean =>
  /^\[?\s*(HumanMessage|AIMessage|SystemMessage|ToolMessage|BaseMessage)\s*\(/.test(value.trimStart());

const countPythonMessages = (value: string): number =>
  (value.match(/Message\(/g) ?? []).length;

const isJsonString = (value: string): boolean => {
  const trimmed = value.trim();
  return (trimmed.startsWith("{") || trimmed.startsWith("[")) && trimmed.length > 2;
};

export const tryParseJson = (value: string): unknown | null => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const hasNewlines = (value: string): boolean => value.includes("\n");

const isFileContent = (value: string): boolean =>
  /^\/[^\n]+\.(py|ts|js|tsx|jsx|json|yaml|yml|toml|md|txt|sh|css|html|sql):\n/.test(value);

const detectLang = (value: string): string => {
  if (/^[{[]/.test(value.trim())) return "json";
  if (/def |import |class |#/.test(value.slice(0, 200))) return "python";
  if (/function |const |import |export |=>/.test(value.slice(0, 200))) return "typescript";
  if (/^#/.test(value.trim())) return "markdown";
  return "";
};

export const rcIsSuccess = (rc: string): boolean => /rc=0\b/.test(rc);

// --- arg value renderer ---

const ArgValue = ({ value }: { value: unknown }) => {
  if (typeof value !== "string") {
    if (isSpawnAgentShape(value)) {
      return <SpawnAgentCard value={value} />;
    }
    const formatted = JSON.stringify(value, null, 2);
    return (
      <div className="chat-scrollbar max-h-32 overflow-y-auto rounded border border-[var(--border)]">
        <MessageMarkdown content={"```json\n" + formatted + "\n```"} />
      </div>
    );
  }

  // Python LangChain message repr → summarize instead of dump
  if (isPythonRepr(value)) {
    const count = countPythonMessages(value);
    return (
      <span className="rounded bg-[var(--surface)] px-2 py-0.5 text-[11px] text-muted">
        {count > 0 ? `${count} mensajes (historial interno)` : "historial de mensajes"}
      </span>
    );
  }

  // Short value → inline
  if (value.length <= 120 && !hasNewlines(value)) {
    return <span className="break-all font-mono">{value}</span>;
  }

  // JSON string or Python dict string → try to parse and format
  if (isJsonString(value) || value.trim().startsWith("{'")) {
    const parsed = tryParsePythonDict(value);
    if (parsed !== null) {
      if (isSpawnAgentShape(parsed)) {
        return <SpawnAgentCard value={parsed} />;
      }
      return (
        <div className="chat-scrollbar max-h-40 overflow-y-auto rounded border border-[var(--border)]">
          <MessageMarkdown content={"```json\n" + JSON.stringify(parsed, null, 2) + "\n```"} />
        </div>
      );
    }
  }

  // Multi-line text (query, input_message, generated_code, etc.)
  const lang = detectLang(value);
  return (
    <div className="chat-scrollbar max-h-40 overflow-y-auto rounded border border-[var(--border)]">
      <MessageMarkdown content={lang ? "```" + lang + "\n" + value + "\n```" : value} />
    </div>
  );
};

// --- result renderer ---

const isPythonNone = (result: string): boolean =>
  /^(\*\*Resultado:\*\*\s*)?```[\w]*\s*[\r\n]?None[\r\n]?```\s*$/.test(result.trim());

const ToolResult = ({ result }: { result: string }) => {
  if (isPythonNone(result)) {
    return (
      <span className="inline-block rounded bg-[var(--surface)] px-2 py-0.5 font-mono text-[11px] text-muted">
        None
      </span>
    );
  }
  // Try JSON → look for {content, status} structure
  if (isJsonString(result)) {
    const parsed = tryParseJson(result);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      const content = typeof record.content === "string" ? record.content : null;
      const status = typeof record.status === "string" ? record.status : null;

      if (content) {
        return (
          <div className="space-y-1">
            {status ? (
              <span
                className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium uppercase ${
                  status === "ok" || status === "success"
                    ? "bg-[var(--success)]/15 text-[var(--success)]"
                    : status === "error"
                      ? "bg-[var(--error)]/15 text-[var(--error)]"
                      : "bg-[var(--surface)] text-muted"
                }`}
              >
                {status}
              </span>
            ) : null}
            <div className="chat-scrollbar max-h-52 overflow-y-auto rounded border border-[var(--border)]">
              <MessageMarkdown content={content} />
            </div>
          </div>
        );
      }

      return (
        <div className="chat-scrollbar max-h-52 overflow-y-auto rounded border border-[var(--border)]">
          <MessageMarkdown content={"```json\n" + JSON.stringify(record, null, 2) + "\n```"} />
        </div>
      );
    }
  }

  // File content pattern
  if (isFileContent(result)) {
    return (
      <div className="chat-scrollbar max-h-52 overflow-y-auto rounded border border-[var(--border)]">
        <MessageMarkdown content={"```\n" + result + "\n```"} />
      </div>
    );
  }

  // Default: markdown render
  return (
    <div className="chat-scrollbar max-h-52 overflow-y-auto rounded border border-[var(--border)]">
      <MessageMarkdown content={result} />
    </div>
  );
};

// --- input section ---

const InputSection = ({ toolArgs }: { toolArgs: Record<string, unknown> }) => (
  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
    {Object.entries(toolArgs).map(([k, v]) => (
      <div key={k} className="contents">
        <dt className="mt-0.5 shrink-0 self-start font-mono text-[10px] text-muted">
          {humanizeArgKey(k)}
        </dt>
        <dd className="min-w-0">
          <ArgValue value={v} />
        </dd>
      </div>
    ))}
  </dl>
);

// --- context chips ---

const ContextChips = ({
  commandSummary,
  sandboxPath,
  returnCodeSummary,
}: {
  commandSummary?: string;
  sandboxPath?: string;
  returnCodeSummary?: string;
}) => (
  <div className="flex flex-wrap gap-1.5 border-b border-[var(--border)] pb-2">
    {commandSummary ? (
      <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 font-mono text-[10px] font-medium text-muted">
        cmd: {commandSummary}
      </span>
    ) : null}
    {sandboxPath ? (
      <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 font-mono text-[10px] font-medium text-muted">
        {sandboxPath}
      </span>
    ) : null}
    {returnCodeSummary ? (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium ${
          rcIsSuccess(returnCodeSummary)
            ? "border-[var(--success)]/30 bg-[var(--success)]/8 text-[var(--success)]"
            : "border-[var(--error)]/30 bg-[var(--error)]/8 text-[var(--error)]"
        }`}
      >
        {returnCodeSummary}
      </span>
    ) : null}
  </div>
);

// --- filter null/undefined args ---

const filterNullArgs = (toolArgs: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(toolArgs).filter(
      ([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0),
    ),
  );

// --- sanitize tool result ---

const sanitizeResult = (result: string): string => {
  return result
    .trim()
    .replace(/\*\*Function Output:\*\*/gi, "**Resultado:**")
    .replace(/\*\*Function Start:\*\*/gi, "**Inicio:**")
    .replace(/\*\*Function Complete:\*\*/gi, "**Completo:**");
};

// --- smart tab label ---

const getInputLabel = (toolArgs: Record<string, unknown>): string => {
  const keys = Object.keys(toolArgs).map((k) => k.toLowerCase());
  if (keys.some((k) => k === "messages" || k === "input_messages" || k === "chat_history")) return "Prompt";
  if (keys.some((k) => k === "input_message")) return "Tarea";
  if (keys.length === 1) {
    if (keys[0] === "command" || keys[0] === "cmd" || keys[0] === "shell_command") return "Comando";
    if (keys[0] === "query") return "Consulta";
    if (keys[0] === "path" || keys[0] === "file_path") return "Ruta";
  }
  return keys.length === 1 ? "Parámetro" : "Parámetros";
};

// --- main component ---

type Tab = "input" | "result";

export const ToolCallCard = ({
  toolArgs,
  toolResult,
  sandboxPath,
  commandSummary,
  returnCodeSummary,
}: ToolCallCardProps) => {
  const cleanArgs = toolArgs ? filterNullArgs(toolArgs) : {};
  const hasToolArgs = Object.keys(cleanArgs).length > 0;
  const cleanResult = typeof toolResult === "string" && toolResult.trim().length > 0 ? sanitizeResult(toolResult) : null;
  const hasToolResult = cleanResult !== null;
  const hasContext =
    (typeof sandboxPath === "string" && sandboxPath.trim().length > 0) ||
    (typeof commandSummary === "string" && commandSummary.trim().length > 0) ||
    (typeof returnCodeSummary === "string" && returnCodeSummary.trim().length > 0);

  const useTabs = hasToolArgs && hasToolResult;
  const [activeTab, setActiveTab] = useState<Tab>("input");
  const inputLabel = hasToolArgs ? getInputLabel(cleanArgs) : "Parámetros";

  if (!hasToolArgs && !hasToolResult && !hasContext) {
    return null;
  }

  return (
    <div className="mt-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-xs">
      {hasContext ? (
        <ContextChips
          commandSummary={commandSummary}
          sandboxPath={sandboxPath}
          returnCodeSummary={returnCodeSummary}
        />
      ) : null}

      {useTabs ? (
        <div className="mt-2">
          <div className="mb-2 flex gap-1 border-b border-[var(--border)]">
            <button
              type="button"
              onClick={() => setActiveTab("input")}
              className={`cursor-pointer px-2 pb-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] ${
                activeTab === "input"
                  ? "border-b-2 border-[var(--primary)] text-[var(--primary)]"
                  : "text-muted hover:text-[var(--foreground)]"
              }`}
            >
              {inputLabel}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("result")}
              className={`cursor-pointer px-2 pb-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] ${
                activeTab === "result"
                  ? "border-b-2 border-[var(--primary)] text-[var(--primary)]"
                  : "text-muted hover:text-[var(--foreground)]"
              }`}
            >
              Resultado
            </button>
          </div>
          {activeTab === "input" ? (
            <InputSection toolArgs={cleanArgs} />
          ) : (
            <ToolResult result={cleanResult!} />
          )}
        </div>
      ) : (
        <div className={`space-y-2 ${hasContext ? "mt-2" : ""}`}>
          {hasToolArgs ? (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{inputLabel}</p>
              <InputSection toolArgs={cleanArgs} />
            </div>
          ) : null}
          {hasToolResult ? (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Resultado</p>
              <ToolResult result={cleanResult!} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

import { MessageMarkdown } from "@/components/chat/message-markdown";

type AgentStepCardProps = {
  detail?: string;
};

const PYTHON_REPR_RE = /^\[?\s*(HumanMessage|AIMessage|SystemMessage|ToolMessage|BaseMessage)\s*\(/m;

const countMessages = (text: string): number => (text.match(/Message\s*\(/g) ?? []).length;

const sanitizeDetail = (detail: string): string => {
  let s = detail
    .replace(/^Input:\s*/m, "**Prompt:**\n")
    .replace(/^Output:\s*/m, "**Respuesta:**\n");

  // Summarize Python message reprs inside code fences
  s = s.replace(/```[\w]*\n([\s\S]*?)```/g, (block, content: string) => {
    if (PYTHON_REPR_RE.test(content)) {
      const count = countMessages(content);
      const label = count > 0 ? `${count} mensaje${count !== 1 ? "s" : ""} (historial interno)` : "historial de mensajes";
      return `\`${label}\``;
    }
    return block;
  });

  // Strip Prompt section when it only contains a message-history pill — not useful to show
  s = s.replace(/\*\*Prompt:\*\*\n`[^`]*(historial\s+(?:interno|de mensajes))[^`]*`\n?/g, "").trim();

  return s;
};

export const AgentStepCard = ({ detail }: AgentStepCardProps) => {
  const hasDetail = typeof detail === "string" && detail.trim().length > 0;
  if (!hasDetail) return null;

  const sanitized = sanitizeDetail(detail!);
  if (!sanitized) return null;

  return (
    <div className="mt-2 rounded-md border-l-2 border-[var(--primary)] bg-[var(--surface)] pl-3 pr-2 py-2 text-xs">
      <MessageMarkdown content={sanitized} />
    </div>
  );
};

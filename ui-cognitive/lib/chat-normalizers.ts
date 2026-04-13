import { UiChatMessage } from "@/types/chat";
import { ensureUiMessageShape } from "@/lib/message-utils";

export const normalizeContentText = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    const text = value
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (!part || typeof part !== "object") {
          return "";
        }

        const source = part as Record<string, unknown>;
        return normalizeContentText(source.text) ?? normalizeContentText(source.content) ?? "";
      })
      .join("");

    return text.trim().length > 0 ? text : null;
  }

  const source = value as Record<string, unknown>;
  return normalizeContentText(source.text) ?? normalizeContentText(source.content) ?? null;
};

export const parseHistory = (payload: unknown): UiChatMessage[] => {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const source = payload as {
    result?: { messages?: Array<Record<string, unknown>>; history?: Array<Record<string, unknown>> };
    messages?: Array<Record<string, unknown>>;
    history?: Array<Record<string, unknown>>;
  };

  const rows =
    source.result?.messages ?? source.result?.history ?? source.messages ?? source.history ?? [];

  return rows
    .map((row) => {
      const role = row.role === "assistant" ? "assistant" : row.role === "user" ? "user" : null;
      const content = normalizeContentText(row.content);

      if (!role || !content || content.length === 0) {
        return null;
      }

      return ensureUiMessageShape({
        id: typeof row.id === "string" ? row.id : undefined,
        timestamp: typeof row.timestamp === "string" ? row.timestamp : undefined,
        role,
        content,
        ...(Array.isArray(row.intermediateSteps) ? { intermediateSteps: row.intermediateSteps } : {}),
      });
    })
    .filter((item): item is UiChatMessage => item !== null);
};

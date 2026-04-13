import { UiChatMessage } from "@/types/chat";

const FALLBACK_ID_PREFIX = "msg";

export const createMessageId = (): string => {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  return `${FALLBACK_ID_PREFIX}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

export const createMessageTimestamp = (): string => {
  return new Date().toISOString();
};

export const ensureUiMessageShape = (
  message: Pick<UiChatMessage, "role" | "content"> &
    Partial<Pick<UiChatMessage, "id" | "timestamp" | "isError" | "feedback" | "intermediateSteps">>,
): UiChatMessage => {
  const feedback =
    message.feedback &&
    typeof message.feedback === "object" &&
    (message.feedback.reaction === "up" || message.feedback.reaction === "down") &&
    typeof message.feedback.updatedAt === "string"
      ? {
          reaction: message.feedback.reaction,
          updatedAt: message.feedback.updatedAt,
          ...(typeof message.feedback.comment === "string" && message.feedback.comment.length > 0
            ? { comment: message.feedback.comment }
            : {}),
        }
      : undefined;

  return {
    id: typeof message.id === "string" && message.id.length > 0 ? message.id : createMessageId(),
    timestamp:
      typeof message.timestamp === "string" && message.timestamp.length > 0 ? message.timestamp : createMessageTimestamp(),
    role: message.role,
    content: message.content,
    ...(message.isError === true ? { isError: true } : {}),
    ...(feedback ? { feedback } : {}),
    ...(Array.isArray(message.intermediateSteps) ? { intermediateSteps: message.intermediateSteps } : {}),
  };
};

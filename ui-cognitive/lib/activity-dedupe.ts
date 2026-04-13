import { AgentActivityEvent } from "@/types/chat";

const normalizeText = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
};

const stringifyCompact = (value: unknown): string => {
  if (value === undefined) {
    return "";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const buildActivityDedupeKey = (
  event: Partial<AgentActivityEvent>,
): string => {
  const stepId = normalizeText(event.stepId);
  const stream = normalizeText(event.stream) || "status";
  const status = normalizeText(event.status);
  const state = normalizeText(event.state);

  if (stepId) {
    return `step:${stepId}|stream:${stream}|status:${status}|state:${state}`;
  }

  const runId = normalizeText(event.runId ?? event.workflowRunId);
  const conversationId = normalizeText(event.conversationId);
  const name = normalizeText(event.toolName ?? event.name ?? event.phase ?? event.source);
  const timestamp =
    typeof event.timestamp === "number" && Number.isFinite(event.timestamp)
      ? String(event.timestamp)
      : "";
  const text = normalizeText(event.text);
  const args = stringifyCompact(event.toolArgs);
  const result = normalizeText(event.toolResult);

  return [
    `stream:${stream}`,
    `status:${status}`,
    `state:${state}`,
    `run:${runId}`,
    `conversation:${conversationId}`,
    `name:${name}`,
    `timestamp:${timestamp}`,
    `text:${text}`,
    `args:${args}`,
    `result:${result}`,
  ].join("|");
};

import { AgentActivityEvent, ChatModelMetadata, ToolEvent, TokenUsage } from "@/types/chat";

type ErrorEvent = {
  message: string;
};

type SSEChunk = {
  choices?: Array<{ delta?: { content?: string } }>;
};

/**
 * Extract a content token from a single SSE `data:` line.
 * Returns the token string, or `null` if the line is not a content-bearing event.
 */
export const extractSSEToken = (line: string): string | null => {
  if (!line.startsWith("data:")) {
    return null;
  }

  const payload = line.slice("data:".length).trim();

  if (!payload || payload === "[DONE]") {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as SSEChunk;
    const content = parsed.choices?.[0]?.delta?.content;
    return typeof content === "string" ? content : null;
  } catch {
    return null;
  }
};

/**
 * Extract a ToolEvent from a complete SSE block (multi-line, split by \n\n).
 * Returns null if the block is not a tool event.
 * Does not interfere with extractSSEToken — tool blocks use `event: tool` prefix.
 */
export const extractToolEvent = (block: string): ToolEvent | null => {
  if (!block.includes("event: tool")) {
    return null;
  }

  const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
  if (!dataLine) {
    return null;
  }

  const payload = dataLine.slice("data:".length).trim();
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload) as ToolEvent;
  } catch {
    return null;
  }
};

/**
 * Extract chat model metadata from a complete SSE block.
 * Returns null if the block is not a metadata event.
 */
export const extractMetadataEvent = (block: string): ChatModelMetadata | null => {
  if (!block.includes("event: metadata")) {
    return null;
  }

  const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
  if (!dataLine) {
    return null;
  }

  const payload = dataLine.slice("data:".length).trim();
  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as ChatModelMetadata;
    const model = typeof parsed.model === "string" && parsed.model.trim().length > 0 ? parsed.model.trim() : undefined;
    const provider =
      typeof parsed.provider === "string" && parsed.provider.trim().length > 0 ? parsed.provider.trim() : undefined;
    const costCategory =
      parsed.costCategory === "free" ||
      parsed.costCategory === "low" ||
      parsed.costCategory === "medium" ||
      parsed.costCategory === "high" ||
      parsed.costCategory === "unknown"
        ? parsed.costCategory
        : undefined;
    const billingType =
      parsed.billingType === "trial" ||
      parsed.billingType === "paid" ||
      parsed.billingType === "self-hosted" ||
      parsed.billingType === "unknown"
        ? parsed.billingType
        : undefined;
    const budgetState =
      parsed.budgetState === "ok" || parsed.budgetState === "warning" || parsed.budgetState === "limited"
        ? parsed.budgetState
        : undefined;

    if (!model && !provider && !costCategory && !billingType && !budgetState) {
      return null;
    }

    return {
      ...(model ? { model } : {}),
      ...(provider ? { provider } : {}),
      ...(costCategory ? { costCategory } : {}),
      ...(billingType ? { billingType } : {}),
      ...(budgetState ? { budgetState } : {}),
      ...(typeof parsed.estimatedCostUsd === "number" && Number.isFinite(parsed.estimatedCostUsd)
        ? { estimatedCostUsd: parsed.estimatedCostUsd }
        : {}),
      ...(typeof parsed.cumulativeSessionCostUsd === "number" && Number.isFinite(parsed.cumulativeSessionCostUsd)
        ? { cumulativeSessionCostUsd: parsed.cumulativeSessionCostUsd }
        : {}),
      ...(typeof parsed.cumulativeUserCostUsd === "number" && Number.isFinite(parsed.cumulativeUserCostUsd)
        ? { cumulativeUserCostUsd: parsed.cumulativeUserCostUsd }
        : {}),
      ...(typeof parsed.fallbackFromModel === "string" && parsed.fallbackFromModel.trim().length > 0
        ? { fallbackFromModel: parsed.fallbackFromModel.trim() }
        : {}),
      ...(parsed.guardrailEvent === "none" ||
      parsed.guardrailEvent === "warning" ||
      parsed.guardrailEvent === "fallback" ||
      parsed.guardrailEvent === "block"
        ? { guardrailEvent: parsed.guardrailEvent }
        : {}),
      ...(typeof parsed.warningMessage === "string" && parsed.warningMessage.trim().length > 0
        ? { warningMessage: parsed.warningMessage.trim() }
        : {}),
    };
  } catch {
    return null;
  }
};

/**
 * Extract agent activity metadata from a complete SSE block.
 * Returns null if the block is not an activity event.
 */
export const extractActivityEvent = (block: string): AgentActivityEvent | null => {
  if (!block.includes("event: activity")) {
    return null;
  }

  const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
  if (!dataLine) {
    return null;
  }

  const payload = dataLine.slice("data:".length).trim();
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload) as AgentActivityEvent;
  } catch {
    return null;
  }
};

/**
 * Extract error payload from a complete SSE block.
 * Returns null if the block is not an error event.
 */
export const extractErrorEvent = (block: string): ErrorEvent | null => {
  if (!block.includes("event: error")) {
    return null;
  }

  const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
  if (!dataLine) {
    return null;
  }

  const payload = dataLine.slice("data:".length).trim();
  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as { message?: unknown };
    if (typeof parsed.message !== "string" || parsed.message.trim().length === 0) {
      return null;
    }
    return { message: parsed.message };
  } catch {
    return null;
  }
};

/**
 * Extract token usage payload from a complete SSE block.
 * Returns null if the block is not a usage event.
 */
export const extractUsageEvent = (block: string): TokenUsage | null => {
  if (!block.includes("event: usage")) {
    return null;
  }

  const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
  if (!dataLine) {
    return null;
  }

  const payload = dataLine.slice("data:".length).trim();
  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as Partial<TokenUsage>;
    const promptTokens = Number(parsed.promptTokens);
    const completionTokens = Number(parsed.completionTokens);
    const totalTokens = Number(parsed.totalTokens);
    const isEstimated = parsed.isEstimated;

    if (
      !Number.isFinite(promptTokens) ||
      !Number.isFinite(completionTokens) ||
      !Number.isFinite(totalTokens) ||
      typeof isEstimated !== "boolean"
    ) {
      return null;
    }

    return {
      promptTokens,
      completionTokens,
      totalTokens,
      isEstimated,
      ...(typeof parsed.estimatedCostUsd === "number" && Number.isFinite(parsed.estimatedCostUsd)
        ? { estimatedCostUsd: parsed.estimatedCostUsd }
        : {}),
      ...(typeof parsed.cumulativeSessionCostUsd === "number" && Number.isFinite(parsed.cumulativeSessionCostUsd)
        ? { cumulativeSessionCostUsd: parsed.cumulativeSessionCostUsd }
        : {}),
      ...(typeof parsed.cumulativeUserCostUsd === "number" && Number.isFinite(parsed.cumulativeUserCostUsd)
        ? { cumulativeUserCostUsd: parsed.cumulativeUserCostUsd }
        : {}),
      ...(parsed.budgetState === "ok" || parsed.budgetState === "warning" || parsed.budgetState === "limited"
        ? { budgetState: parsed.budgetState }
        : {}),
    };
  } catch {
    return null;
  }
};

/**
 * Process a raw SSE buffer (possibly with residual incomplete events)
 * and return all content tokens found.
 */
export const flushSSEBuffer = (buffer: string): string[] => {
  if (!buffer.trim()) {
    return [];
  }

  const parts = buffer.split("\n");
  const tokens: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const token = extractSSEToken(trimmed);
    if (token !== null) {
      tokens.push(token);
    }
  }

  return tokens;
};

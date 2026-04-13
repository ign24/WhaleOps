import {
  AgentActivityEvent,
  ChatModelMetadata,
  GatewayChatMessage,
  TokenUsage,
} from "@/types/chat";
import { buildActivityDedupeKey } from "@/lib/activity-dedupe";

type StreamChatViaHttpInput = {
  backendUrl: string;
  messages: GatewayChatMessage[];
  conversationId?: string;
  timeoutMs: number;
  onToken: (token: string) => void;
  onMetadata?: (metadata: ChatModelMetadata) => void;
  onAgentActivity?: (event: AgentActivityEvent) => void;
  onUsage?: (usage: TokenUsage) => void;
  model?: string;
  temperaturePreset?: string;
};

type ChatChunk = {
  model?: string;
  choices?: Array<{ delta?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  usage_estimated?: boolean;
};

const toText = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
};

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
};

const toDisplayText = (value: unknown): string | undefined => {
  const text = toText(value);
  if (text !== undefined) {
    return text;
  }

  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return undefined;
    }
  }

  return undefined;
};

const toActivityEvent = (
  payload: Record<string, unknown>
): AgentActivityEvent => {
  const stepType = toText(payload.type)?.toLowerCase() ?? "status";
  const rawName = toText(payload.name);
  const rawPayload = toText(payload.payload);
  const nestedPayload = toRecord(payload.payload);
  const metadata = toRecord(payload.metadata) ?? toRecord(nestedPayload?.metadata);
  const providedMetadata = toRecord(metadata?.provided_metadata);
  const toolArgs =
    toRecord(payload.tool_args) ?? toRecord(payload.toolArgs) ?? toRecord(payload.args) ?? toRecord(payload.input);
  const toolResult =
    toDisplayText(payload.tool_result) ??
    toDisplayText(payload.toolResult) ??
    toDisplayText(payload.result) ??
    toDisplayText(payload.output);
  const isToolStep =
    stepType.includes("tool") ||
    (rawName?.toLowerCase().includes("tool") ?? false) ||
    toolArgs !== undefined ||
    toolResult !== undefined;
  const statusText = `${toText(payload.status) ?? ""} ${toText(payload.state) ?? ""}`
    .trim()
    .toLowerCase();
  const isCompletedToolStep =
    stepType.includes("end") ||
    stepType.includes("complete") ||
    stepType.includes("final") ||
    statusText.includes("done") ||
    statusText.includes("complete") ||
    statusText.includes("final") ||
    statusText.includes("success") ||
    statusText.includes("fail") ||
    statusText.includes("error") ||
    toolResult !== undefined;
  const runId =
    toText(payload.run_id) ??
    toText(payload.runId) ??
    toText(payload.workflow_run_id) ??
    toText(nestedPayload?.workflow_run_id) ??
    toText(providedMetadata?.workflow_run_id);
  const conversationId =
    toText(payload.conversation_id) ??
    toText(payload.conversationId) ??
    toText(nestedPayload?.conversation_id) ??
    toText(providedMetadata?.conversation_id);
  const toolName = isToolStep ? rawName ?? "tool" : undefined;

  const event: AgentActivityEvent = {
    stream: isToolStep
      ? isCompletedToolStep
        ? "tool_end"
        : "tool_start"
      : "status",
    timestamp: Date.now(),
    stepId: toText(payload.id),
    parentStepId: toText(payload.parent_id) ?? toText(payload.intermediate_parent_id),
    ...(runId ? { runId } : {}),
    ...(runId ? { workflowRunId: runId } : {}),
    ...(conversationId ? { conversationId } : {}),
    name: rawName,
    text: rawPayload,
    status: toText(payload.status),
    state: toText(payload.state),
    toolName,
    ...(toolName ? { source: toolName.toLowerCase() } : {}),
    ...(toolArgs ? { toolArgs } : {}),
    ...(toolResult ? { toolResult } : {}),
  };

  return {
    ...event,
    dedupeKey: buildActivityDedupeKey(event),
  };
};

const parseDataChunk = (
  raw: string,
  onToken: (token: string) => void,
  onMetadata: ((metadata: ChatModelMetadata) => void) | undefined,
  onUsage: ((usage: TokenUsage) => void) | undefined
) => {
  if (raw === "[DONE]") {
    return;
  }

  let parsed: ChatChunk;
  try {
    parsed = JSON.parse(raw) as ChatChunk;
  } catch {
    return;
  }

  const token = parsed.choices?.[0]?.delta?.content;
  if (typeof token === "string" && token.length > 0) {
    onToken(token);
  }

  if (
    onMetadata &&
    typeof parsed.model === "string" &&
    parsed.model.length > 0
  ) {
    onMetadata({ model: parsed.model, provider: "nat" });
  }

  if (onUsage && parsed.usage) {
    const promptTokens = Number(parsed.usage.prompt_tokens ?? 0);
    const completionTokens = Number(parsed.usage.completion_tokens ?? 0);
    const totalTokens = Number(parsed.usage.total_tokens ?? promptTokens + completionTokens);

    if (
      Number.isFinite(promptTokens) &&
      Number.isFinite(completionTokens) &&
      Number.isFinite(totalTokens)
    ) {
      onUsage({
        promptTokens,
        completionTokens,
        totalTokens,
        isEstimated: parsed.usage_estimated !== false,
      });
    }
  }
};

const parseIntermediateChunk = (
  raw: string,
  onAgentActivity: ((event: AgentActivityEvent) => void) | undefined
) => {
  if (!onAgentActivity) {
    return;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    onAgentActivity(toActivityEvent(parsed));
  } catch {
    // Ignore malformed intermediate step chunks.
  }
};

export const streamChatViaHttp = async ({
  backendUrl,
  messages,
  conversationId,
  timeoutMs,
  onToken,
  onMetadata,
  onAgentActivity,
  onUsage,
  model,
  temperaturePreset,
}: StreamChatViaHttpInput): Promise<void> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${backendUrl}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...(conversationId
          ? {
              "Conversation-Id": conversationId,
              "X-Conversation-Id": conversationId,
            }
          : {}),
      },
      body: JSON.stringify({
        messages,
        stream: true,
        ...(model ? { model } : {}),
        ...(temperaturePreset ? { temperature_preset: temperaturePreset } : {}),
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      let details = `NAT backend responded ${response.status}`;
      try {
        const text = await response.text();
        if (text.trim().length > 0) {
          details = `${details}: ${text}`;
        }
      } catch {
        // Keep default message.
      }
      throw new Error(details);
    }

    if (!response.body) {
      throw new Error("NAT backend returned an empty response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        if (trimmed.startsWith("data:")) {
          parseDataChunk(trimmed.slice(5).trim(), onToken, onMetadata, onUsage);
          continue;
        }

        if (trimmed.startsWith("intermediate_data:")) {
          parseIntermediateChunk(
            trimmed.slice("intermediate_data:".length).trim(),
            onAgentActivity
          );
        }
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }
};

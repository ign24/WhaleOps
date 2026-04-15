import { auth } from "@/auth";
import { safeParseJson } from "@/lib/api-utils";
import { getBackendUrl } from "@/lib/env";
import { streamChatViaHttp } from "@/lib/nat-client";
import { buildActivityDedupeKey } from "@/lib/activity-dedupe";
import { sanitizeAssistantContent } from "@/lib/content-sanitizer";
import { extractTextFromContent } from "@/lib/content-blocks";
import { createThinkStreamState, flushThinkState, parseThinkChunk } from "@/lib/thinking";
import { appendSessionMessages } from "@/lib/sessions";
import {
  estimateRequestCost,
  evaluateBudgetPreflight,
  readCostGovernanceConfig,
  registerUsageCost,
} from "@/lib/cost-governance";
import { getModelCostMetadata } from "@/lib/model-registry";
import {
  AgentActivityEvent,
  ChatModelMetadata,
  ContentBlock,
  GatewayChatMessage,
  TokenUsage,
} from "@/types/chat";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

const DEFAULT_CHAT_TIMEOUT_MS = 1_800_000;

const normalizeIntentText = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const isSmallTalkFastPath = (normalized: string): boolean => {
  if (!normalized || normalized.length > 80 || normalized.startsWith("/")) {
    return false;
  }

  const greeting = /^(hola|hello|hi|buenas|buen dia|buenas tardes|buenas noches)[!,. ]*$/;
  const greetingHowAreYou = /^(hola|hello|hi)[!,. ]+(como estas|how are you)\??$/;
  const thanks = /^(gracias|thanks|thank you|ok|dale|genial|perfecto)[!,. ]*$/;

  return greeting.test(normalized) || greetingHowAreYou.test(normalized) || thanks.test(normalized);
};

const buildSmallTalkFastReply = (normalized: string): string => {
  if (normalized.includes("gracias") || normalized.includes("thanks") || normalized.includes("thank you")) {
    return "De nada. Cuando quieras, te ayudo con algo del repo.";
  }

  if (normalized.includes("como estas") || normalized.includes("how are you")) {
    return "Hola. Todo bien por aca. Si queres, contame que necesitás y lo vemos.";
  }

  return "Hola. Estoy listo para ayudarte con el repo.";
};

const resolveChatTimeoutMs = (): number => {
  const raw = process.env.NAT_CHAT_TIMEOUT_MS ?? process.env.OPENCLAW_CHAT_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_CHAT_TIMEOUT_MS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_CHAT_TIMEOUT_MS;
  }

  return Math.floor(parsed);
};

export async function POST(request: Request) {
  const requestId = randomUUID();
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await safeParseJson<{
    model?: string;
    temperaturePreset?: string;
    sessionKey?: string;
    messages?: GatewayChatMessage[];
  }>(request);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  if (
    !body.messages ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0
  ) {
    return NextResponse.json(
      { error: "messages are required" },
      { status: 400 }
    );
  }

  const messages = body.messages;
  const requestedModel =
    typeof body.model === "string" && body.model.trim().length > 0
      ? body.model
      : "qwen_3_5_122b_a10b";
  const userId =
    typeof session.user.id === "string" && session.user.id.trim().length > 0
      ? session.user.id
      : typeof session.user.email === "string" && session.user.email.trim().length > 0
        ? session.user.email
        : `anonymous-${requestId}`;
  const sessionBudgetKey =
    typeof body.sessionKey === "string" && body.sessionKey.trim().length > 0
      ? body.sessionKey
      : `ephemeral-${userId}`;

  const costConfig = readCostGovernanceConfig();
  const estimatedCost = estimateRequestCost(messages, requestedModel);
  const preflight = evaluateBudgetPreflight({
    userId,
    sessionKey: sessionBudgetKey,
    requestedModel,
    estimatedRequestUsd: estimatedCost.amountUsd,
    config: costConfig,
  });

  if (!preflight.allowed) {
    return NextResponse.json(
      {
        error: preflight.warningMessage ?? "Budget limit reached",
        code: "budget_limit",
        budgetState: preflight.budgetState,
        guardrailEvent: preflight.guardrailEvent,
        sessionTotalUsd: preflight.sessionTotalUsd,
        userTotalUsd: preflight.userTotalUsd,
      },
      { status: 429 },
    );
  }

  const modelForRequest = preflight.effectiveModel;
  const costMeta = getModelCostMetadata(modelForRequest);
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const lastUserContentText = lastUserMessage
    ? extractTextFromContent(lastUserMessage.content)
    : "";
  const normalizedLastUserMessage = normalizeIntentText(lastUserContentText);

  if (!body.sessionKey && isSmallTalkFastPath(normalizedLastUserMessage)) {
    const assistantContent = buildSmallTalkFastReply(normalizedLastUserMessage);

    if (body.sessionKey && lastUserMessage) {
      try {
        await appendSessionMessages(body.sessionKey, [
          { role: "user", content: lastUserContentText },
          { role: "assistant", content: assistantContent },
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to persist session exchange";
        console.error("[api/chat] fast-path persistence failed", { requestId, message });
      }
    }

    return new Response(
      `data: ${JSON.stringify({ choices: [{ delta: { content: assistantContent } }] })}\n\ndata: [DONE]\n\n`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      },
    );
  }

  try {
    const backendUrl = getBackendUrl();
    const timeoutMs = resolveChatTimeoutMs();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        let isClosed = false;
        let assistantContent = "";
        const intermediateSteps: AgentActivityEvent[] = [];
        const seenActivityDedupeKeys = new Set<string>();
        let thinkState = createThinkStreamState();
        let currentThinkingStepId: string | null = null;
        let thinkingStepCount = 0;

        const safeEnqueue = (chunk: string) => {
          if (isClosed) {
            return;
          }

          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            isClosed = true;
          }
        };

        const safeClose = () => {
          if (isClosed) {
            return;
          }

          isClosed = true;
          try {
            controller.close();
          } catch {
            // stream already closed/cancelled by consumer
          }
        };

        const emitVisibleToken = (tokenPart: string) => {
          if (!tokenPart) {
            return;
          }
          assistantContent += tokenPart;
          safeEnqueue(
            `data: ${JSON.stringify({
              choices: [{ delta: { content: tokenPart } }],
            })}\n\n`
          );
        };

        const persistExchange = async () => {
          if (!body.sessionKey || !lastUserMessage) {
            return;
          }

          const persistedAssistantContent = sanitizeAssistantContent(assistantContent);

          try {
            await appendSessionMessages(body.sessionKey, [
              { role: "user", content: lastUserContentText },
              {
                role: "assistant",
                content: persistedAssistantContent,
                ...(intermediateSteps.length > 0 ? { intermediateSteps } : {}),
              },
            ]);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to persist session exchange";
            console.error("[api/chat] persistence failed", { requestId, message });
          }
        };

        const writeMetadata = (metadata: ChatModelMetadata) => {
          safeEnqueue(`event: metadata\ndata: ${JSON.stringify(metadata)}\n\n`);
        };

        const writeActivity = (event: AgentActivityEvent) => {
          const dedupeKey = event.dedupeKey ?? buildActivityDedupeKey(event);
          if (seenActivityDedupeKeys.has(dedupeKey)) {
            return;
          }

          seenActivityDedupeKeys.add(dedupeKey);
          const normalizedEvent: AgentActivityEvent = { ...event, dedupeKey };
          intermediateSteps.push(normalizedEvent);
          safeEnqueue(`event: activity\ndata: ${JSON.stringify(normalizedEvent)}\n\n`);
        };

        const writeUsage = (usage: TokenUsage) => {
          const usageTotals = registerUsageCost({
            userId,
            sessionKey: sessionBudgetKey,
            model: modelForRequest,
            usage,
          });

          safeEnqueue(
            `event: usage\ndata: ${JSON.stringify({
              ...usage,
              estimatedCostUsd: usageTotals.requestCostUsd,
              cumulativeSessionCostUsd: usageTotals.sessionTotalUsd,
              cumulativeUserCostUsd: usageTotals.userTotalUsd,
              budgetState: usageTotals.budgetState,
            })}\n\n`,
          );
        };

        const openThinkingStep = () => {
          if (currentThinkingStepId !== null) {
            return;
          }

          currentThinkingStepId = `thinking-${requestId}-${thinkingStepCount}`;
          thinkingStepCount += 1;
          writeActivity({
            stream: "thinking_start",
            timestamp: Date.now(),
            stepId: currentThinkingStepId,
            name: "thinking",
            status: "running",
            text: "Pensando...",
          });
        };

        const closeThinkingStep = (content: string) => {
          if (!currentThinkingStepId) {
            return;
          }

          writeActivity({
            stream: "thinking_end",
            timestamp: Date.now(),
            stepId: currentThinkingStepId,
            name: "thinking",
            status: "completed",
            text: content.length > 0 ? content : "",
          });
          currentThinkingStepId = null;
        };

        const writeToken = (tokenPart: string) => {
          const parsed = parseThinkChunk(thinkState, tokenPart);
          thinkState = parsed.state;

          for (const event of parsed.events) {
            if (event.type === "visible") {
              emitVisibleToken(event.content);
              continue;
            }

            if (event.type === "thinking_start") {
              openThinkingStep();
              continue;
            }

            closeThinkingStep(event.content);
          }
        };

        const writeError = (message: string) => {
          safeEnqueue(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
        };

        streamChatViaHttp({
          backendUrl,
          messages,
          conversationId: body.sessionKey,
          timeoutMs,
          onToken: writeToken,
          onMetadata: writeMetadata,
          onAgentActivity: writeActivity,
          onUsage: writeUsage,
          model: modelForRequest,
          temperaturePreset: body.temperaturePreset,
        })
          .then(async () => {
            const flushed = flushThinkState(thinkState);
            thinkState = flushed.state;
            for (const event of flushed.events) {
              if (event.type === "visible") {
                emitVisibleToken(event.content);
                continue;
              }

              if (event.type === "thinking_start") {
                openThinkingStep();
                continue;
              }

              closeThinkingStep(event.content);
            }

            await persistExchange();
            safeEnqueue("data: [DONE]\n\n");
            safeClose();
          })
          .catch(async (error) => {
            const message =
              error instanceof Error ? error.message : "NAT streaming failed";
            console.error("[api/chat] stream failed", { requestId, message });
            const flushed = flushThinkState(thinkState);
            thinkState = flushed.state;
            for (const event of flushed.events) {
              if (event.type === "visible") {
                emitVisibleToken(event.content);
                continue;
              }

              if (event.type === "thinking_start") {
                openThinkingStep();
                continue;
              }

              closeThinkingStep(event.content);
            }
            assistantContent += `\n[NAT] ${message}`;
            writeError(message);
            await persistExchange();
            safeEnqueue("data: [DONE]\n\n");
            safeClose();
          });

        writeMetadata({
          model: modelForRequest,
          provider: "ui-cognitive",
          costCategory: costMeta.costCategory,
          billingType: costMeta.billingType,
          budgetState: preflight.budgetState,
          estimatedCostUsd: estimatedCost.amountUsd,
          cumulativeSessionCostUsd: preflight.sessionTotalUsd,
          cumulativeUserCostUsd: preflight.userTotalUsd,
          ...(preflight.fallbackFromModel ? { fallbackFromModel: preflight.fallbackFromModel } : {}),
          guardrailEvent: preflight.guardrailEvent,
          ...(preflight.warningMessage ? { warningMessage: preflight.warningMessage } : {}),
        });

        if (preflight.guardrailEvent !== "none") {
          writeActivity({
            stream: "budget_guardrail",
            timestamp: Date.now(),
            name: "budget_guardrail",
            status: preflight.guardrailEvent === "warning" ? "warning" : "limited",
            model: modelForRequest,
            text: preflight.warningMessage ?? "Budget guardrail applied",
            toolArgs: {
              requestedModel,
              effectiveModel: modelForRequest,
              guardrailEvent: preflight.guardrailEvent,
            },
          });
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[api/chat] request failed", {
      requestId,
      message: error instanceof Error ? error.message : error,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 502 });
  }
}

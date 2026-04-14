"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Paperclip } from "lucide-react";

import { MessageMarkdown } from "@/components/chat/message-markdown";
import { ChatLoader } from "@/components/chat/chat-loader";
import { ChatHelpCard } from "@/components/chat/chat-help-card";
import { AnimatePresence, motion } from "motion/react";
import { InlineActivitySummary } from "@/components/chat/inline-activity-summary";
import { FilePreviewStrip } from "@/components/chat/file-preview-strip";
import { CommandAutocomplete, type CommandAutocompleteItem } from "@/components/chat/command-autocomplete";
import { GatewayStatus } from "@/components/chat/gateway-status";
import { Tooltip } from "@/components/ui/tooltip";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { useTypewriter } from "@/hooks/use-typewriter";
import { CHAT_COMMANDS } from "@/lib/command-registry";
import { classifyHttpChatError, classifyNetworkChatError, normalizeStreamErrorText } from "@/lib/chat-errors";
import { parseHistory } from "@/lib/chat-normalizers";
import { truncateMessages } from "@/lib/chat-strategies";
import {
  extractActivityEvent,
  extractErrorEvent,
  extractMetadataEvent,
  extractUsageEvent,
  extractSSEToken,
  extractToolEvent,
  flushSSEBuffer,
} from "@/lib/sse-parser";
import { ensureUiMessageShape } from "@/lib/message-utils";
import { sanitizeAssistantContent } from "@/lib/content-sanitizer";
import { buildActivityDedupeKey } from "@/lib/activity-dedupe";
import { validateAttachment, formatFileSize, getLanguageTag } from "@/lib/file-attachment";
import { ACTIVITY_UI_COPY } from "@/components/activity/activity-copy";
import { stripLabelPrefixes } from "@/components/activity/session-meta";
import { resolveModelKey } from "@/lib/model-registry";
import { extractTextFromContent } from "@/lib/content-blocks";
import {
  ActivityEntry,
  ActivityEntryKind,
  ActivityStatus,
  ContentBlock,
  GatewayChatMessage,
  MessageAttachment,
  TokenUsage,
  UiChatMessage,
} from "@/types/chat";
import { useSetAgentMood } from "@/contexts/agent-mood-context";
import { DeleteConfirmModal } from "@/components/workspace/delete-confirm-modal";
import {
  beginNewConversationAttempt,
  markNewConversationFeedbackVisible,
  markNewConversationHistoryReady,
  markNewConversationRouteReady,
} from "@/lib/new-conversation-latency";

const OPS_MODEL = "devstral";
const OPS_TEMPERATURE_PRESET = "medium";

const OPS_QUICK_ACTIONS = [
  { label: "Containers activos", prompt: "¿Qué containers están corriendo ahora?" },
  { label: "Estado general", prompt: "Dame un resumen del estado de todos los containers: cuántos corren, cuáles están detenidos y si hay reinicios recientes." },
  { label: "Containers caídos", prompt: "¿Hay containers detenidos o en estado de error?" },
  { label: "Ver logs", prompt: "Mostrar los últimos logs del container " },
] as const;

export type ChatPanelProps = {
  sessionKey: string;
  activityLog?: ActivityEntry[];
  onActivityEvent?: (entries: ActivityEntry[] | ((previous: ActivityEntry[]) => ActivityEntry[])) => void;
  activeTool?: string | null;
  onActiveToolChange?: (tool: string | null) => void;
  onToggleActivity?: () => void;
  isActivityOpen?: boolean;
  onOpenHistoricalActivity?: (messageId: string, entries: ActivityEntry[]) => void;
  onSendingChange?: (isSending: boolean) => void;
  onModelResolvedChange?: (modelKey: string) => void;
  onHistoryLoaded?: (entries: ActivityEntry[]) => void;
};

const getLatestAssistantMessageFromHistory = async (sessionKey: string): Promise<string | null> => {
  const response = await fetch(`/api/sessions/${sessionKey}/history`, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as unknown;
  const history = parseHistory(payload);
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index]?.role === "assistant") {
      return sanitizeAssistantContent(history[index].content);
    }
  }

  return null;
};

const estimateTokensFromText = (text: string): number => {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }

  return Math.max(1, Math.ceil(normalized.length / 4));
};

const estimateTokensFromMessages = (messages: GatewayChatMessage[]): number => {
  return messages.reduce((total, message) => {
    if (typeof message.content === "string") {
      return total + estimateTokensFromText(message.content);
    }
    const text = message.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join(" ");
    return total + estimateTokensFromText(text);
  }, 0);
};

const safeWindow = (): Window | null => (typeof window === "undefined" ? null : window);

const formatUsageValue = (value: number, isEstimated: boolean): string => {
  const formatted = Intl.NumberFormat("es-AR").format(Math.max(0, Math.floor(value)));
  return isEstimated ? `~${formatted}` : formatted;
};

const IGNORED_ACTIVITY_STREAMS = new Set(["assistant", "output", "response"]);
const NOISY_ACTIVITY_LABEL_PATTERNS = [/^function input/i, /^input:?$/i, /^output:?$/i, /^react agent$/i];

const isNoisyActivityLabel = (label: string): boolean => {
  const normalized = label.trim();
  if (!normalized) {
    return false;
  }
  return NOISY_ACTIVITY_LABEL_PATTERNS.some((pattern) => pattern.test(normalized));
};

const toActivityStatus = (stream: string, rawStatus?: string, rawState?: string): ActivityStatus => {
  const streamText = stream.trim().toLowerCase();
  const statusText = `${rawStatus ?? ""} ${rawState ?? ""}`.trim().toLowerCase();

  if (
    statusText.includes("fail") ||
    statusText.includes("error") ||
    statusText.includes("abort") ||
    statusText.includes("cancel") ||
    streamText.includes("fail") ||
    streamText.includes("error") ||
    streamText.includes("abort") ||
    streamText.includes("cancel")
  ) {
    return "failed";
  }

  if (
    streamText === "tool_end" ||
    streamText.includes("_end") ||
    streamText.includes("end_") ||
    streamText.includes("complete") ||
    streamText.includes("done") ||
    streamText.includes("finish") ||
    statusText.includes("done") ||
    statusText.includes("complete") ||
    statusText.includes("final")
  ) {
    return "completed";
  }

  if (statusText.includes("pending") || statusText.includes("wait")) {
    return "pending";
  }

  return "running";
};

const toActivityLabel = (stream: string, event: ReturnType<typeof extractActivityEvent>): string | null => {
  if (!event) {
    return null;
  }

  if (event.toolName) {
    return event.toolName;
  }

  if (event.name) {
    return event.name;
  }

  if (event.phase) {
    return event.phase;
  }

  if (event.text) {
    return event.text;
  }

  if (stream === "lifecycle") {
    return ACTIVITY_UI_COPY.lifecycleFallback;
  }

  if (stream === "status") {
    return ACTIVITY_UI_COPY.statusFallback;
  }

  return null;
};

const SYSTEM_ACTIVITY_LABEL_PATTERNS = [/^function start/i, /^function input/i, /^input:?$/i, /^output:?$/i, /^react agent$/i];

const isSystemActivityLabel = (label: string): boolean => {
  const normalized = label.trim();
  if (!normalized) {
    return false;
  }

  return SYSTEM_ACTIVITY_LABEL_PATTERNS.some((pattern) => pattern.test(normalized));
};

const toActivityKind = (stream: string, label: string): ActivityEntryKind => {
  if (stream === "lifecycle") {
    return "lifecycle";
  }

  if (stream.startsWith("tool")) {
    return "tool";
  }

  if (isSystemActivityLabel(label)) {
    return "lifecycle";
  }

  return "agent";
};

const readFirstString = (record: Record<string, unknown> | undefined, keys: string[]): string | undefined => {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
};

const summarizeToolContext = (event: ReturnType<typeof extractActivityEvent>): {
  commandSummary?: string;
  sandboxPath?: string;
  returnCodeSummary?: string;
  toolNameNormalized?: string;
} => {
  if (!event) {
    return {};
  }

  const toolNameNormalized =
    typeof event.toolName === "string" && event.toolName.trim().length > 0
      ? event.toolName.trim().toLowerCase()
      : undefined;

  const args = event.toolArgs;
  const commandSummary = readFirstString(args, ["command", "cmd", "script", "shell_command", "bash_command", "run", "exec"]);
  const sandboxPath = readFirstString(args, ["repo_path", "repoPath", "sandbox_path", "sandboxPath", "path", "file_path"]);

  let returnCodeSummary: string | undefined;
  if (typeof event.toolResult === "string" && event.toolResult.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(event.toolResult) as Record<string, unknown>;
      const returnCode = parsed.returncode ?? parsed.return_code ?? parsed.exit_code;
      if (typeof returnCode === "number" || typeof returnCode === "string") {
        returnCodeSummary = `rc=${returnCode}`;
      }
    } catch {
      // ignore non-json tool results
    }
  }

  return {
    ...(commandSummary ? { commandSummary } : {}),
    ...(sandboxPath ? { sandboxPath } : {}),
    ...(returnCodeSummary ? { returnCodeSummary } : {}),
    ...(toolNameNormalized ? { toolNameNormalized } : {}),
  };
};

const mergeActivityEntry = (previous: ActivityEntry[], event: ReturnType<typeof extractActivityEvent>): ActivityEntry[] => {
  if (!event) {
    return previous;
  }

  const stream = event.stream.toLowerCase();
  if (IGNORED_ACTIVITY_STREAMS.has(stream)) {
    return previous;
  }

  const label = toActivityLabel(stream, event);
  if (!label) {
    return previous;
  }

  if (isNoisyActivityLabel(label)) {
    return previous;
  }

  const status = toActivityStatus(stream, event.status, event.state);
  const timestamp = typeof event.timestamp === "number" ? event.timestamp : Date.now();
  const toolContext = summarizeToolContext(event);

  if (stream === "tool_end" || status === "completed" || status === "failed") {
    if (event.stepId) {
      for (let index = previous.length - 1; index >= 0; index -= 1) {
        const row = previous[index];
        if (row.stepId === event.stepId && (row.status === "running" || row.status === "pending")) {
          const clone = [...previous];
          clone[index] = {
            ...row,
            status,
            completedAt: timestamp,
            runId: event.runId ?? event.workflowRunId ?? row.runId,
            conversationId: event.conversationId ?? row.conversationId,
            ...toolContext,
            ...(event.text ? { detail: event.text } : {}),
            ...(event.toolArgs ? { toolArgs: event.toolArgs } : {}),
            ...(event.toolResult ? { toolResult: event.toolResult } : {}),
          };
          return clone;
        }
      }
    }

    for (let index = previous.length - 1; index >= 0; index -= 1) {
      const row = previous[index];
      if (stripLabelPrefixes(row.label.trim()) === stripLabelPrefixes(label.trim()) && (row.status === "running" || row.status === "pending")) {
        const clone = [...previous];
        clone[index] = {
          ...row,
          status,
          completedAt: timestamp,
          runId: event.runId ?? event.workflowRunId ?? row.runId,
          conversationId: event.conversationId ?? row.conversationId,
          ...toolContext,
          ...(event.text ? { detail: event.text } : {}),
          ...(event.toolArgs ? { toolArgs: event.toolArgs } : {}),
          ...(event.toolResult ? { toolResult: event.toolResult } : {}),
        };
        return clone;
      }
    }
  }

  const last = previous[previous.length - 1];
  if (last && last.label === label && last.status === status) {
    return previous;
  }

  const existingIds = new Set(previous.map((entry) => entry.id));
  const idBase = `${timestamp}-${event.stepId ?? "no-step"}-${previous.length}`;
  let nextId = idBase;
  let duplicateIndex = 1;

  while (existingIds.has(nextId)) {
    nextId = `${idBase}-${duplicateIndex}`;
    duplicateIndex += 1;
  }

  return [
    ...previous,
    {
      id: nextId,
      stepId: event.stepId,
      parentStepId: event.parentStepId,
      runId: event.runId ?? event.workflowRunId,
      conversationId: event.conversationId,
      label,
      kind: toActivityKind(stream, label),
      status,
      startedAt: timestamp,
      model: event.model,
      detail: event.text,
      ...toolContext,
      toolArgs: event.toolArgs,
      toolResult: event.toolResult,
    },
  ].slice(-40);
};

type StreamingMood = "thinking" | "executing" | "agitated";

const resolveStreamingMood = (entries: ActivityEntry[], activeTool?: string | null): StreamingMood => {
  const activeToolEntries = entries.filter(
    (entry) => entry.kind === "tool" && (entry.status === "running" || entry.status === "pending"),
  ).length;
  const activeAgentEntries = entries.filter(
    (entry) => entry.kind === "agent" && (entry.status === "running" || entry.status === "pending"),
  ).length;
  const hasNamedActiveTool = typeof activeTool === "string" && activeTool.trim().length > 0;

  if (activeToolEntries >= 2 || (activeToolEntries >= 1 && activeAgentEntries >= 2)) {
    return "agitated";
  }

  if (activeToolEntries >= 1 || hasNamedActiveTool) {
    return "executing";
  }

  if (activeAgentEntries >= 2) {
    return "agitated";
  }

  return "thinking";
};

const normalizeHistoryActivityEntries = (value: UiChatMessage["intermediateSteps"]): ActivityEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((step, index) => {
      if (!step || typeof step !== "object") {
        return null;
      }

      const source = step as Partial<ActivityEntry> & {
        stream?: string;
        name?: string;
        text?: string;
      };

      if (typeof source.label === "string" && typeof source.kind === "string" && typeof source.status === "string") {
        return {
          id: typeof source.id === "string" ? source.id : `history-${index}`,
          stepId: source.stepId,
          parentStepId: source.parentStepId,
          runId: source.runId,
          conversationId: source.conversationId,
          label: source.label,
          kind: source.kind as ActivityEntryKind,
          status: source.status as ActivityStatus,
          startedAt: typeof source.startedAt === "number" ? source.startedAt : Date.now(),
          completedAt: typeof source.completedAt === "number" ? source.completedAt : undefined,
          model: source.model,
          detail: typeof source.detail === "string" ? source.detail : undefined,
          toolNameNormalized:
            typeof source.toolNameNormalized === "string" ? source.toolNameNormalized : undefined,
          sandboxPath: typeof source.sandboxPath === "string" ? source.sandboxPath : undefined,
          commandSummary: typeof source.commandSummary === "string" ? source.commandSummary : undefined,
          returnCodeSummary:
            typeof source.returnCodeSummary === "string" ? source.returnCodeSummary : undefined,
          toolArgs: source.toolArgs,
          toolResult: source.toolResult,
        } satisfies ActivityEntry;
      }

      if (typeof source.stream === "string") {
        const event = source as ReturnType<typeof extractActivityEvent>;
        return mergeActivityEntry([], event)[0] ?? null;
      }

      return null;
    })
    .filter((entry): entry is ActivityEntry => entry !== null);
};

export const ChatPanel = ({
  sessionKey,
  activityLog = [],
  onActivityEvent = () => {},
  activeTool = null,
  onActiveToolChange = () => {},
  onToggleActivity = () => {},
  isActivityOpen = true,
  onOpenHistoricalActivity = () => {},
  onSendingChange,
  onModelResolvedChange,
  onHistoryLoaded,
}: ChatPanelProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isBootstrapNew = searchParams.get("bootstrap") === "new";
  const setAgentMood = useSetAgentMood();
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(() => !isBootstrapNew);
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [toolsOptions, setToolsOptions] = useState<string[]>([]);
  const [isToolsLoading, setIsToolsLoading] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [isAutocompleteHidden, setIsAutocompleteHidden] = useState(false);
  const {
    showScrollToBottom,
    messagesContainerRef,
    messagesBottomRef,
    scrollToBottom,
    handleMessagesScroll,
  } = useChatScroll();
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [feedbackPendingById, setFeedbackPendingById] = useState<Record<string, boolean>>({});
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    type: "code" | "image";
    content: string;
    sizeLabel: string;
    previewSrc?: string;
  } | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [enhancedAssistantMessageIds, setEnhancedAssistantMessageIds] = useState<Record<string, true>>({});
  const [isCompletionNoticeVisible, setIsCompletionNoticeVisible] = useState(false);
  const [typewriterMessageId, setTypewriterMessageId] = useState<string | null>(null);
  const [, setSessionTokenUsage] = useState<TokenUsage | null>(null);
  const [pendingDeleteConfirm, setPendingDeleteConfirm] = useState<{
    token: string;
    targetPath: string;
    sizeMb: number;
  } | null>(null);

  const shouldStickToBottomRef = useRef(true);

  const streamAbortRef = useRef<AbortController | null>(null);
  const didLoadToolsRef = useRef(false);
  const messagesRef = useRef<UiChatMessage[]>([]);
  const activityLogRef = useRef<ActivityEntry[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const completionNoticeTimeoutRef = useRef<number | null>(null);
  const titleAttentionTimeoutRef = useRef<number | null>(null);
  const originalDocumentTitleRef = useRef<string | null>(null);

  const activeTypewriterMessage =
    typewriterMessageId === null
      ? null
      : messages.find((message) => message.id === typewriterMessageId && message.role === "assistant") ?? null;
  const activeAssistantContent = activeTypewriterMessage?.content ?? "";
  const { displayedContent, isVisualStreaming, isQueueDrained } = useTypewriter({
    content: activeAssistantContent,
    isStreaming: isSending && activeTypewriterMessage !== null,
  });
  const visualStreamingActive = activeTypewriterMessage !== null && isVisualStreaming;
  const streamFollowActive = isSending || visualStreamingActive;
  const inputEstimatedTokens = useMemo(() => estimateTokensFromText(input), [input]);

  useEffect(() => {
    onModelResolvedChange?.(OPS_MODEL);
  }, [onModelResolvedChange]);

  const restoreDocumentTitle = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (originalDocumentTitleRef.current !== null) {
      document.title = originalDocumentTitleRef.current;
      originalDocumentTitleRef.current = null;
    }

    if (titleAttentionTimeoutRef.current !== null) {
      window.clearTimeout(titleAttentionTimeoutRef.current);
      titleAttentionTimeoutRef.current = null;
    }
  }, []);

  const showCompletionNotice = useCallback(() => {
    const win = safeWindow();
    if (!win) {
      return;
    }

    setIsCompletionNoticeVisible(true);
    if (completionNoticeTimeoutRef.current !== null) {
      win.clearTimeout(completionNoticeTimeoutRef.current);
    }
    completionNoticeTimeoutRef.current = win.setTimeout(() => {
      setIsCompletionNoticeVisible(false);
      completionNoticeTimeoutRef.current = null;
    }, 3000);
  }, []);

  const raiseBrowserAttention = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (document.visibilityState !== "hidden") {
      return;
    }

    if (originalDocumentTitleRef.current === null) {
      originalDocumentTitleRef.current = document.title;
    }
    document.title = `[LISTO] ${originalDocumentTitleRef.current}`;

    if (titleAttentionTimeoutRef.current !== null) {
      const win = safeWindow();
      if (win) {
        win.clearTimeout(titleAttentionTimeoutRef.current);
      }
    }
    const win = safeWindow();
    if (!win) {
      return;
    }

    titleAttentionTimeoutRef.current = win.setTimeout(() => {
      restoreDocumentTitle();
    }, 10000);

    if (typeof Notification === "undefined" || Notification.permission !== "granted") {
      return;
    }

    try {
      const notification = new Notification("Agente finalizado", {
        body: "La respuesta ya está lista en el chat.",
      });
      win.setTimeout(() => notification.close(), 5000);
    } catch {
      // no-op
    }
  }, [restoreDocumentTitle]);

  const handleMessagesContainerScroll = useCallback(() => {
    handleMessagesScroll();

    const container = messagesContainerRef.current;
    if (!container) {
      shouldStickToBottomRef.current = true;
      return;
    }

    const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = remaining <= 70;
  }, [handleMessagesScroll, messagesContainerRef]);

  const handleScrollToLatest = useCallback(() => {
    const win = safeWindow();
    if (!win) {
      return;
    }

    shouldStickToBottomRef.current = true;
    scrollToBottom();
    win.requestAnimationFrame(() => {
      handleMessagesScroll();
    });
  }, [handleMessagesScroll, scrollToBottom]);

  const notifyAgentCompletion = useCallback(() => {
    showCompletionNotice();
    raiseBrowserAttention();
  }, [raiseBrowserAttention, showCompletionNotice]);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    activityLogRef.current = activityLog;
  }, [activityLog]);

  useEffect(() => {
    const idsToEnhance = messages
      .filter(
        (message) =>
          message.role === "assistant" && message.content.trim().length > 0 && enhancedAssistantMessageIds[message.id] !== true,
      )
      .map((message) => message.id);

    if (idsToEnhance.length === 0) {
      return;
    }

    const rafId = requestAnimationFrame(() => {
      setEnhancedAssistantMessageIds((previous) => {
        const next = { ...previous };
        for (const id of idsToEnhance) {
          next[id] = true;
        }
        return next;
      });
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [messages, enhancedAssistantMessageIds]);

  useEffect(() => {
    onSendingChange?.(isSending || visualStreamingActive);
  }, [isSending, onSendingChange, visualStreamingActive]);

  useEffect(() => {
    if (isSending || visualStreamingActive) {
      setAgentMood(resolveStreamingMood(activityLog, activeTool));
    } else {
      setAgentMood("idle");
    }
  }, [isSending, visualStreamingActive, activityLog, activeTool, setAgentMood]);

  useEffect(() => {
    if (typewriterMessageId === null) {
      return;
    }

    if (!isSending && !visualStreamingActive) {
      setTypewriterMessageId(null);
    }
  }, [isSending, typewriterMessageId, visualStreamingActive]);

  useEffect(() => {
    if (!streamFollowActive) {
      return;
    }

    shouldStickToBottomRef.current = true;
    scrollToBottom();
  }, [scrollToBottom, streamFollowActive]);

  useEffect(() => {
    if (!streamFollowActive || !shouldStickToBottomRef.current) {
      return;
    }

    const win = safeWindow();
    if (!win) {
      return;
    }

    const frame = win.requestAnimationFrame(() => {
      scrollToBottom();
    });

    return () => {
      win.cancelAnimationFrame(frame);
    };
  }, [displayedContent, messages, scrollToBottom, streamFollowActive]);

  useEffect(() => {
    if (!streamFollowActive) {
      return;
    }

    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    const observer = new MutationObserver(() => {
      if (!shouldStickToBottomRef.current) {
        return;
      }

      const win = safeWindow();
      if (!win) {
        return;
      }

      win.requestAnimationFrame(() => {
        scrollToBottom();
      });
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [messagesContainerRef, scrollToBottom, streamFollowActive]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [adjustTextareaHeight, input]);

  const pushAssistantMessage = useCallback((content: string, isError = false) => {
    setMessages((previous) => [...previous, ensureUiMessageShape({ role: "assistant", content, isError })]);
  }, []);

  const appendAssistantToken = useCallback((token: string) => {
    setMessages((previous) => {
      const clone = [...previous];
      const lastMessage = clone[clone.length - 1];
      if (!lastMessage || lastMessage.role !== "assistant") {
        return previous;
      }

      clone[clone.length - 1] = {
        ...lastMessage,
        content: lastMessage.content + token,
        isError: false,
      };
      return clone;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (completionNoticeTimeoutRef.current !== null) {
        const win = safeWindow();
        if (win) {
          win.clearTimeout(completionNoticeTimeoutRef.current);
        }
      }

      restoreDocumentTitle();
    };
  }, [restoreDocumentTitle]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        restoreDocumentTitle();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [restoreDocumentTitle]);

  useEffect(() => {
    markNewConversationRouteReady(sessionKey, isBootstrapNew);
  }, [isBootstrapNew, sessionKey]);

  useEffect(() => {
    if (isBootstrapNew) {
      setIsHistoryLoading(false);
      return;
    }

    const controller = new AbortController();

    const loadHistory = async () => {
      setSessionTokenUsage(null);
      setIsHistoryLoading(true);

      try {
        const response = await fetch(`/api/sessions/${sessionKey}/history`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          setMessages([]);
          return;
        }

        const payload = (await response.json()) as unknown;
        const parsed = parseHistory(payload);
        setMessages(parsed);

        const allSteps = parsed.flatMap((m) => normalizeHistoryActivityEntries(m.intermediateSteps));
        if (allSteps.length > 0) {
          onHistoryLoaded?.(allSteps);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessages([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsHistoryLoading(false);
          markNewConversationHistoryReady(sessionKey);
        }
      }
    };

    void loadHistory();
    return () => controller.abort();
  }, [isBootstrapNew, sessionKey]);


  const setLastAssistantMessage = (content: string, isError = false) => {
    setMessages((previous) => {
      const clone = [...previous];
      if (clone.length === 0) {
        return clone;
      }

      clone[clone.length - 1] = {
        ...(clone[clone.length - 1] ?? ensureUiMessageShape({ role: "assistant", content: "" })),
        content,
        isError,
      };

      return clone;
    });
  };

  useEffect(() => {
    const normalized = input.trimStart().toLowerCase();
    if (!normalized.startsWith("/tools")) {
      return;
    }

    if (didLoadToolsRef.current || isToolsLoading) {
      return;
    }

    const controller = new AbortController();

    const loadTools = async () => {
      setIsToolsLoading(true);
      didLoadToolsRef.current = true;
      try {
        const response = await fetch("/api/tools", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as { tools?: string[] };
        if (response.ok && payload.tools) {
          setToolsOptions(payload.tools);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) setIsToolsLoading(false);
      }
    };

    void loadTools();
    return () => controller.abort();
  }, [input, isToolsLoading]);

  const autocompleteItems = useMemo<CommandAutocompleteItem[]>(() => {
    const normalized = input.trimStart();
    if (!normalized.startsWith("/")) {
      return [];
    }

    const lower = normalized.toLowerCase();

    if (lower.startsWith("/tools ")) {
      const toolQuery = normalized.slice("/tools ".length).trim().toLowerCase();
      if (isToolsLoading && toolsOptions.length === 0) {
        return [
          {
            label: "Cargando herramientas...",
            value: normalized,
            description: "Esperá un momento",
          },
        ];
      }

      return toolsOptions
        .filter((tool) => tool.toLowerCase().includes(toolQuery))
        .slice(0, 8)
        .map((tool) => ({
          label: tool,
          value: `/tools ${tool}`,
          description: "Filtrar herramienta",
        }));
    }

    const commandQuery = normalized.slice(1).toLowerCase();

    return CHAT_COMMANDS
      .filter((command) => command.name.slice(1).startsWith(commandQuery) || command.name.slice(1).includes(commandQuery))
      .slice(0, 8)
      .map((command) => ({
        label: command.name,
        value: command.insertValue,
        description: command.description,
      }));
  }, [input, isToolsLoading, toolsOptions]);

  const visibleAutocompleteItems = useMemo(
    () => (isAutocompleteHidden ? [] : autocompleteItems),
    [autocompleteItems, isAutocompleteHidden],
  );

  useEffect(() => {
    setAutocompleteIndex(0);
  }, [visibleAutocompleteItems]);

  const applyAutocomplete = useCallback((item: CommandAutocompleteItem) => {
    if (item.label === "Cargando herramientas...") {
      return;
    }
    setInput(item.value);
    setIsAutocompleteHidden(true);
  }, []);

  const handleInputChange = (value: string) => {
    setInput(value);
    setIsAutocompleteHidden(false);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (visibleAutocompleteItems.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setAutocompleteIndex((previous) => (previous + 1) % visibleAutocompleteItems.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setAutocompleteIndex((previous) => (previous - 1 + visibleAutocompleteItems.length) % visibleAutocompleteItems.length);
        return;
      }

      if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
        event.preventDefault();
        const selected = visibleAutocompleteItems[autocompleteIndex];
        if (selected) {
          applyAutocomplete(selected);
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setIsAutocompleteHidden(true);
        return;
      }
    }

    if (event.key === "Escape") {
      if (editingMessageIndex !== null) {
        event.preventDefault();
        setEditingMessageIndex(null);
        setInput("");
        return;
      }
    }

    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  const sendMessageToAgent = useCallback(
    async (content: string | ContentBlock[], attachments?: MessageAttachment[]) => {
      if (isSending) {
        return;
      }

      const displayContent = typeof content === "string" ? content : extractTextFromContent(content);
      const userMessage: UiChatMessage = ensureUiMessageShape({
        role: "user",
        content: displayContent,
        ...(attachments ? { attachments } : {}),
      });
      const assistantMessage = ensureUiMessageShape({ role: "assistant", content: "" });

      setInput("");
      setIsSending(true);
      onActivityEvent([]);
      setTypewriterMessageId(assistantMessage.id);
      setMessages((previous) => [...previous, userMessage, assistantMessage]);

      const maxOutboundMessages = 20;
      const outboundMessages = truncateMessages(
        [...messagesRef.current, { role: "user" as const, content: displayContent }],
        maxOutboundMessages,
      ) as GatewayChatMessage[];
      const estimatedPromptTokens = estimateTokensFromMessages(outboundMessages);
      // Build gateway payload — use the original content (may be ContentBlock[] for vision)
      const gatewayMessages: GatewayChatMessage[] = [
        ...outboundMessages.slice(0, -1),
        { role: "user", content },
      ];
      let isAbortedByUser = false;
      let shouldNotifyCompletion = false;

      try {
        setSessionTokenUsage({
          promptTokens: estimatedPromptTokens,
          completionTokens: 0,
          totalTokens: estimatedPromptTokens,
          isEstimated: true,
        });

        const controller = new AbortController();
        streamAbortRef.current = controller;
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            sessionKey,
            messages: gatewayMessages,
            model: OPS_MODEL,
            temperaturePreset: OPS_TEMPERATURE_PRESET,
          }),
        });

        if (!response.ok || !response.body) {
          let errorMessage = classifyHttpChatError(response.status);

          try {
            const payload = (await response.json()) as { error?: string; details?: string };
            errorMessage = classifyHttpChatError(
              response.status,
              payload.details ? `${payload.error ?? ""}: ${payload.details}` : payload.error,
            );
          } catch {
            // no-op
          }

          setLastAssistantMessage(errorMessage, true);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffered = "";
        let hasContent = false;
        let hasStreamError = false;
        let streamErrorMessage: string | null = null;
        let hasUsageEvent = false;
        let streamedAssistantContent = "";
        const seenActivityDedupeKeys = new Set<string>();
        let activeModelForActivity = OPS_MODEL;
        const requestedCanonicalModel = resolveModelKey(OPS_MODEL) ?? OPS_MODEL;

        const appendToken = (token: string) => {
          hasContent = true;
          streamedAssistantContent += token;
          const estimatedCompletionTokens = estimateTokensFromText(streamedAssistantContent);
          setSessionTokenUsage((previous) => {
            if (previous && previous.isEstimated === false) {
              return previous;
            }

            return {
              promptTokens: estimatedPromptTokens,
              completionTokens: estimatedCompletionTokens,
              totalTokens: estimatedPromptTokens + estimatedCompletionTokens,
              isEstimated: true,
            };
          });
          if (token.includes("[Gateway WS]") || token.includes("[NAT]")) {
            hasStreamError = true;
          }
          appendAssistantToken(token);
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffered += decoder.decode(value, { stream: true });
          const parts = buffered.split("\n\n");
          buffered = parts.pop() ?? "";

          for (const part of parts) {
            const metadataEvent = extractMetadataEvent(part);
            if (metadataEvent) {
              if (metadataEvent.model) {
                const metadataCanonicalModel =
                  resolveModelKey(metadataEvent.model) ?? metadataEvent.model;
                if (metadataCanonicalModel === requestedCanonicalModel) {
                  activeModelForActivity = metadataEvent.model;
                }
              }
              continue;
            }

            const activityEvent = extractActivityEvent(part);
            if (activityEvent) {
              const eventModel =
                typeof activityEvent.model === "string" && activityEvent.model.trim().length > 0
                  ? activityEvent.model
                  : null;
              const eventCanonicalModel =
                eventModel !== null ? resolveModelKey(eventModel) ?? eventModel : null;
              const shouldKeepEventModel =
                eventCanonicalModel !== null && eventCanonicalModel === requestedCanonicalModel;
              const activityEventWithModel =
                shouldKeepEventModel
                  ? activityEvent
                  : {
                      ...activityEvent,
                      model: activeModelForActivity,
                    };
              const dedupeKey = activityEvent.dedupeKey ?? buildActivityDedupeKey(activityEvent);
              if (!seenActivityDedupeKeys.has(dedupeKey)) {
                seenActivityDedupeKeys.add(dedupeKey);
                onActivityEvent((previous) => mergeActivityEntry(previous, activityEventWithModel));
              }

              // Detect workspace delete confirmation request from tool_end result
              if (
                activityEvent.stream === "tool_end" &&
                typeof activityEvent.toolResult === "string" &&
                activityEvent.toolResult.trim().startsWith("{")
              ) {
                try {
                  const parsed = JSON.parse(activityEvent.toolResult) as Record<string, unknown>;
                  if (
                    parsed.status === "awaiting_ui_confirmation" &&
                    typeof parsed.confirmation_token === "string" &&
                    typeof parsed.target_path === "string" &&
                    typeof parsed.size_mb === "number"
                  ) {
                    // Register the Python-issued token in the Next.js store
                    // before showing the modal so PIN confirmation can find it.
                    try {
                      const regRes = await fetch("/api/workspace/delete/register-token", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          token: parsed.confirmation_token,
                          path: parsed.target_path,
                          size_mb: parsed.size_mb,
                          location: parsed.location ?? "workspace",
                          target: parsed.target ?? "",
                        }),
                      });
                      if (!regRes.ok) throw new Error(`register-token ${regRes.status}`);
                    } catch {
                      setMessages((prev) => [
                        ...prev,
                        ensureUiMessageShape({
                          role: "assistant",
                          content: "Error al registrar el token de confirmación. Pedile al agente que lo intente de nuevo.",
                        }),
                      ]);
                      continue;
                    }
                    setPendingDeleteConfirm({
                      token: parsed.confirmation_token,
                      targetPath: parsed.target_path,
                      sizeMb: parsed.size_mb,
                    });
                  }
                } catch {
                  // non-JSON tool result — ignore
                }
              }

              continue;
            }

            // Handle tool lifecycle events — separate channel, does not affect token path
            const toolEvent = extractToolEvent(part);
            if (toolEvent) {
              if (toolEvent.stream === "tool_start" || toolEvent.stream === "tool_call") {
                  onActiveToolChange(toolEvent.toolName);
                } else if (toolEvent.stream === "tool_end") {
                  onActiveToolChange(null);
                }
                continue;
              }

            const errorEvent = extractErrorEvent(part);
            if (errorEvent) {
              hasStreamError = true;
              streamErrorMessage = errorEvent.message;
              continue;
            }

            const usageEvent = extractUsageEvent(part);
            if (usageEvent) {
              hasUsageEvent = true;
              setSessionTokenUsage(usageEvent);
              continue;
            }

            for (const line of part.split("\n")) {
              const token = extractSSEToken(line);
              if (token) {
                appendToken(token);
              }
            }
          }
        }

        if (buffered.trim()) {
          const bufferedUsageEvent = extractUsageEvent(buffered);
          if (bufferedUsageEvent) {
            hasUsageEvent = true;
            setSessionTokenUsage(bufferedUsageEvent);
          }

          const residualTokens = flushSSEBuffer(buffered);
          for (const token of residualTokens) {
            appendToken(token);
          }
        }

        setMessages((previous) => {
          const clone = [...previous];
          const last = clone[clone.length - 1];
          if (!last || last.role !== "assistant") {
            return clone;
          }
          const sanitized = sanitizeAssistantContent(last.content);
          if (sanitized === last.content) {
            return previous;
          }
          clone[clone.length - 1] = { ...last, content: sanitized };
          return clone;
        });

        if (!hasContent) {
          if (!hasUsageEvent) {
            setSessionTokenUsage({
              promptTokens: estimatedPromptTokens,
              completionTokens: 0,
              totalTokens: estimatedPromptTokens,
              isEstimated: true,
            });
          }

          const fallbackFromHistory = await getLatestAssistantMessageFromHistory(sessionKey);

          if (fallbackFromHistory) {
            setLastAssistantMessage(fallbackFromHistory);
          } else {
            setLastAssistantMessage(
              "El agente no generó respuesta. Puede deberse a un context window limitado o un timeout del modelo. Intenta con un mensaje más corto.",
            );
          }
        }

        if (hasStreamError) {
          setMessages((previous) => {
            const clone = [...previous];
            const lastMessage = clone[clone.length - 1];
            if (!lastMessage || lastMessage.role !== "assistant") {
              return clone;
            }

            clone[clone.length - 1] = {
              ...lastMessage,
              content:
                streamErrorMessage !== null
                  ? normalizeStreamErrorText(`[NAT] ${streamErrorMessage}`)
                  : normalizeStreamErrorText(lastMessage.content),
              isError: true,
            };
            return clone;
          });
        }

        shouldNotifyCompletion = !hasStreamError;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          isAbortedByUser = true;
          const last = messagesRef.current[messagesRef.current.length - 1];
          if (!last || last.role !== "assistant" || last.content.trim().length === 0) {
            setLastAssistantMessage("Respuesta detenida por el usuario.");
          }
          return;
        }

        setLastAssistantMessage(
          classifyNetworkChatError(error as Error),
          true,
        );
      } finally {
        const finalizedEntries = activityLogRef.current;
        if (finalizedEntries.length > 0) {
          setMessages((previous) => {
            const clone = [...previous];
            const last = clone[clone.length - 1];
            if (!last || last.role !== "assistant") {
              return clone;
            }

            clone[clone.length - 1] = {
              ...last,
              intermediateSteps: finalizedEntries,
            };

            return clone;
          });
        }

        streamAbortRef.current = null;
        setIsSending(false);
        onActiveToolChange(null);

        if (shouldNotifyCompletion && !isAbortedByUser) {
          notifyAgentCompletion();
        }
      }
    },
    [
      appendAssistantToken,
      isSending,
      notifyAgentCompletion,
      onActiveToolChange,
      onActivityEvent,
      sessionKey,
    ],
  );

  const handleFileSelect = (file: File) => {
    setAttachError(null);
    const validation = validateAttachment(file);

    if (!validation.ok) {
      setAttachError(validation.error);
      return;
    }

    const { type } = validation;
    const reader = new FileReader();

    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result !== "string") return;

      setAttachedFile({
        name: file.name,
        type,
        content: result,
        sizeLabel: formatFileSize(file.size),
        ...(type === "image" ? { previewSrc: result } : {}),
      });
    };

    if (type === "code") {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFileSelect(file);
    event.target.value = "";
  };

  const handleDragOver = (event: React.DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    if (isSending) return;
    const file = event.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) handleFileSelect(file);
        return;
      }
    }
  };

  const handleEditMessage = (index: number) => {
    setEditingMessageIndex(index);
    setInput(messages[index]?.content ?? "");
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();

    if (!trimmed && !attachedFile) {
      return;
    }

    if (editingMessageIndex !== null) {
      setMessages((previous) => previous.slice(0, editingMessageIndex));
      onActivityEvent([]);
      onActiveToolChange(null);
      setEditingMessageIndex(null);
    }

    let outboundContent: string | ContentBlock[] = trimmed;
    let displayAttachments: MessageAttachment[] | undefined;

    if (attachedFile) {
      if (attachedFile.type === "code") {
        const lang = getLanguageTag(attachedFile.name);
        outboundContent = `${trimmed}\n\n\`\`\`${lang}\n${attachedFile.content}\n\`\`\``.trim();
      } else {
        outboundContent = trimmed ? `${trimmed}\n\n(Imagen omitida — el agente ops no soporta vision)` : "(Imagen omitida — el agente ops no soporta vision)";
      }
      displayAttachments = [{ name: attachedFile.name, type: attachedFile.type }];
      setAttachedFile(null);
    }

    if (typeof outboundContent === "string" && outboundContent.startsWith("/")) {
      const parts = trimmed.slice(1).trim().split(/\s+/);
      const command = parts[0]?.toLowerCase() ?? "";

      if (!command) {
        return;
      }

        const appendLocalUserCommand = () => {
          setInput("");
          setMessages((previous) => [...previous, ensureUiMessageShape({ role: "user", content: trimmed })]);
        };

      if (command === "help") {
        appendLocalUserCommand();
        pushAssistantMessage([
          "Comandos locales disponibles:",
          "- `/help`: muestra esta ayuda",
          "- `/tools`: lista herramientas disponibles desde NAT",
          "- `/status`: estado del gateway y sesión",
          "- `/reset`: limpia el chat actual en UI",
          "- `/stop`: detiene la respuesta en curso",
          "- `/new`: crea una nueva conversación",
        ].join("\n"));
        return;
      }

      if (command === "stop") {
        appendLocalUserCommand();
        if (streamAbortRef.current) {
          streamAbortRef.current.abort();
          streamAbortRef.current = null;
          setIsSending(false);
          onActiveToolChange(null);
          pushAssistantMessage("Respuesta detenida.");
        } else {
          pushAssistantMessage("No hay una respuesta en curso para detener.");
        }
        return;
      }

      if (isSending) {
        appendLocalUserCommand();
        pushAssistantMessage("Esperá a que termine la respuesta actual o usá `/stop`.", true);
        return;
      }

      if (command === "reset") {
        appendLocalUserCommand();
        setMessages([]);
        onActiveToolChange(null);
        return;
      }

      if (command === "status") {
        appendLocalUserCommand();
        try {
          const response = await fetch("/api/health", { method: "GET", cache: "no-store" });
          const payload = (await response.json()) as { status?: string; code?: number; message?: string };
          const gatewayLabel = response.ok ? "activo" : "inactivo";
          const extra = payload.code ? ` (HTTP ${payload.code})` : "";
          const details = payload.message ? `\nDetalle: ${payload.message}` : "";

          pushAssistantMessage(`Sesión: ${sessionKey}\nGateway: ${gatewayLabel}${extra}${details}`);
        } catch {
          pushAssistantMessage(`Sesión: ${sessionKey}\nGateway: inactivo`, true);
        }
        return;
      }

      if (command === "tools") {
        appendLocalUserCommand();
        try {
          let availableTools = toolsOptions;
          let loadError: string | null = null;

          if (availableTools.length === 0) {
            const response = await fetch("/api/tools", { method: "GET", cache: "no-store" });
            const payload = (await response.json()) as { tools?: string[]; error?: string };

            if (!response.ok || !payload.tools || payload.tools.length === 0) {
              loadError = payload.error ?? "No se pudieron listar herramientas.";
            } else {
              availableTools = payload.tools;
              setToolsOptions(payload.tools);
            }
          }

          if (availableTools.length === 0) {
            pushAssistantMessage(loadError ?? "No se pudieron listar herramientas.", true);
            return;
          }

          const toolQuery = parts.slice(1).join(" ").trim().toLowerCase();
          const visibleTools = toolQuery
            ? availableTools.filter((tool) => tool.toLowerCase().includes(toolQuery))
            : availableTools;

          if (visibleTools.length === 0) {
            pushAssistantMessage(`No encontré herramientas para "${toolQuery}".`, true);
            return;
          }

          const list = visibleTools.map((tool) => `- ${tool}`).join("\n");
          pushAssistantMessage(`Herramientas disponibles (${visibleTools.length}):\n${list}`);
        } catch {
          pushAssistantMessage("No se pudieron listar herramientas.", true);
        }
        return;
      }

      if (command === "new") {
        appendLocalUserCommand();
        const sessionKey =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID().slice(0, 8)
            : Math.random().toString(36).slice(2, 10);
        beginNewConversationAttempt(sessionKey, "slash_new");
        markNewConversationFeedbackVisible(sessionKey);
        router.push(`/chat/${sessionKey}?bootstrap=new`);
        return;
      }

      appendLocalUserCommand();
      pushAssistantMessage("Comando desconocido. Usá `/help` para ver opciones disponibles.", true);
      return;
    }

    await sendMessageToAgent(outboundContent, displayAttachments);
  };

  const handleCopyMessage = async (index: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageIndex(index);
      setTimeout(() => setCopiedMessageIndex((current) => (current === index ? null : current)), 1200);
    } catch {
      // no-op
    }
  };

  const handleRegenerate = async () => {
    if (isSending) {
      return;
    }

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === "user") {
        await sendMessageToAgent(messages[index].content);
        return;
      }
    }
  };

  const handleRetryMessage = async (assistantIndex: number) => {
    if (isSending) {
      return;
    }

    for (let index = assistantIndex - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === "user") {
        await sendMessageToAgent(messages[index].content);
        return;
      }
    }
  };

  const handleRetryConnection = () => {
    pushAssistantMessage("Reintentando conexión con el gateway...");
  };

  const handleFeedback = async (messageId: string, reaction: "up" | "down") => {
    setFeedbackPendingById((previous) => ({ ...previous, [messageId]: true }));

    try {
      const response = await fetch(`/api/sessions/${sessionKey}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, reaction }),
      });

      if (!response.ok) {
        return;
      }

      setMessages((previous) =>
        previous.map((message) =>
          message.id === messageId
            ? {
                ...message,
                feedback: {
                  reaction,
                  updatedAt: new Date().toISOString(),
                },
              }
            : message,
        ),
      );
    } finally {
      setFeedbackPendingById((previous) => ({ ...previous, [messageId]: false }));
    }
  };

  const handleStopStreaming = () => {
    if (!streamAbortRef.current) {
      return;
    }

    streamAbortRef.current.abort();
  };

  const handleDeleteSuccess = (result: { status: string; size_freed_mb: number }) => {
    setPendingDeleteConfirm(null);
    const path = pendingDeleteConfirm?.targetPath ?? "";
    const mb = result.size_freed_mb ?? 0;
    setMessages((previous) => [
      ...previous,
      ensureUiMessageShape({
        role: "assistant",
        content: `Workspace eliminado: ${path} (${mb} MB liberados)`,
      }),
    ]);
  };

  const handleDeleteCancel = () => {
    setPendingDeleteConfirm(null);
    setMessages((previous) => [
      ...previous,
      ensureUiMessageShape({
        role: "assistant",
        content: "Eliminación cancelada",
      }),
    ]);
  };

  const handleDeleteExpired = () => {
    setPendingDeleteConfirm(null);
    setMessages((previous) => [
      ...previous,
      ensureUiMessageShape({
        role: "assistant",
        content: "La confirmación expiró. Pedile al agente que lo intente de nuevo.",
      }),
    ]);
  };

  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-0.5 sm:gap-6">
      {pendingDeleteConfirm && (
        <div
          data-testid="delete-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <DeleteConfirmModal
            token={pendingDeleteConfirm.token}
            targetPath={pendingDeleteConfirm.targetPath}
            sizeMb={pendingDeleteConfirm.sizeMb}
            onSuccess={handleDeleteSuccess}
            onCancel={handleDeleteCancel}
            onExpired={handleDeleteExpired}
          />
        </div>
      )}
      <div className="relative flex min-h-0 flex-col">
        {isCompletionNoticeVisible ? (
          <div className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2 rounded-md border border-black/15 bg-black px-3 py-1.5 text-xs font-medium text-white shadow-lg dark:border-white/15 dark:bg-zinc-900">
            Agente finalizado
          </div>
        ) : null}
        <div
          ref={messagesContainerRef}
          onScroll={handleMessagesContainerScroll}
          className="chat-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 pt-2 pb-0.5 sm:space-y-4 sm:px-3 sm:py-3 md:space-y-6 md:px-4 md:py-4"
          role="log"
          aria-live="polite"
        >
          {isHistoryLoading ? <ChatLoader /> : null}
          <AnimatePresence>
            {!isHistoryLoading && messages.length === 0 && (
              <ChatHelpCard
                onPromptSelect={(prompt) => {
                  setInput(prompt);
                  setTimeout(() => textareaRef.current?.focus(), 0);
                }}
              />
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
          {messages.map((message, index) => {
            const isLastMessage = index === messages.length - 1;
            const isTypewriterTarget = typewriterMessageId !== null && message.id === typewriterMessageId;
            const renderedMessageContent =
              isTypewriterTarget && (streamFollowActive || isQueueDrained)
                ? displayedContent
                : message.content;
            const isPendingAssistant =
              message.role === "assistant" &&
              renderedMessageContent.length === 0 &&
              isSending &&
              isLastMessage;
            const isStreamingAssistant =
              message.role === "assistant" &&
              renderedMessageContent.length > 0 &&
              visualStreamingActive &&
              isLastMessage;
            const historicalEntries = normalizeHistoryActivityEntries(message.intermediateSteps);
            const visibleEntries = isLastMessage && streamFollowActive ? activityLog : historicalEntries;
            const isEnhancedAssistant = message.role === "assistant" && enhancedAssistantMessageIds[message.id] === true;
            const streamingMood = isStreamingAssistant ? resolveStreamingMood(visibleEntries, activeTool) : null;

            return (
              <motion.article
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
                className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`message-bubble chat-message-rich max-w-4xl rounded-xl px-3 py-2.5 text-[13px] leading-5 sm:px-4 sm:py-3 sm:text-sm ${
                    message.role === "user"
                      ? "message-bubble-user ml-auto bg-[var(--primary)] text-[var(--text-on-primary)]"
                      : message.isError
                        ? "message-bubble-assistant border border-[color:var(--error)]/40 bg-[color:var(--error)]/10"
                        : "message-bubble-assistant border border-[var(--border)] bg-[var(--surface)]"
                  } ${isStreamingAssistant ? `assistant-streaming assistant-streaming--${streamingMood}` : ""}`}
                  data-chat-enhancement={isEnhancedAssistant ? "active" : "idle"}
                >
                  {message.role === "assistant" && visibleEntries.length > 0 ? (
                    <InlineActivitySummary
                      entries={visibleEntries}
                      activeTool={isLastMessage ? activeTool : null}
                      isLive={isLastMessage && visualStreamingActive}
                      onOpen={() => {
                        onOpenHistoricalActivity(message.id, visibleEntries);
                        if (!isActivityOpen) {
                          onToggleActivity();
                        }
                      }}
                    />
                  ) : null}
                {isPendingAssistant ? (
                  <ChatLoader />
                  ) : (
                    <>
                      <MessageMarkdown content={renderedMessageContent} enhancementState={isEnhancedAssistant ? "active" : "idle"} />
                      {isTypewriterTarget && visualStreamingActive && !isQueueDrained ? (
                        <span className="animate-blink" aria-hidden="true">
                          ▍
                        </span>
                      ) : null}
                      {message.role === "user" && message.attachments && message.attachments.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {message.attachments.map((att) => (
                            <span
                              key={att.name}
                              className="inline-flex items-center gap-1 rounded border border-[var(--text-on-primary)]/30 px-2 py-0.5 text-xs opacity-80"
                            >
                              <Paperclip size={11} />
                              {att.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {message.role === "user" && !isSending ? (
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleEditMessage(index)}
                            className="rounded border border-[var(--text-on-primary)]/30 px-2 py-0.5 text-xs opacity-70 hover:opacity-100"
                          >
                            Editar
                          </button>
                        </div>
                      ) : null}
                      {message.role === "assistant" && renderedMessageContent ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(index, renderedMessageContent)}
                            className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs"
                          >
                            {copiedMessageIndex === index ? "Copiado" : "Copiar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleFeedback(message.id, "up")}
                            disabled={feedbackPendingById[message.id] === true}
                            aria-label="Me gustó esta respuesta"
                            className={`rounded-lg border px-2 py-1 text-xs ${
                              message.feedback?.reaction === "up"
                                ? "border-[var(--success)] text-[var(--success)]"
                                : "border-[var(--border)]"
                            }`}
                          >
                            👍
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleFeedback(message.id, "down")}
                            disabled={feedbackPendingById[message.id] === true}
                            aria-label="No me gustó esta respuesta"
                            className={`rounded-lg border px-2 py-1 text-xs ${
                              message.feedback?.reaction === "down"
                                ? "border-[var(--error)] text-[var(--error)]"
                                : "border-[var(--border)]"
                            }`}
                          >
                            👎
                          </button>
                          {message.isError ? (
                            <button
                              type="button"
                              onClick={() => void handleRetryMessage(index)}
                              disabled={isSending}
                              className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-50"
                            >
                              Reintentar
                            </button>
                          ) : null}
                          {isLastMessage ? (
                            <button
                              type="button"
                              onClick={() => void handleRegenerate()}
                              className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs"
                            >
                              Regenerar
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </motion.article>
            );
          })}
          </AnimatePresence>
          <div ref={messagesBottomRef} />
        </div>
        {showScrollToBottom ? (
          <button
            type="button"
            onClick={handleScrollToLatest}
            aria-label="Ir al último mensaje"
            className="absolute bottom-2 right-2 z-20 inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)]/90 p-1.5 text-[var(--text)] shadow-sm backdrop-blur-sm hover:bg-[var(--surface)]"
          >
            <ChevronDown size={14} />
          </button>
        ) : null}
      </div>

      <form className="grid gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 sm:gap-2.5 sm:p-2.5" onSubmit={onSubmit}>
        <label htmlFor="chat-input" className="text-xs font-medium sm:text-sm">
          {editingMessageIndex !== null ? (
            <span>
              Editando mensaje anterior
              <span className="ml-2 text-xs font-normal text-muted">· Esc para cancelar</span>
            </span>
          ) : (
            "Mensaje"
          )}
        </label>
        {attachedFile ? (
          <FilePreviewStrip
            fileName={attachedFile.name}
            fileType={attachedFile.type}
            fileSizeLabel={attachedFile.sizeLabel}
            previewSrc={attachedFile.previewSrc}
            onRemove={() => { setAttachedFile(null); setAttachError(null); }}
          />
        ) : null}
        {attachError ? (
          <p className="text-xs text-[var(--error)]">{attachError}</p>
        ) : null}
        <div className="relative">
          <CommandAutocomplete
            items={visibleAutocompleteItems}
            activeIndex={autocompleteIndex}
            onSelect={applyAutocomplete}
            onHover={setAutocompleteIndex}
          />
          <textarea
            id="chat-input"
            ref={textareaRef}
            value={input}
            onChange={(event) => handleInputChange(event.target.value)}
            onKeyDown={handleInputKeyDown}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onPaste={handlePaste}
            rows={1}
            style={{ maxHeight: "9rem" }}
            className="neu-inset w-full resize-none overflow-y-auto border border-transparent px-2 py-1 text-[13px] outline-none sm:px-2.5 sm:py-1.5 sm:text-sm"
            placeholder="Escribí una tarea para el orquestador..."
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted sm:text-xs">
          <span>Entrada: {formatUsageValue(inputEstimatedTokens, true)} tokens (estimado)</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            {OPS_QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                disabled={isSending}
                onClick={() => setInput(action.prompt)}
                className="inline-flex items-center rounded-md border border-[var(--border)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)] disabled:opacity-40 sm:text-xs"
              >
                {action.label}
              </button>
            ))}
            <GatewayStatus activeTool={activeTool} onRetryConnection={handleRetryConnection} />
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileInputChange}
              disabled={isSending}
            />
            <Tooltip content="Adjuntar archivo (.py, .ts, .json, imágenes…)" placement="top" delay={450}>
              <button
                type="button"
                onClick={() => { setAttachError(null); fileInputRef.current?.click(); }}
                disabled={isSending}
                aria-label="Adjuntar archivo"
                className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-[var(--text)] hover:bg-[var(--surface)] disabled:opacity-40 sm:px-3 sm:py-1.5"
              >
                <Paperclip size={16} />
              </button>
            </Tooltip>
            {isSending ? (
              <button type="button" onClick={handleStopStreaming} className="styled-button" aria-label="Detener">
                Detener
              </button>
            ) : null}
            <button type="submit" disabled={isSending} className="styled-button send-button">
              <span className="send-button-label">{isSending ? "Enviando..." : "Enviar"}</span>
              <div className="inner-button" aria-hidden="true">
                <svg id="Arrow" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" height="24" width="24" className="icon">
                  <defs>
                    <linearGradient y2="100%" x2="100%" y1="0%" x1="0%" id="iconGradient">
                      <stop style={{ stopColor: "#FFFFFF", stopOpacity: 1 }} offset="0%" />
                      <stop style={{ stopColor: "#AAAAAA", stopOpacity: 1 }} offset="100%" />
                    </linearGradient>
                  </defs>
                  <path
                    fill="url(#iconGradient)"
                    d="M4 15a1 1 0 0 0 1 1h19.586l-4.292 4.292a1 1 0 0 0 1.414 1.414l6-6a.99.99 0 0 0 .292-.702V15c0-.13-.026-.26-.078-.382a.99.99 0 0 0-.216-.324l-6-6a1 1 0 0 0-1.414 1.414L24.586 14H5a1 1 0 0 0-1 1z"
                  />
                </svg>
              </div>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

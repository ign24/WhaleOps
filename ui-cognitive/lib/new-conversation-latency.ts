export const NEW_CONVERSATION_LATENCY_EVENT = "cgn:new-conversation-latency";
const NEW_CONVERSATION_PENDING_KEY = "cgn.newConversation.pending";

type Milestone = "create_click" | "feedback_visible" | "route_ready" | "history_ready";

type PendingAttempt = {
  attemptId: string;
  sessionKey: string;
  emitted: Milestone[];
  source: "sidebar" | "slash_new";
};

const safeWindow = () => (typeof window === "undefined" ? null : window);

const readPendingAttempt = (): PendingAttempt | null => {
  const win = safeWindow();
  if (!win) {
    return null;
  }

  const raw = win.sessionStorage.getItem(NEW_CONVERSATION_PENDING_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PendingAttempt>;
    if (
      typeof parsed.attemptId !== "string"
      || typeof parsed.sessionKey !== "string"
      || !Array.isArray(parsed.emitted)
    ) {
      return null;
    }

    return {
      attemptId: parsed.attemptId,
      sessionKey: parsed.sessionKey,
      emitted: parsed.emitted.filter(
        (item): item is Milestone =>
          item === "create_click" || item === "feedback_visible" || item === "route_ready" || item === "history_ready",
      ),
      source: parsed.source === "slash_new" ? "slash_new" : "sidebar",
    };
  } catch {
    return null;
  }
};

const writePendingAttempt = (attempt: PendingAttempt | null) => {
  const win = safeWindow();
  if (!win) {
    return;
  }

  if (!attempt) {
    win.sessionStorage.removeItem(NEW_CONVERSATION_PENDING_KEY);
    return;
  }

  win.sessionStorage.setItem(NEW_CONVERSATION_PENDING_KEY, JSON.stringify(attempt));
};

const emitMilestone = (attempt: PendingAttempt, milestone: Milestone) => {
  const win = safeWindow();
  if (!win) {
    return;
  }

  win.dispatchEvent(
    new CustomEvent(NEW_CONVERSATION_LATENCY_EVENT, {
      detail: {
        attemptId: attempt.attemptId,
        sessionKey: attempt.sessionKey,
        milestone,
        source: attempt.source,
        timestamp: Date.now(),
      },
    }),
  );
};

const tryEmit = (attempt: PendingAttempt, milestone: Milestone): PendingAttempt => {
  if (attempt.emitted.includes(milestone)) {
    return attempt;
  }

  const next: PendingAttempt = {
    ...attempt,
    emitted: [...attempt.emitted, milestone],
  };
  emitMilestone(next, milestone);
  return next;
};

export const beginNewConversationAttempt = (sessionKey: string, source: "sidebar" | "slash_new") => {
  const win = safeWindow();
  if (!win) {
    return;
  }

  const attemptId =
    typeof win.crypto !== "undefined" && typeof win.crypto.randomUUID === "function"
      ? win.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let attempt: PendingAttempt = {
    attemptId,
    sessionKey,
    emitted: [],
    source,
  };

  attempt = tryEmit(attempt, "create_click");
  writePendingAttempt(attempt);
};

export const markNewConversationFeedbackVisible = (sessionKey: string) => {
  const attempt = readPendingAttempt();
  if (!attempt || attempt.sessionKey !== sessionKey) {
    return;
  }

  writePendingAttempt(tryEmit(attempt, "feedback_visible"));
};

export const markNewConversationRouteReady = (sessionKey: string, isBootstrapNew: boolean) => {
  const attempt = readPendingAttempt();
  if (!attempt || attempt.sessionKey !== sessionKey) {
    return;
  }

  const next = tryEmit(attempt, "route_ready");
  if (isBootstrapNew) {
    writePendingAttempt(null);
    return;
  }

  writePendingAttempt(next);
};

export const markNewConversationHistoryReady = (sessionKey: string) => {
  const attempt = readPendingAttempt();
  if (!attempt || attempt.sessionKey !== sessionKey) {
    return;
  }

  tryEmit(attempt, "history_ready");
  writePendingAttempt(null);
};

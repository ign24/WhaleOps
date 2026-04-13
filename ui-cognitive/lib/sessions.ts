import { promises as fs } from "fs";
import path from "path";

import { SessionRow } from "@/lib/session-normalizers";
import { ensureUiMessageShape } from "@/lib/message-utils";
import { SessionCreator, UiChatMessage } from "@/types/chat";

const sessionsDirPath = path.join(process.cwd(), "data", "sessions");
const DEFAULT_SESSION_TITLE = "Nueva conversacion";

const SYSTEM_CREATOR: SessionCreator = { id: "system", name: "Sistema" };

type StoredSession = {
  sessionKey: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: UiChatMessage[];
  createdBy?: SessionCreator;
};

export const resolveCreatedBy = (session: Pick<StoredSession, "createdBy">): SessionCreator =>
  session.createdBy ?? SYSTEM_CREATOR;

const sessionFilePath = (sessionKey: string) => {
  return path.join(sessionsDirPath, `${sessionKey}.json`);
};

const ensureSessionsDir = async () => {
  await fs.mkdir(sessionsDirPath, { recursive: true });
};

const isNotFoundError = (error: unknown) => {
  return !!error && typeof error === "object" && "code" in error && error.code === "ENOENT";
};

const normalizeMessages = (value: unknown): UiChatMessage[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const source = item as Record<string, unknown>;
      const role = source.role === "assistant" ? "assistant" : source.role === "user" ? "user" : null;
      const content = typeof source.content === "string" ? source.content : null;

      if (!role || !content) {
        return null;
      }

      return ensureUiMessageShape({
        id: typeof source.id === "string" ? source.id : undefined,
        timestamp: typeof source.timestamp === "string" ? source.timestamp : undefined,
        role,
        content,
        ...(source.isError === true ? { isError: true } : {}),
        ...(source.feedback && typeof source.feedback === "object"
          ? {
              feedback: {
                reaction: (source.feedback as { reaction?: unknown }).reaction === "down" ? "down" : "up",
                updatedAt:
                  typeof (source.feedback as { updatedAt?: unknown }).updatedAt === "string"
                    ? (source.feedback as { updatedAt: string }).updatedAt
                    : new Date().toISOString(),
                ...(typeof (source.feedback as { comment?: unknown }).comment === "string"
                  ? { comment: (source.feedback as { comment: string }).comment }
                  : {}),
              },
            }
          : {}),
        ...(Array.isArray(source.intermediateSteps) ? { intermediateSteps: source.intermediateSteps } : {}),
      });
    })
    .filter((item): item is UiChatMessage => item !== null);
};

const normalizeStoredSession = (sessionKey: string, payload: unknown): StoredSession => {
  const source = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const now = new Date().toISOString();

  const rawCreatedBy = source.createdBy;
  const createdBy =
    rawCreatedBy &&
    typeof rawCreatedBy === "object" &&
    typeof (rawCreatedBy as Record<string, unknown>).id === "string" &&
    typeof (rawCreatedBy as Record<string, unknown>).name === "string"
      ? (rawCreatedBy as SessionCreator)
      : undefined;

  return {
    sessionKey: typeof source.sessionKey === "string" ? source.sessionKey : sessionKey,
    title: typeof source.title === "string" && source.title.trim() ? source.title.trim() : DEFAULT_SESSION_TITLE,
    createdAt: typeof source.createdAt === "string" ? source.createdAt : now,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : now,
    messages: normalizeMessages(source.messages),
    ...(createdBy ? { createdBy } : {}),
  };
};

const readSession = async (sessionKey: string): Promise<StoredSession | null> => {
  await ensureSessionsDir();

  try {
    const fileContent = await fs.readFile(sessionFilePath(sessionKey), "utf8");
    return normalizeStoredSession(sessionKey, JSON.parse(fileContent));
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    if (error instanceof SyntaxError) {
      console.error(`[sessions] Corrupted JSON for session ${sessionKey}, skipping`);
      return null;
    }

    throw error;
  }
};

const writeSession = async (session: StoredSession) => {
  await ensureSessionsDir();
  await fs.writeFile(sessionFilePath(session.sessionKey), JSON.stringify(session, null, 2), "utf8");
};

export const listSessions = async (): Promise<SessionRow[]> => {
  await ensureSessionsDir();
  const entries = await fs.readdir(sessionsDirPath);

  const rows = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".json"))
      .map(async (entry) => {
        const sessionKey = entry.replace(/\.json$/, "");
        const session = await readSession(sessionKey);
        if (!session) {
          return null;
        }

        return {
          sessionKey: session.sessionKey,
          title: session.title,
          updatedAt: session.updatedAt,
          createdBy: resolveCreatedBy(session),
        } satisfies SessionRow;
      }),
  );

  return rows
    .filter((row): row is SessionRow => row !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

export const createSession = async (sessionKey: string, createdBy?: SessionCreator): Promise<SessionRow> => {
  const now = new Date().toISOString();
  const session: StoredSession = {
    sessionKey,
    title: DEFAULT_SESSION_TITLE,
    createdAt: now,
    updatedAt: now,
    messages: [],
    createdBy: createdBy ?? SYSTEM_CREATOR,
  };

  await writeSession(session);

  return {
    sessionKey,
    title: session.title,
    updatedAt: session.updatedAt,
    createdBy: session.createdBy!,
  };
};

export const getSessionOwnership = async (sessionKey: string): Promise<{ createdBy: SessionCreator } | null> => {
  const session = await readSession(sessionKey);
  if (!session) return null;
  return { createdBy: resolveCreatedBy(session) };
};

export const getSessionMessages = async (sessionKey: string): Promise<UiChatMessage[]> => {
  const session = await readSession(sessionKey);
  return session?.messages ?? [];
};

type SessionMessageInput = Pick<UiChatMessage, "role" | "content"> &
  Partial<Pick<UiChatMessage, "id" | "timestamp" | "isError" | "feedback" | "intermediateSteps">>;

export const appendSessionMessages = async (sessionKey: string, messages: SessionMessageInput[]) => {
  const session =
    (await readSession(sessionKey)) ?? {
      sessionKey,
      title: DEFAULT_SESSION_TITLE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };

  const now = new Date().toISOString();
  const normalizedNewMessages = messages.map((message) => ensureUiMessageShape(message));
  const nextMessages = [...session.messages, ...normalizedNewMessages];

  const firstUserMessage = normalizedNewMessages.find((message) => message.role === "user" && message.content.trim().length > 0);
  const nextTitle =
    session.title === DEFAULT_SESSION_TITLE && firstUserMessage
      ? firstUserMessage.content.trim().slice(0, 60)
      : session.title;

  await writeSession({
    ...session,
    title: nextTitle,
    updatedAt: now,
    messages: nextMessages,
  });
};

export const renameSession = async (sessionKey: string, title: string) => {
  const session = await readSession(sessionKey);
  if (!session) {
    return;
  }

  await writeSession({
    ...session,
    title: title.trim() || DEFAULT_SESSION_TITLE,
    updatedAt: new Date().toISOString(),
  });
};

export const deleteSession = async (sessionKey: string) => {
  await ensureSessionsDir();

  try {
    await fs.unlink(sessionFilePath(sessionKey));
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }
};

export const setSessionMessageFeedback = async (
  sessionKey: string,
  messageId: string,
  reaction: "up" | "down",
  comment?: string,
) => {
  const session = await readSession(sessionKey);
  if (!session) {
    return false;
  }

  let found = false;
  const updatedMessages = session.messages.map((message) => {
    if (message.id !== messageId || message.role !== "assistant") {
      return message;
    }

    found = true;
    return {
      ...message,
      feedback: {
        reaction,
        updatedAt: new Date().toISOString(),
        ...(comment && comment.trim().length > 0 ? { comment: comment.trim() } : {}),
      },
    };
  });

  if (!found) {
    return false;
  }

  await writeSession({
    ...session,
    updatedAt: new Date().toISOString(),
    messages: updatedMessages,
  });

  return true;
};

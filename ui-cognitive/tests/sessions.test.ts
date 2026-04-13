import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fs", () => {
  return {
    promises: {
      mkdir: vi.fn(),
      readdir: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      unlink: vi.fn(),
    },
  };
});

import { promises as fs } from "fs";

import {
  appendSessionMessages,
  createSession,
  deleteSession,
  getSessionMessages,
  listSessions,
  renameSession,
  setSessionMessageFeedback,
} from "@/lib/sessions";

const mkdirMock = vi.mocked(fs.mkdir);
const readdirMock = vi.mocked(fs.readdir);
const readFileMock = vi.mocked(fs.readFile);
const writeFileMock = vi.mocked(fs.writeFile);
const unlinkMock = vi.mocked(fs.unlink);

describe("sessions data store", () => {
  beforeEach(() => {
    mkdirMock.mockReset();
    readdirMock.mockReset();
    readFileMock.mockReset();
    writeFileMock.mockReset();
    unlinkMock.mockReset();

    mkdirMock.mockResolvedValue(undefined);
    readdirMock.mockResolvedValue([]);
    writeFileMock.mockResolvedValue(undefined);
    unlinkMock.mockResolvedValue(undefined);
  });

  it("lists sessions sorted by updatedAt descending", async () => {
    readdirMock.mockResolvedValue(["old.json", "new.json"] as never);
    readFileMock
      .mockResolvedValueOnce(
        JSON.stringify({
          sessionKey: "old",
          title: "Old",
          createdAt: "2026-03-09T20:00:00.000Z",
          updatedAt: "2026-03-09T20:01:00.000Z",
          messages: [],
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          sessionKey: "new",
          title: "New",
          createdAt: "2026-03-09T20:00:00.000Z",
          updatedAt: "2026-03-09T20:02:00.000Z",
          messages: [],
        }),
      );

    const sessions = await listSessions();

    expect(sessions).toEqual([
      {
        sessionKey: "new",
        title: "New",
        updatedAt: "2026-03-09T20:02:00.000Z",
        createdBy: { id: "system", name: "Sistema" },
      },
      {
        sessionKey: "old",
        title: "Old",
        updatedAt: "2026-03-09T20:01:00.000Z",
        createdBy: { id: "system", name: "Sistema" },
      },
    ]);
  });

  it("creates a new session file with default title", async () => {
    const nowSpy = vi
      .spyOn(Date.prototype, "toISOString")
      .mockReturnValue("2026-03-09T20:03:00.000Z");

    const created = await createSession("abc12345");

    expect(created).toEqual({
      sessionKey: "abc12345",
      title: "Nueva conversacion",
      updatedAt: "2026-03-09T20:03:00.000Z",
      createdBy: { id: "system", name: "Sistema" },
    });
    expect(writeFileMock).toHaveBeenCalledOnce();
    nowSpy.mockRestore();
  });

  it("returns messages from a stored session", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        sessionKey: "main",
        title: "Main",
        createdAt: "2026-03-09T20:00:00.000Z",
        updatedAt: "2026-03-09T20:03:00.000Z",
        messages: [
          {
            id: "u-1",
            role: "user",
            content: "hola",
            timestamp: "2026-03-09T20:02:00.000Z",
          },
          {
            id: "a-1",
            role: "assistant",
            content: "ok",
            timestamp: "2026-03-09T20:03:00.000Z",
          },
        ],
      }),
    );

    const messages = await getSessionMessages("main");

    expect(messages).toEqual([
      {
        id: "u-1",
        role: "user",
        content: "hola",
        timestamp: "2026-03-09T20:02:00.000Z",
      },
      {
        id: "a-1",
        role: "assistant",
        content: "ok",
        timestamp: "2026-03-09T20:03:00.000Z",
      },
    ]);
  });

  it("appends messages and sets title from first user message", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        sessionKey: "main",
        title: "Nueva conversacion",
        createdAt: "2026-03-09T20:00:00.000Z",
        updatedAt: "2026-03-09T20:00:00.000Z",
        messages: [],
      }),
    );

    const nowSpy = vi
      .spyOn(Date.prototype, "toISOString")
      .mockReturnValue("2026-03-09T20:05:00.000Z");

    await appendSessionMessages("main", [
      {
        id: "u-2",
        role: "user",
        content: "Quiero revisar este PR largo",
        timestamp: "2026-03-09T20:04:00.000Z",
      },
      {
        id: "a-2",
        role: "assistant",
        content: "Vamos",
        timestamp: "2026-03-09T20:05:00.000Z",
      },
    ]);

    expect(writeFileMock).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(writeFileMock.mock.calls[0]?.[1])) as {
      title: string;
      updatedAt: string;
      messages: Array<{ role: string; content: string }>;
    };

    expect(payload.title).toBe("Quiero revisar este PR largo");
    expect(payload.updatedAt).toBe("2026-03-09T20:05:00.000Z");
    expect(payload.messages).toHaveLength(2);
    expect(payload.messages[0]).toMatchObject({
      id: "u-2",
      timestamp: "2026-03-09T20:04:00.000Z",
    });

    nowSpy.mockRestore();
  });

  it("adds fallback id and timestamp for legacy appended messages", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        sessionKey: "main",
        title: "Main",
        createdAt: "2026-03-09T20:00:00.000Z",
        updatedAt: "2026-03-09T20:00:00.000Z",
        messages: [],
      }),
    );

    await appendSessionMessages("main", [
      { role: "user", content: "legacy user" },
      { role: "assistant", content: "legacy assistant" },
    ]);

    const payload = JSON.parse(String(writeFileMock.mock.calls[0]?.[1])) as {
      messages: Array<{ id?: string; timestamp?: string }>;
    };

    expect(payload.messages[0]?.id).toBeTruthy();
    expect(payload.messages[0]?.timestamp).toBeTruthy();
    expect(payload.messages[1]?.id).toBeTruthy();
    expect(payload.messages[1]?.timestamp).toBeTruthy();
  });

  it("renames and deletes sessions", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        sessionKey: "main",
        title: "Old",
        createdAt: "2026-03-09T20:00:00.000Z",
        updatedAt: "2026-03-09T20:00:00.000Z",
        messages: [],
      }),
    );

    await renameSession("main", "  Nuevo nombre  ");
    expect(writeFileMock).toHaveBeenCalledOnce();

    await deleteSession("main");
    expect(unlinkMock).toHaveBeenCalledOnce();
  });

  it("stores feedback for assistant messages by id", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        sessionKey: "main",
        title: "Main",
        createdAt: "2026-03-09T20:00:00.000Z",
        updatedAt: "2026-03-09T20:00:00.000Z",
        messages: [
          {
            id: "u-1",
            role: "user",
            content: "hola",
            timestamp: "2026-03-09T20:01:00.000Z",
          },
          {
            id: "a-1",
            role: "assistant",
            content: "ok",
            timestamp: "2026-03-09T20:02:00.000Z",
          },
        ],
      }),
    );

    const result = await setSessionMessageFeedback("main", "a-1", "up");
    expect(result).toBe(true);
    expect(writeFileMock).toHaveBeenCalledOnce();

    const payload = JSON.parse(String(writeFileMock.mock.calls[0]?.[1])) as {
      messages: Array<{ id: string; feedback?: { reaction: string } }>;
    };

    expect(payload.messages.find((m) => m.id === "a-1")?.feedback?.reaction).toBe("up");
  });

  it("restores intermediate steps from stored assistant messages", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        sessionKey: "main",
        title: "Main",
        createdAt: "2026-03-09T20:00:00.000Z",
        updatedAt: "2026-03-09T20:00:00.000Z",
        messages: [
          {
            id: "a-3",
            role: "assistant",
            content: "ok",
            timestamp: "2026-03-09T20:02:00.000Z",
            intermediateSteps: [
              {
                id: "entry-1",
                stepId: "step-1",
                label: "Planning",
                kind: "agent",
                status: "completed",
                startedAt: 1700000000000,
                completedAt: 1700000000100,
                detail: "Hecho",
              },
            ],
          },
        ],
      }),
    );

    const messages = await getSessionMessages("main");
    expect(messages[0]?.intermediateSteps?.[0]).toMatchObject({
      stepId: "step-1",
      detail: "Hecho",
    });
  });
});

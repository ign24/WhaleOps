// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatSessionLayout } from "@/components/chat/chat-session-layout";

vi.mock("@/components/chat/chat-panel", () => ({
  ChatPanel: (props: {
    activityLog?: Array<{ id: string }>;
    onActivityEvent?: (entries: unknown) => void;
    onOpenHistoricalActivity?: (messageId: string, entries: Array<{ id: string; label: string; kind: "agent"; status: "completed"; startedAt: number; completedAt: number }>) => void;
    onSendingChange?: (isSending: boolean) => void;
    onHistoryLoaded?: (entries: Array<{ id: string; label: string; kind: string; status: string; startedAt: number }>) => void;
  }) => (
    <div>
      <p>Chat view count: {props.activityLog?.length ?? 0}</p>
      <button
        type="button"
        onClick={() =>
          props.onActivityEvent?.((previous: Array<unknown>) => [
            ...previous,
            {
              id: "entry-live",
              label: "web_search",
              kind: "tool",
              status: "completed",
              startedAt: 1000,
              completedAt: 2000,
            },
          ])
        }
      >
        Emit activity event
      </button>
      <button
        type="button"
        onClick={() =>
          props.onOpenHistoricalActivity?.("m-1", [
            {
              id: "entry-history",
              label: "planning",
              kind: "agent",
              status: "completed",
              startedAt: 1000,
              completedAt: 2000,
            },
          ])
        }
      >
        Open historical
      </button>
      <button type="button" onClick={() => props.onSendingChange?.(true)}>
        Start live
      </button>
      <button
        type="button"
        onClick={() =>
          props.onHistoryLoaded?.([
            {
              id: "entry-ws",
              label: "shell_execute",
              kind: "tool",
              status: "completed",
              startedAt: 1000,
              toolNameNormalized: "shell_execute",
              commandSummary: "ls -la",
            },
          ])
        }
      >
        Load history
      </button>
    </div>
  ),
}));

describe("ChatSessionLayout", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    Object.defineProperty(window, "innerWidth", {
      value: 1280,
      writable: true,
      configurable: true,
    });
  });

  it("shares activity state between chat and activity panel", () => {
    render(<ChatSessionLayout sessionKey="main" />);

    expect(screen.getByText("Chat view count: 0")).toBeTruthy();
    fireEvent.click(screen.getByText("Emit activity event"));

    expect(screen.getByText("Chat view count: 1")).toBeTruthy();
    expect(screen.getByText("Búsqueda web")).toBeTruthy();
  });

  it("supports historical mode and back to live", () => {
    render(<ChatSessionLayout sessionKey="main" />);

    fireEvent.click(screen.getByText("Open historical"));
    expect(screen.getByText("Planificando")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Volver a vivo" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Volver a vivo" }));
    expect(screen.queryByText("Planificando")).toBeNull();
  });

  it("renders desktop activity panel", () => {
    render(<ChatSessionLayout sessionKey="main" />);

    expect(screen.getByText("Panel de actividad")).toBeTruthy();
    expect(
      screen.queryByRole("separator", { name: "Redimensionar panel de actividad" }),
    ).toBeNull();
  });

  it("has no keyboard resizing handle", () => {
    render(<ChatSessionLayout sessionKey="main" />);

    expect(
      screen.queryByRole("separator", { name: "Redimensionar panel de actividad" }),
    ).toBeNull();
  });

  it("pre-populates workspace log when onHistoryLoaded fires", () => {
    render(<ChatSessionLayout sessionKey="main" />);

    fireEvent.click(screen.getByText("Load history"));

    expect(screen.getByText("Espacio de trabajo")).toBeTruthy();
  });

  it("starts with activity panel closed on mobile", () => {
    Object.defineProperty(window, "innerWidth", {
      value: 390,
      writable: true,
      configurable: true,
    });

    render(<ChatSessionLayout sessionKey="main" />);

    expect(screen.queryByRole("button", { name: "Cerrar actividad" })).toBeNull();
  });
});

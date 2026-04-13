// @vitest-environment happy-dom
/**
 * Tests for chat-panel integration with workspace delete confirmation modal.
 * Tasks 5.1-5.4: detect awaiting_ui_confirmation, render modal, inject messages.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
}));

vi.mock("@/hooks/use-chat-scroll", () => ({
  useChatScroll: () => ({
    showScrollToBottom: false,
    messagesContainerRef: { current: null },
    messagesBottomRef: { current: null },
    scrollToBottom: vi.fn(),
    isNearBottom: vi.fn(() => true),
    handleMessagesScroll: vi.fn(),
  }),
}));

vi.mock("@/components/chat/message-markdown", () => ({
  MessageMarkdown: ({ content }: { content: string }) => <p data-chat-block="text">{content}</p>,
}));
vi.mock("@/components/chat/chat-loader", () => ({ ChatLoader: () => <p>Cargando...</p> }));
vi.mock("@/components/chat/chat-help-card", () => ({ ChatHelpCard: () => <p>Help</p> }));
vi.mock("@/components/chat/gateway-status", () => ({ GatewayStatus: () => <p>GW</p> }));

import { ChatPanel } from "@/components/chat/chat-panel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeToolEndStream(toolResultJson: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `event: activity\ndata: {"stream":"tool_start","timestamp":1000,"stepId":"del-1","toolName":"workspace_delete","toolArgs":{"location":"workspace","target":"django"}}\n\n`,
        ),
      );
      controller.enqueue(
        encoder.encode(
          `event: activity\ndata: {"stream":"tool_end","timestamp":2000,"stepId":"del-1","toolName":"workspace_delete","toolResult":${JSON.stringify(toolResultJson)}}\n\n`,
        ),
      );
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function mockFetchWithStream(toolResultJson: string) {
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    if (url.includes("/history")) {
      return Promise.resolve(
        new Response(JSON.stringify({ messages: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    if (url.includes("/workspace/delete/register-token")) {
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    }
    return Promise.resolve(makeToolEndStream(toolResultJson));
  });
}

const AWAITING_RESULT = JSON.stringify({
  status: "awaiting_ui_confirmation",
  confirmation_token: "test-token-abc",
  target_path: "/app/workspace/django",
  size_mb: 142,
  location: "workspace",
  target: "django",
  message: "Workspace delete requires PIN confirmation.",
  retryable: false,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChatPanel — workspace delete modal integration", () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  // Task 5.1: modal shown on awaiting_ui_confirmation
  it("renders DeleteConfirmModal when tool_end has awaiting_ui_confirmation status", async () => {
    mockFetchWithStream(AWAITING_RESULT);
    render(<ChatPanel sessionKey="main" />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "borrá django" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByTestId("delete-confirm-modal")).toBeTruthy();
    });
  });

  // Token bridge: register-token is called before modal renders
  it("calls /api/workspace/delete/register-token before showing modal", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (url.includes("/workspace/delete/register-token")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), { status: 200 }),
        );
      }
      return Promise.resolve(makeToolEndStream(AWAITING_RESULT));
    });
    render(<ChatPanel sessionKey="main" />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "borrá django" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByTestId("delete-confirm-modal")).toBeTruthy();
    });

    const registerCalls = fetchSpy.mock.calls.filter(([url]) =>
      typeof url === "string"
        ? url.includes("/workspace/delete/register-token")
        : (url as Request).url.includes("/workspace/delete/register-token"),
    );
    expect(registerCalls.length).toBeGreaterThanOrEqual(1);
  });

  // Task 5.2: PIN never appears in chat messages
  it("does not render PIN value in chat message list after confirm", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (url.includes("/workspace/delete/register-token")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), { status: 200 }),
        );
      }
      if (url.includes("/workspace/delete/confirm")) {
        return Promise.resolve(
          new Response(JSON.stringify({ status: "deleted", size_freed_mb: 142 }), { status: 200 }),
        );
      }
      return Promise.resolve(makeToolEndStream(AWAITING_RESULT));
    });
    render(<ChatPanel sessionKey="main" />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "borrá django" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => screen.getByTestId("pin-input"));
    await userEvent.type(screen.getByTestId("pin-input"), "supersecretpin");
    fireEvent.click(screen.getByTestId("confirm-btn"));

    await waitFor(() => {
      expect(screen.queryByText("supersecretpin")).toBeNull();
    });
  });

  // Task 5.3: success path appends "Workspace eliminado" message
  it("shows success message in chat after confirmed delete", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (url.includes("/workspace/delete/register-token")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), { status: 200 }),
        );
      }
      if (url.includes("/workspace/delete/confirm")) {
        return Promise.resolve(
          new Response(JSON.stringify({ status: "deleted", size_freed_mb: 142 }), { status: 200 }),
        );
      }
      return Promise.resolve(makeToolEndStream(AWAITING_RESULT));
    });
    render(<ChatPanel sessionKey="main" />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "borrá django" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => screen.getByTestId("pin-input"));
    await userEvent.type(screen.getByTestId("pin-input"), "correctpin");
    fireEvent.click(screen.getByTestId("confirm-btn"));

    await waitFor(() => {
      expect(screen.queryByText(/django/i)).toBeTruthy();
      expect(screen.queryByText(/142.*MB|MB.*142/i)).toBeTruthy();
    });
  });

  // Task 5.4: cancel path appends "Eliminación cancelada"
  it("shows cancel message in chat when user cancels", async () => {
    mockFetchWithStream(AWAITING_RESULT);
    render(<ChatPanel sessionKey="main" />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "borrá django" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => screen.getByTestId("cancel-btn"));
    fireEvent.click(screen.getByTestId("cancel-btn"));

    await waitFor(() => {
      expect(screen.queryByText(/cancelad/i)).toBeTruthy();
    });
  });
});

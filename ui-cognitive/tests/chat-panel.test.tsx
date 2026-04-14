// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const searchParamGetMock = vi.fn(() => null);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => ({
    get: searchParamGetMock,
  }),
}));

const scrollToBottomMock = vi.fn();
const isNearBottomMock = vi.fn(() => true);
const handleMessagesScrollMock = vi.fn();

vi.mock("@/hooks/use-chat-scroll", () => ({
  useChatScroll: () => ({
    showScrollToBottom: false,
    messagesContainerRef: { current: null },
    messagesBottomRef: { current: null },
    scrollToBottom: scrollToBottomMock,
    isNearBottom: isNearBottomMock,
    handleMessagesScroll: handleMessagesScrollMock,
  }),
}));

vi.mock("@/components/chat/message-markdown", () => ({
  MessageMarkdown: ({ content }: { content: string }) => <p data-chat-block="text">{content}</p>,
}));

vi.mock("@/components/chat/chat-loader", () => ({
  ChatLoader: () => <p>Cargando...</p>,
}));

vi.mock("@/components/chat/chat-help-card", () => ({
  ChatHelpCard: () => <p>Help Card</p>,
}));

vi.mock("@/components/chat/gateway-status", () => ({
  GatewayStatus: () => <p>Gateway</p>,
}));

import { ChatPanel } from "@/components/chat/chat-panel";
import { ActivityEntry } from "@/types/chat";

describe("ChatPanel", () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
    scrollToBottomMock.mockReset();
    isNearBottomMock.mockReset();
    isNearBottomMock.mockReturnValue(true);
    handleMessagesScrollMock.mockReset();
    searchParamGetMock.mockReset();
    searchParamGetMock.mockReturnValue(null);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("handles /help as local command", async () => {
    render(<ChatPanel sessionKey="main" />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "/help" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText("/help")).toBeTruthy();
      expect(screen.getByText(/Comandos locales disponibles:/)).toBeTruthy();
    });
  });

  it("handles /reset by clearing existing messages", async () => {
    render(<ChatPanel sessionKey="main" />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "/help" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText(/Comandos locales disponibles:/)).toBeTruthy();
    });

    fireEvent.change(input, { target: { value: "/reset" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.queryByText(/Comandos locales disponibles:/)).toBeNull();
    });
  });

  it("shows an error for unknown slash commands", async () => {
    render(<ChatPanel sessionKey="main" />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "/model" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText("/model")).toBeTruthy();
      expect(screen.getByText(/Comando desconocido/)).toBeTruthy();
    });
  });

  it("routes /analyze to agent as full analysis prompt", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (url.includes("/api/chat")) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              encoder.encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'),
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return Promise.resolve(
          new Response(stream, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ messages: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    render(<ChatPanel sessionKey="main" />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "/analyze https://github.com/acme/repo" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/chat",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("full analysis https://github.com/acme/repo"),
        }),
      );
    });

    expect(screen.queryByText(/Comando desconocido/)).toBeNull();
  });

  it("routes /quick-review to agent as quick review prompt", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (url.includes("/api/chat")) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              encoder.encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'),
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return Promise.resolve(
          new Response(stream, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ messages: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    render(<ChatPanel sessionKey="main" />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "/quick-review my-repo" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/chat",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("quick review my-repo"),
        }),
      );
    });

    expect(screen.queryByText(/Comando desconocido/)).toBeNull();
  });

  it("routes /refactor to agent with prefix intact", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (url.includes("/api/chat")) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              encoder.encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'),
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return Promise.resolve(
          new Response(stream, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ messages: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    render(<ChatPanel sessionKey="main" />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "/refactor Refactorizar alertas" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/chat",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("/refactor Refactorizar alertas"),
        }),
      );
    });

    expect(screen.queryByText(/Comando desconocido/)).toBeNull();
  });

  it("routes /execute to agent with prefix intact", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (url.includes("/api/chat")) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              encoder.encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'),
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return Promise.resolve(
          new Response(stream, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ messages: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    render(<ChatPanel sessionKey="main" />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "/execute commit and push" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/chat",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("/execute commit and push"),
        }),
      );
    });

    expect(screen.queryByText(/Comando desconocido/)).toBeNull();
  });

  it("shows a stop button while streaming and aborts the request", async () => {
    let requestSignal: AbortSignal | null = null;

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      requestSignal = init?.signal ?? null;
      return new Promise<Response>(() => {
        // keep pending to keep isSending=true
      });
    });

    render(<ChatPanel sessionKey="main" />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "/analyze repo" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Detener" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Detener" }));
    expect(requestSignal?.aborted).toBe(true);
  });

  it("keeps auto-scroll active while visual streaming drains after network completion", async () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const longChunk = Array.from({ length: 60 }, (_, index) => `w${index + 1}`).join(" ");
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(`data: {"choices":[{"delta":{"content":"${longChunk}"}}]}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    });

    render(<ChatPanel sessionKey="main" />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "hola" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Detener" })).toBeNull();
    });

    const beforeDrainScrollCalls = scrollToBottomMock.mock.calls.length;
    for (let step = 0; step < 80 && rafCallbacks.length > 0; step += 1) {
      const callback = rafCallbacks.shift();
      callback?.(step * 16);
    }

    expect(scrollToBottomMock.mock.calls.length).toBeGreaterThan(beforeDrainScrollCalls);
  });

  it("keeps forcing auto-scroll even when user is detached from bottom", async () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
    isNearBottomMock.mockReturnValue(false);

    const mediumChunk = Array.from({ length: 30 }, (_, index) => `m${index + 1}`).join(" ");
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(`data: {"choices":[{"delta":{"content":"${mediumChunk}"}}]}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    });

    render(<ChatPanel sessionKey="main" />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "hola" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    for (let step = 0; step < 40 && rafCallbacks.length > 0; step += 1) {
      const callback = rafCallbacks.shift();
      callback?.(step * 16);
    }

    expect(scrollToBottomMock).toHaveBeenCalled();
  });

  it("shows active agent indicators during visual streaming and hides them after completion", async () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const entries: ActivityEntry[] = [
      { id: "a1", label: "Planner", kind: "agent", status: "running", startedAt: 1 },
      { id: "a2", label: "Coder", kind: "agent", status: "pending", startedAt: 2 },
      { id: "t1", label: "bash", kind: "tool", status: "running", startedAt: 3 },
    ];

    const chunk = Array.from({ length: 45 }, (_, index) => `a${index + 1}`).join(" ");
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(`data: {"choices":[{"delta":{"content":"${chunk}"}}]}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    });

    const { rerender } = render(<ChatPanel sessionKey="main" activityLog={entries} />);

    await waitFor(() => {
      expect(screen.getByText("Help Card")).toBeTruthy();
    });

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "hola" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText("Planner")).toBeTruthy();
      expect(screen.getByText("Coder")).toBeTruthy();
    });

    rerender(<ChatPanel sessionKey="main" activityLog={[]} />);
    for (let step = 0; step < 80 && rafCallbacks.length > 0; step += 1) {
      const callback = rafCallbacks.shift();
      callback?.(step * 16);
    }

    await waitFor(() => {
      expect(screen.queryByText("Planner")).toBeNull();
      expect(screen.queryByText("Coder")).toBeNull();
    });
  });

  it("keeps buffered visual content after stop abort", async () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const chunk = Array.from({ length: 50 }, (_, index) => `s${index + 1}`).join(" ");
    let requestSignal: AbortSignal | null = null;

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      requestSignal = init?.signal ?? null;
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(`data: {"choices":[{"delta":{"content":"${chunk}"}}]}\n\n`));
          requestSignal?.addEventListener("abort", () => controller.close(), { once: true });
        },
      });

      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    });

    render(<ChatPanel sessionKey="main" />);

    await waitFor(() => {
      expect(screen.getByText("Help Card")).toBeTruthy();
    });

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "hola" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Detener" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Detener" }));
    expect(requestSignal?.aborted).toBe(true);

    expect(screen.queryByText("Respuesta detenida por el usuario.")).toBeNull();
  });

  it("shows a completion notice when agent response finishes", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"respuesta lista"}}]}\n\n'));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    });

    render(<ChatPanel sessionKey="main" />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "hola" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText("Agente finalizado")).toBeTruthy();
    });
  });

  it("deduplicates duplicated live activity events in a single stream", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      const encoder = new TextEncoder();
      const duplicatedActivityBlock =
        'event: activity\ndata: {"stream":"tool_start","timestamp":1700000000000,"stepId":"dup-1","toolName":"webfetch"}\n\n';
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(duplicatedActivityBlock));
          controller.enqueue(encoder.encode(duplicatedActivityBlock));
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    });

    let liveEntries: ActivityEntry[] = [];
    const onActivityEvent = (
      entriesOrUpdater: ActivityEntry[] | ((previous: ActivityEntry[]) => ActivityEntry[]),
    ) => {
      liveEntries =
        typeof entriesOrUpdater === "function" ? entriesOrUpdater(liveEntries) : entriesOrUpdater;
    };

    render(<ChatPanel sessionKey="main" onActivityEvent={onActivityEvent} />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "hola" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(liveEntries).toHaveLength(1);
    });

    expect(liveEntries[0]?.stepId).toBe("dup-1");
  });

  it("propagates metadata model into activity entries", async () => {
    window.localStorage.setItem(
      "openclaw:inference-prefs",
      JSON.stringify({ model: "deepseek_v3", temperaturePreset: "medium", thinking: false }),
    );

    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('event: metadata\ndata: {"model":"deepseek_v3"}\n\n'));
          controller.enqueue(
            encoder.encode(
              'event: activity\ndata: {"stream":"tool_start","timestamp":1700000000000,"stepId":"m-1","toolName":"read"}\n\n',
            ),
          );
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    });

    let liveEntries: ActivityEntry[] = [];
    const onActivityEvent = (
      entriesOrUpdater: ActivityEntry[] | ((previous: ActivityEntry[]) => ActivityEntry[]),
    ) => {
      liveEntries =
        typeof entriesOrUpdater === "function" ? entriesOrUpdater(liveEntries) : entriesOrUpdater;
    };

    render(<ChatPanel sessionKey="main" onActivityEvent={onActivityEvent} />);

    await waitFor(() => {
      expect(screen.getByText("DeepSeek V3")).toBeTruthy();
    });

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "hola" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(liveEntries).toHaveLength(1);
      expect(liveEntries[0]?.model).toBe("deepseek_v3");
    });
  });

  it("uses backend metadata model in activity entries when it differs from selected model", async () => {
    window.localStorage.setItem(
      "openclaw:inference-prefs",
      JSON.stringify({ model: "deepseek_v3", temperaturePreset: "medium", thinking: false }),
    );

    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('event: metadata\ndata: {"model":"devstral"}\n\n'));
          controller.enqueue(
            encoder.encode(
              'event: activity\ndata: {"stream":"tool_start","timestamp":1700000000000,"stepId":"m-2","toolName":"read"}\n\n',
            ),
          );
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    });

    let liveEntries: ActivityEntry[] = [];
    const onActivityEvent = (
      entriesOrUpdater: ActivityEntry[] | ((previous: ActivityEntry[]) => ActivityEntry[]),
    ) => {
      liveEntries =
        typeof entriesOrUpdater === "function" ? entriesOrUpdater(liveEntries) : entriesOrUpdater;
    };

    render(<ChatPanel sessionKey="main" onActivityEvent={onActivityEvent} />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "hola" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(liveEntries).toHaveLength(1);
      expect(liveEntries[0]?.model).toBe("devstral");
    });
  });

  it("marks completion when activity stream uses complete-style names", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'event: activity\ndata: {"stream":"tool_start","timestamp":1700000000000,"stepId":"c-1","toolName":"webfetch"}\n\n',
            ),
          );
          controller.enqueue(
            encoder.encode(
              'event: activity\ndata: {"stream":"function_complete","timestamp":1700000000500,"stepId":"c-1","toolName":"webfetch"}\n\n',
            ),
          );
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    });

    let liveEntries: ActivityEntry[] = [];
    const onActivityEvent = (
      entriesOrUpdater: ActivityEntry[] | ((previous: ActivityEntry[]) => ActivityEntry[]),
    ) => {
      liveEntries =
        typeof entriesOrUpdater === "function" ? entriesOrUpdater(liveEntries) : entriesOrUpdater;
    };

    render(<ChatPanel sessionKey="main" onActivityEvent={onActivityEvent} />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "hola" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(liveEntries).toHaveLength(1);
      expect(liveEntries[0]?.status).toBe("completed");
      expect(liveEntries[0]?.completedAt).toBe(1700000000500);
    });
  });

  it("merges tool_start and tool_end with namespace-prefixed labels into one entry", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          // tool_start has namespace prefix; tool_end does not — no stepId so merge must use label
          controller.enqueue(
            encoder.encode(
              'event: activity\ndata: {"stream":"tool_start","timestamp":1700000000000,"toolName":"fs_tools__write_file","toolArgs":{"path":"/workspace/agent.py"}}\n\n',
            ),
          );
          controller.enqueue(
            encoder.encode(
              'event: activity\ndata: {"stream":"tool_end","timestamp":1700000000500,"toolName":"write_file","toolResult":"ok"}\n\n',
            ),
          );
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"done"}}]}\n\n'));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    });

    let liveEntries: ActivityEntry[] = [];
    const onActivityEvent = (
      entriesOrUpdater: ActivityEntry[] | ((previous: ActivityEntry[]) => ActivityEntry[]),
    ) => {
      liveEntries =
        typeof entriesOrUpdater === "function" ? entriesOrUpdater(liveEntries) : entriesOrUpdater;
    };

    render(<ChatPanel sessionKey="main" onActivityEvent={onActivityEvent} />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "hola" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(liveEntries).toHaveLength(1);
      expect(liveEntries[0]?.status).toBe("completed");
    });
  });

  it("propagates toolContext (commandSummary, sandboxPath) from tool_start before tool_end arrives", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'event: activity\ndata: {"stream":"tool_start","timestamp":1700000000000,"stepId":"ctx-1","toolName":"shell_execute","toolArgs":{"command":"git status"}}\n\n',
            ),
          );
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    });

    let liveEntries: ActivityEntry[] = [];
    const onActivityEvent = (
      entriesOrUpdater: ActivityEntry[] | ((previous: ActivityEntry[]) => ActivityEntry[]),
    ) => {
      liveEntries =
        typeof entriesOrUpdater === "function" ? entriesOrUpdater(liveEntries) : entriesOrUpdater;
    };

    render(<ChatPanel sessionKey="main" onActivityEvent={onActivityEvent} />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "hola" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(liveEntries).toHaveLength(1);
      expect(liveEntries[0]?.commandSummary).toBe("git status");
    });
  });

  it("propagates sandboxPath from tool_start toolArgs.path", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'event: activity\ndata: {"stream":"tool_start","timestamp":1700000000000,"stepId":"path-1","toolName":"read_file","toolArgs":{"path":"/workspace/agent.py"}}\n\n',
            ),
          );
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    });

    let liveEntries: ActivityEntry[] = [];
    const onActivityEvent = (
      entriesOrUpdater: ActivityEntry[] | ((previous: ActivityEntry[]) => ActivityEntry[]),
    ) => {
      liveEntries =
        typeof entriesOrUpdater === "function" ? entriesOrUpdater(liveEntries) : entriesOrUpdater;
    };

    render(<ChatPanel sessionKey="main" onActivityEvent={onActivityEvent} />);

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "hola" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(liveEntries).toHaveLength(1);
      expect(liveEntries[0]?.sandboxPath).toBe("/workspace/agent.py");
    });
  });

  it("applies progressive enhancement after initial paint without hiding content", async () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [{ id: "a-1", role: "assistant", content: "bloque visible" }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ messages: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    render(<ChatPanel sessionKey="main" />);

    await waitFor(() => {
      expect(screen.getByText("bloque visible")).toBeTruthy();
    });

    const bubble = screen.getByText("bloque visible").closest(".message-bubble");
    expect(bubble?.getAttribute("data-chat-enhancement")).not.toBe("active");

    let guard = 0;
    while (rafCallbacks.length > 0 && guard < 20) {
      const callback = rafCallbacks.shift();
      callback?.(performance.now());
      guard += 1;
    }

    await waitFor(() => {
      expect(screen.getByText("bloque visible").closest(".message-bubble")?.getAttribute("data-chat-enhancement")).toBe(
        "active",
      );
    });
  });

  it("sends thumbs feedback for assistant messages", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              messages: [{ id: "a-1", role: "assistant", content: "respuesta" }],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      if (url.includes("/feedback")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ messages: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    render(<ChatPanel sessionKey="main" />);

    await waitFor(() => {
      expect(screen.getByText("respuesta")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Me gustó esta respuesta" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/sessions/main/feedback",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ messageId: "a-1", reaction: "up" }),
        }),
      );
    });
  });

  it("shows a friendly gateway message on HTTP 502", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: "Bad Gateway" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    render(<ChatPanel sessionKey="main" />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/sessions/main/history",
        expect.objectContaining({ method: "GET" }),
      );
    });

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "hola" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
    });

    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });

  it("retries failed assistant error message", async () => {
    let chatCalls = 0;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (url.includes("/api/chat")) {
        chatCalls += 1;
        if (chatCalls === 1) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: "Bad Gateway" }), {
              status: 502,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"ok retry"}}]}\n\n'));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });

        return Promise.resolve(
          new Response(stream, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          }),
        );
      }

      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    render(<ChatPanel sessionKey="main" />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/sessions/main/history",
        expect.objectContaining({ method: "GET" }),
      );
    });

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "hola" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(chatCalls).toBe(1);
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(screen.getByText("ok retry")).toBeTruthy();
    });

    expect(chatCalls).toBe(2);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("replaces leaked [TOOL_CALLS] payloads with friendly sanitizer message", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"[TOOL_CALLS]reader_agent{\\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"List files\\"}]}"}}]}\n\n',
            ),
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    });

    render(<ChatPanel sessionKey="main" />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/sessions/main/history",
        expect.objectContaining({ method: "GET" }),
      );
    });

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "auditoria" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(
        screen.getByText(
          "The agent encountered an internal error while processing the response. Please try again or narrow the scope of your request.",
        ),
      ).toBeTruthy();
    });

    expect(screen.queryByText(/\[TOOL_CALLS\]reader_agent/)).toBeNull();
  });

  it("normalizes NAT stream errors into a readable assistant error", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"[NAT] upstream failed"}}]}\n\n',
            ),
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    });

    render(<ChatPanel sessionKey="main" />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/sessions/main/history",
        expect.objectContaining({ method: "GET" }),
      );
    });

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "hola" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(
        screen.getByText(/El agente devolvio un error durante el procesamiento/),
      ).toBeTruthy();
    });
  });

  it("reconciles estimated token counters to real usage when usage event arrives", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"hola"}}]}\n\n'));
          controller.enqueue(
            encoder.encode(
              'event: usage\ndata: {"promptTokens":120,"completionTokens":45,"totalTokens":165,"isEstimated":false}\n\n',
            ),
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    });

    render(<ChatPanel sessionKey="main" />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/sessions/main/history",
        expect.objectContaining({ method: "GET" }),
      );
    });

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "hola" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText("hola")).toBeTruthy();
    });
  });

  it("keeps token counters as estimated when usage event is absent", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input.url;

      if (url.includes("/history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"hola"}}]}\n\n'));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    });

    render(<ChatPanel sessionKey="main" />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/sessions/main/history",
        expect.objectContaining({ method: "GET" }),
      );
    });

    const input = screen.getByLabelText("Mensaje");
    fireEvent.change(input, { target: { value: "hola" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText("hola")).toBeTruthy();
    });
  });

  it("restores persisted agentMode from localStorage after mount", async () => {
    window.localStorage.setItem("openclaw:agent-mode", "refactor");

    render(<ChatPanel sessionKey="main" />);

    await waitFor(() => {
      const modeButton = screen.getByTitle("Tab para cambiar modo");
      expect(modeButton.textContent).toContain("Refactor");
    });
  });

  it("defaults to Analyze when localStorage has no persisted mode", () => {
    window.localStorage.removeItem("openclaw:agent-mode");

    render(<ChatPanel sessionKey="main" />);

    const modeButton = screen.getByTitle("Tab para cambiar modo");
    expect(modeButton.textContent).toContain("Analyze");
  });

  it("skips blocking history loader when bootstrap=new", async () => {
    searchParamGetMock.mockImplementation((key: string) => (key === "bootstrap" ? "new" : null));
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<ChatPanel sessionKey="new-session" />);

    expect(screen.queryByText("Cargando...")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalledWith(
      "/api/sessions/new-session/history",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("emits route_ready milestone on bootstrap=new mount", async () => {
    searchParamGetMock.mockImplementation((key: string) => (key === "bootstrap" ? "new" : null));
    window.sessionStorage.setItem(
      "cgn.newConversation.pending",
      JSON.stringify({ sessionKey: "new-session", attemptId: "a1", emitted: ["create_click", "feedback_visible"] }),
    );

    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    render(<ChatPanel sessionKey="new-session" />);

    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "cgn:new-conversation-latency" }),
      );
    });
  });

  it("calls onHistoryLoaded with normalized intermediate steps when history loads", async () => {
    const onHistoryLoaded = vi.fn();

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          messages: [
            {
              role: "user",
              content: "hello",
            },
            {
              role: "assistant",
              content: "world",
              intermediateSteps: [
                {
                  id: "step-1",
                  label: "web_search",
                  kind: "tool",
                  status: "completed",
                  startedAt: 1000,
                  completedAt: 2000,
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(<ChatPanel sessionKey="main" onHistoryLoaded={onHistoryLoaded} />);

    await waitFor(() => {
      expect(onHistoryLoaded).toHaveBeenCalledOnce();
      const entries = onHistoryLoaded.mock.calls[0][0] as ActivityEntry[];
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ id: "step-1", label: "web_search", kind: "tool", status: "completed" });
    });
  });

  it("does not call onHistoryLoaded when history has no intermediate steps", async () => {
    const onHistoryLoaded = vi.fn();

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          messages: [
            { role: "user", content: "hello" },
            { role: "assistant", content: "world" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(<ChatPanel sessionKey="main" onHistoryLoaded={onHistoryLoaded} />);

    await waitFor(() => {
      expect(screen.queryByText("world")).toBeTruthy();
    });

    expect(onHistoryLoaded).not.toHaveBeenCalled();
  });
});

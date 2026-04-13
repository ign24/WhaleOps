/**
 * Tests for tool_start / tool_end intermediate_data events — §7
 *
 * 7.1 RED: streamChatViaHttp fires onAgentActivity with tool_start then tool_end
 *          when the SSE stream includes intermediate_data: lines in that shape
 * 7.2 GREEN: confirm toActivityEvent already handles TOOL_START/TOOL_END shapes
 *            from the NAT intermediate_steps_subscriber serialisation with no
 *            extra changes needed in sse-parser.ts / nat-client.ts
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { streamChatViaHttp } from "@/lib/nat-client";
import type { AgentActivityEvent } from "@/types/chat";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the JSON body that NAT's intermediate_steps_subscriber emits for a
 *  TOOL_START IntermediateStep (serialised via ResponseIntermediateStep). */
const buildToolStartPayload = (toolName: string, uuid: string) =>
  JSON.stringify({
    id: uuid,
    type: "TOOL_START",
    name: toolName,
    parent_id: null,
    payload: JSON.stringify({
      event_type: "TOOL_START",
      name: toolName,
      data: { input: { path: "/x" }, output: null },
    }),
  });

/** Build the JSON body for a TOOL_END IntermediateStep. */
const buildToolEndPayload = (toolName: string, uuid: string) =>
  JSON.stringify({
    id: uuid,
    type: "TOOL_END",
    name: toolName,
    parent_id: null,
    payload: JSON.stringify({
      event_type: "TOOL_END",
      name: toolName,
      data: { input: null, output: "file contents" },
    }),
  });

/** Build a ReadableStream that emits the given lines then closes. */
const makeStream = (lines: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line));
      }
      controller.close();
    },
  });
};

const BASE_INPUT = {
  backendUrl: "",
  messages: [{ role: "user" as const, content: "test" }],
  conversationId: undefined,
  timeoutMs: 5000,
  model: undefined,
  temperaturePreset: undefined,
  onToken: () => {},
  onMetadata: undefined,
  onUsage: undefined,
};

// ---------------------------------------------------------------------------
// 7.1 RED — streamChatViaHttp fires tool_start then tool_end via intermediate_data
// ---------------------------------------------------------------------------
describe("nat-client — tool lifecycle events from intermediate_data (7.1)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fires onAgentActivity with stream=tool_start then stream=tool_end", async () => {
    const uuid = "aaaaaaaa-0000-0000-0000-000000000001";
    const toolName = "fs_tools_read_file";

    const stream = makeStream([
      `data: {"choices":[{"delta":{"content":"ok"}}]}\n\n`,
      `intermediate_data: ${buildToolStartPayload(toolName, uuid)}\n\n`,
      `intermediate_data: ${buildToolEndPayload(toolName, uuid)}\n\n`,
      "data: [DONE]\n\n",
    ]);

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const captured: AgentActivityEvent[] = [];
    await streamChatViaHttp({
      ...BASE_INPUT,
      backendUrl: "http://localhost",
      onAgentActivity: (ev) => captured.push(ev),
    });

    const toolEvents = captured.filter((e) => e.stream === "tool_start" || e.stream === "tool_end");
    expect(toolEvents).toHaveLength(2);

    const [start, end] = toolEvents;
    expect(start.stream).toBe("tool_start");
    expect(start.name).toBe(toolName);
    expect(end.stream).toBe("tool_end");
    expect(end.name).toBe(toolName);
  });

  it("intermediate_data events are delivered in order before [DONE]", async () => {
    const uuid = "bbbbbbbb-0000-0000-0000-000000000002";
    const stream = makeStream([
      `intermediate_data: ${buildToolStartPayload("search", uuid)}\n\n`,
      `intermediate_data: ${buildToolEndPayload("search", uuid)}\n\n`,
      "data: [DONE]\n\n",
    ]);

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const order: string[] = [];
    await streamChatViaHttp({
      ...BASE_INPUT,
      backendUrl: "http://localhost",
      onAgentActivity: (ev) => order.push(ev.stream),
    });

    expect(order).toEqual(["tool_start", "tool_end"]);
  });
});

// ---------------------------------------------------------------------------
// 7.2 GREEN — toActivityEvent shape contract (no code changes needed)
// ---------------------------------------------------------------------------
describe("nat-client — toActivityEvent handles TOOL_START / TOOL_END shapes (7.2)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("TOOL_START type string maps to stream=tool_start", async () => {
    const payload = JSON.stringify({
      id: "cc-1",
      type: "TOOL_START",
      name: "bash_execute",
      parent_id: null,
      payload: "{}",
    });

    const stream = makeStream([
      `intermediate_data: ${payload}\n\n`,
      "data: [DONE]\n\n",
    ]);

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const captured: AgentActivityEvent[] = [];
    await streamChatViaHttp({
      ...BASE_INPUT,
      backendUrl: "http://localhost",
      onAgentActivity: (ev) => captured.push(ev),
    });

    expect(captured[0]?.stream).toBe("tool_start");
    expect(captured[0]?.name).toBe("bash_execute");
  });

  it("TOOL_END type string maps to stream=tool_end", async () => {
    const payload = JSON.stringify({
      id: "cc-2",
      type: "TOOL_END",
      name: "bash_execute",
      parent_id: null,
      payload: "{}",
    });

    const stream = makeStream([
      `intermediate_data: ${payload}\n\n`,
      "data: [DONE]\n\n",
    ]);

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const captured: AgentActivityEvent[] = [];
    await streamChatViaHttp({
      ...BASE_INPUT,
      backendUrl: "http://localhost",
      onAgentActivity: (ev) => captured.push(ev),
    });

    expect(captured[0]?.stream).toBe("tool_end");
    expect(captured[0]?.name).toBe("bash_execute");
  });
});

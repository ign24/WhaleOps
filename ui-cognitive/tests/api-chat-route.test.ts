import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/nat-client", () => ({ streamChatViaHttp: vi.fn() }));
vi.mock("@/lib/sessions", () => ({ appendSessionMessages: vi.fn() }));

import { auth } from "@/auth";
import { streamChatViaHttp } from "@/lib/nat-client";
import { appendSessionMessages } from "@/lib/sessions";
import { resetCostGovernanceStores } from "@/lib/cost-governance";
import { POST } from "@/app/api/chat/route";

const authMock = vi.mocked(auth);
const streamChatViaHttpMock = vi.mocked(streamChatViaHttp);
const appendSessionMessagesMock = vi.mocked(appendSessionMessages);

describe("POST /api/chat", () => {
  beforeEach(() => {
    authMock.mockReset();
    streamChatViaHttpMock.mockReset();
    appendSessionMessagesMock.mockReset();
    resetCostGovernanceStores();
    delete process.env.NAT_BACKEND_URL;
    delete process.env.NAT_CHAT_TIMEOUT_MS;
    delete process.env.MODEL_COST_GUARDRAILS_ENABLED;
    delete process.env.MODEL_COST_SOFT_LIMIT_ENABLED;
    delete process.env.MODEL_COST_HARD_LIMIT_ENABLED;
    delete process.env.MODEL_COST_SOFT_LIMIT_USD;
    delete process.env.MODEL_COST_HARD_LIMIT_USD;
    delete process.env.MODEL_COST_HARD_ACTION;
    delete process.env.MODEL_COST_FALLBACK_MODEL_KEY;
    delete process.env.MODEL_POLICY_ENV;
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null as never);

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hola" }] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 400 on malformed JSON body", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON in request body" });
  });

  it("returns 400 when messages are missing", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "messages are required" });
  });

  it("streams SSE tokens and metadata when NAT streaming succeeds", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    process.env.NAT_BACKEND_URL = "http://nat.test";
    process.env.NAT_CHAT_TIMEOUT_MS = "5000";

    streamChatViaHttpMock.mockImplementation(async (params) => {
      params.onMetadata?.({ model: "nemotron", provider: "nvidia" });
      params.onAgentActivity?.({ stream: "tool_start", timestamp: 1700000000000, toolName: "webfetch" });
      params.onUsage?.({
        promptTokens: 120,
        completionTokens: 45,
        totalTokens: 165,
        isEstimated: false,
      });
      params.onToken("hola");
    });

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionKey: "main",
        messages: [{ role: "user", content: "hola" }],
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const streamBody = await response.text();
    expect(streamBody).toContain('event: metadata\ndata: {"model":"nemotron","provider":"nvidia"}');
    expect(streamBody).toContain('event: activity\ndata: {"stream":"tool_start","timestamp":1700000000000,"toolName":"webfetch"');
    expect(streamBody).toContain('event: usage\ndata: {"promptTokens":120,"completionTokens":45,"totalTokens":165,"isEstimated":false');
    expect(streamBody).toContain('"dedupeKey":"');
    expect(streamBody).toContain('data: {"choices":[{"delta":{"content":"hola"}}]}');
    expect(streamBody).toContain("data: [DONE]");

    expect(streamChatViaHttpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        backendUrl: "http://nat.test",
        conversationId: "main",
        timeoutMs: 5000,
      }),
    );
    expect(appendSessionMessagesMock).toHaveBeenCalledWith("main", [
      { role: "user", content: "hola" },
      {
        role: "assistant",
        content: "hola",
        intermediateSteps: expect.arrayContaining([
          expect.objectContaining({
            stream: "tool_start",
            toolName: "webfetch",
          }),
        ]),
      },
    ]);
  });

  it("streams structured error event and DONE when NAT streaming fails", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);

    streamChatViaHttpMock.mockRejectedValue(new Error("upstream failed"));

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionKey: "main",
        messages: [{ role: "user", content: "hola" }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const streamBody = await response.text();
    expect(streamBody).toContain('event: error\ndata: {"message":"upstream failed"}');
    expect(streamBody).toContain("data: [DONE]");
    expect(appendSessionMessagesMock).toHaveBeenCalledWith(
      "main",
      expect.arrayContaining([
        { role: "user", content: "hola" },
        expect.objectContaining({ role: "assistant", content: expect.stringContaining("[NAT] upstream failed") }),
      ]),
    );
  });

  it("streams usage event with isEstimated=true for fallback token counts", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);

    streamChatViaHttpMock.mockImplementation(async (params) => {
      params.onUsage?.({
        promptTokens: 80,
        completionTokens: 20,
        totalTokens: 100,
        isEstimated: true,
      });
      params.onToken("ok");
    });

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionKey: "main",
        messages: [{ role: "user", content: "hola" }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const streamBody = await response.text();
    expect(streamBody).toContain('event: usage\ndata: {"promptTokens":80,"completionTokens":20,"totalTokens":100,"isEstimated":true');
    expect(streamBody).toContain("data: [DONE]");
  });

  it("deduplicates repeated activity events while preserving distinct ones", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);

    streamChatViaHttpMock.mockImplementation(async (params) => {
      params.onAgentActivity?.({
        stream: "tool_start",
        timestamp: 1_700_000_000_000,
        stepId: "step-1",
        toolName: "webfetch",
      });
      params.onAgentActivity?.({
        stream: "tool_start",
        timestamp: 1_700_000_000_000,
        stepId: "step-1",
        toolName: "webfetch",
      });
      params.onAgentActivity?.({
        stream: "tool_end",
        timestamp: 1_700_000_001_000,
        stepId: "step-1",
        toolName: "webfetch",
        status: "completed",
      });
      params.onToken("ok");
    });

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionKey: "main",
        messages: [{ role: "user", content: "hola" }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const streamBody = await response.text();
    const startOccurrences = streamBody.split('"stream":"tool_start"').length - 1;
    const endOccurrences = streamBody.split('"stream":"tool_end"').length - 1;

    expect(startOccurrences).toBe(1);
    expect(endOccurrences).toBe(1);
    expect(appendSessionMessagesMock).toHaveBeenCalledWith("main", [
      { role: "user", content: "hola" },
      {
        role: "assistant",
        content: "ok",
        intermediateSteps: expect.arrayContaining([
          expect.objectContaining({ stream: "tool_start", stepId: "step-1", dedupeKey: expect.any(String) }),
          expect.objectContaining({ stream: "tool_end", stepId: "step-1", dedupeKey: expect.any(String) }),
        ]),
      },
    ]);
  });

  it("sanitizes leaked tool-control markers before persisting assistant content", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);

    streamChatViaHttpMock.mockImplementation(async (params) => {
      params.onToken('[TOOL_CALLS]reader_agent{"messages":[{"role":"user","content":"List files"}]}');
    });

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionKey: "main",
        messages: [{ role: "user", content: "hola" }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    await response.text();

    expect(appendSessionMessagesMock).toHaveBeenCalledWith("main", [
      { role: "user", content: "hola" },
      {
        role: "assistant",
        content:
          "The agent encountered an internal error while processing the response. Please try again or narrow the scope of your request.",
      },
    ]);
  });

  it("applies fallback model when hard limit is reached and action=fallback", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    process.env.MODEL_COST_SOFT_LIMIT_USD = "0.000001";
    process.env.MODEL_COST_HARD_LIMIT_USD = "0.000001";
    process.env.MODEL_COST_HARD_ACTION = "fallback";
    process.env.MODEL_COST_FALLBACK_MODEL_KEY = "nemotron_super";
    process.env.MODEL_POLICY_ENV = "development";

    streamChatViaHttpMock.mockImplementation(async (params) => {
      params.onToken("ok");
    });

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionKey: "main",
        model: "devstral",
        messages: [{ role: "user", content: "hola" }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(streamChatViaHttpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "nemotron_super",
      }),
    );

    const streamBody = await response.text();
    expect(streamBody).toContain('"guardrailEvent":"fallback"');
    expect(streamBody).toContain('"fallbackFromModel":"devstral"');
  });

  it("blocks request when hard limit is reached and action=block", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    process.env.MODEL_COST_SOFT_LIMIT_USD = "0.000001";
    process.env.MODEL_COST_HARD_LIMIT_USD = "0.000001";
    process.env.MODEL_COST_HARD_ACTION = "block";

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionKey: "main",
        model: "devstral",
        messages: [{ role: "user", content: "hola" }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        code: "budget_limit",
        guardrailEvent: "block",
      }),
    );
    expect(streamChatViaHttpMock).not.toHaveBeenCalled();
  });
});

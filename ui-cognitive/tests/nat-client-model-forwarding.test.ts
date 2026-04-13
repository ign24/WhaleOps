import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("streamChatViaHttp model forwarding", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Return a minimal SSE stream that immediately sends [DONE]
    mockFetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode("data: [DONE]\n\n"),
            })
            .mockResolvedValue({ done: true, value: undefined }),
        }),
      },
    });
  });

  it("includes model in POST body when provided", async () => {
    const { streamChatViaHttp } = await import("@/lib/nat-client");
    await streamChatViaHttp({
      backendUrl: "http://localhost:8000",
      messages: [{ role: "user", content: "hi" }],
      timeoutMs: 5000,
      onToken: vi.fn(),
      model: "deepseek_v3",
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.model).toBe("deepseek_v3");
  });

  it("includes temperature_preset in POST body when provided", async () => {
    const { streamChatViaHttp } = await import("@/lib/nat-client");
    await streamChatViaHttp({
      backendUrl: "http://localhost:8000",
      messages: [{ role: "user", content: "hi" }],
      timeoutMs: 5000,
      onToken: vi.fn(),
      temperaturePreset: "high",
    });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.temperature_preset).toBe("high");
  });

  it("omits model and temperature_preset when not provided", async () => {
    const { streamChatViaHttp } = await import("@/lib/nat-client");
    await streamChatViaHttp({
      backendUrl: "http://localhost:8000",
      messages: [{ role: "user", content: "hi" }],
      timeoutMs: 5000,
      onToken: vi.fn(),
    });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.model).toBeUndefined();
    expect(body.temperature_preset).toBeUndefined();
  });

  it("passes both model and temperaturePreset together", async () => {
    const { streamChatViaHttp } = await import("@/lib/nat-client");
    await streamChatViaHttp({
      backendUrl: "http://localhost:8000",
      messages: [{ role: "user", content: "hi" }],
      timeoutMs: 5000,
      onToken: vi.fn(),
      model: "devstral",
      temperaturePreset: "low",
    });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.model).toBe("devstral");
    expect(body.temperature_preset).toBe("low");
  });

  it("forwards usage payload from data chunks to onUsage callback", async () => {
    const { streamChatViaHttp } = await import("@/lib/nat-client");
    const onUsage = vi.fn();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"usage":{"prompt_tokens":120,"completion_tokens":45,"total_tokens":165},"usage_estimated":false}\n\n',
              ),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode("data: [DONE]\n\n"),
            })
            .mockResolvedValue({ done: true, value: undefined }),
        }),
      },
    });

    await streamChatViaHttp({
      backendUrl: "http://localhost:8000",
      messages: [{ role: "user", content: "hi" }],
      timeoutMs: 5000,
      onToken: vi.fn(),
      onUsage,
    });

    expect(onUsage).toHaveBeenCalledWith({
      promptTokens: 120,
      completionTokens: 45,
      totalTokens: 165,
      isEstimated: false,
    });
  });

  it("defaults usage as estimated when usage_estimated flag is absent", async () => {
    const { streamChatViaHttp } = await import("@/lib/nat-client");
    const onUsage = vi.fn();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n',
              ),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode("data: [DONE]\n\n"),
            })
            .mockResolvedValue({ done: true, value: undefined }),
        }),
      },
    });

    await streamChatViaHttp({
      backendUrl: "http://localhost:8000",
      messages: [{ role: "user", content: "hi" }],
      timeoutMs: 5000,
      onToken: vi.fn(),
      onUsage,
    });

    expect(onUsage).toHaveBeenCalledWith({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      isEstimated: true,
    });
  });
});

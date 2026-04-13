import { describe, expect, it } from "vitest";

import {
  extractActivityEvent,
  extractErrorEvent,
  extractMetadataEvent,
  extractSSEToken,
  extractUsageEvent,
  flushSSEBuffer,
} from "@/lib/sse-parser";

describe("extractSSEToken", () => {
  it("extracts content token from a valid SSE data line", () => {
    const line = `data: {"choices":[{"delta":{"content":"Hola"}}]}`;
    expect(extractSSEToken(line)).toBe("Hola");
  });

  it("extracts multi-word content", () => {
    const line = `data: {"choices":[{"delta":{"content":" como estas?"}}]}`;
    expect(extractSSEToken(line)).toBe(" como estas?");
  });

  it("returns null for [DONE] signal", () => {
    expect(extractSSEToken("data: [DONE]")).toBeNull();
  });

  it("returns null for lines without data: prefix", () => {
    expect(extractSSEToken("event: message")).toBeNull();
    expect(extractSSEToken("")).toBeNull();
    expect(extractSSEToken(": keep-alive")).toBeNull();
  });

  it("returns null when delta has no content field", () => {
    const line = `data: {"choices":[{"delta":{"role":"assistant"}}]}`;
    expect(extractSSEToken(line)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(extractSSEToken("data: {not-json")).toBeNull();
  });

  it("returns null when choices array is empty", () => {
    const line = `data: {"choices":[]}`;
    expect(extractSSEToken(line)).toBeNull();
  });

  it("handles content with special characters", () => {
    const line =
      'data: {"choices":[{"delta":{"content":"hello\\nworld"}}]}';
    expect(extractSSEToken(line)).toBe("hello\nworld");
  });
});

describe("flushSSEBuffer", () => {
  it("returns tokens from a buffer with complete SSE events", () => {
    const buffer = `data: {"choices":[{"delta":{"content":"hola"}}]}\n\ndata: [DONE]\n\n`;
    const tokens = flushSSEBuffer(buffer);
    expect(tokens).toEqual(["hola"]);
  });

  it("returns tokens from buffer with residual data (no trailing newlines)", () => {
    const buffer = `data: {"choices":[{"delta":{"content":"residual"}}]}`;
    const tokens = flushSSEBuffer(buffer);
    expect(tokens).toEqual(["residual"]);
  });

  it("returns empty array for empty buffer", () => {
    expect(flushSSEBuffer("")).toEqual([]);
  });

  it("returns empty array for buffer with only [DONE]", () => {
    expect(flushSSEBuffer("data: [DONE]\n\n")).toEqual([]);
  });

  it("handles multiple tokens in buffer", () => {
    const buffer = [
      `data: {"choices":[{"delta":{"content":"A"}}]}`,
      "",
      `data: {"choices":[{"delta":{"content":"B"}}]}`,
      "",
      `data: [DONE]`,
      "",
    ].join("\n");
    const tokens = flushSSEBuffer(buffer);
    expect(tokens).toEqual(["A", "B"]);
  });

  it("skips lines without content (role-only deltas)", () => {
    const buffer = [
      `data: {"choices":[{"delta":{"role":"assistant"}}]}`,
      "",
      `data: {"choices":[{"delta":{"content":"hi"}}]}`,
      "",
    ].join("\n");
    const tokens = flushSSEBuffer(buffer);
    expect(tokens).toEqual(["hi"]);
  });

  it("skips malformed JSON lines in buffer", () => {
    const buffer = [
      `data: {bad-json`,
      "",
      `data: {"choices":[{"delta":{"content":"ok"}}]}`,
      "",
    ].join("\n");
    const tokens = flushSSEBuffer(buffer);
    expect(tokens).toEqual(["ok"]);
  });
});

describe("extractMetadataEvent", () => {
  it("extracts model and provider from metadata events", () => {
    const block = 'event: metadata\ndata: {"model":"nemotron","provider":"nvidia"}\n';
    expect(extractMetadataEvent(block)).toEqual({ model: "nemotron", provider: "nvidia" });
  });

  it("returns null for non-metadata events", () => {
    const block = 'event: tool\ndata: {"stream":"tool_start","toolName":"search"}\n';
    expect(extractMetadataEvent(block)).toBeNull();
  });

  it("returns null when metadata payload is malformed", () => {
    const block = "event: metadata\ndata: {bad-json\n";
    expect(extractMetadataEvent(block)).toBeNull();
  });

  it("extracts budget and cost fields from metadata events", () => {
    const block =
      'event: metadata\ndata: {"model":"devstral","budgetState":"warning","costCategory":"medium","cumulativeSessionCostUsd":0.1234}\n';
    expect(extractMetadataEvent(block)).toEqual({
      model: "devstral",
      budgetState: "warning",
      costCategory: "medium",
      cumulativeSessionCostUsd: 0.1234,
    });
  });
});

describe("extractActivityEvent", () => {
  it("extracts activity payload from activity blocks", () => {
    const block = 'event: activity\ndata: {"stream":"tool_start","timestamp":1234,"toolName":"read"}\n';
    expect(extractActivityEvent(block)).toEqual({ stream: "tool_start", timestamp: 1234, toolName: "read" });
  });

  it("returns null for non-activity events", () => {
    const block = 'event: tool\ndata: {"stream":"tool_start","toolName":"search"}\n';
    expect(extractActivityEvent(block)).toBeNull();
  });

  it("returns null when activity payload is malformed", () => {
    const block = "event: activity\ndata: {bad-json\n";
    expect(extractActivityEvent(block)).toBeNull();
  });
});

describe("extractErrorEvent", () => {
  it("extracts error payload from error blocks", () => {
    const block = 'event: error\ndata: {"message":"upstream failed"}\n';
    expect(extractErrorEvent(block)).toEqual({ message: "upstream failed" });
  });

  it("returns null for non-error events", () => {
    const block = 'event: metadata\ndata: {"model":"nemotron"}\n';
    expect(extractErrorEvent(block)).toBeNull();
  });

  it("returns null for malformed error payloads", () => {
    const block = "event: error\ndata: {bad-json\n";
    expect(extractErrorEvent(block)).toBeNull();
  });
});

describe("extractUsageEvent", () => {
  it("extracts token usage payload from usage blocks", () => {
    const block =
      'event: usage\ndata: {"promptTokens":120,"completionTokens":45,"totalTokens":165,"isEstimated":false}\n';
    expect(extractUsageEvent(block)).toEqual({
      promptTokens: 120,
      completionTokens: 45,
      totalTokens: 165,
      isEstimated: false,
    });
  });

  it("returns null for non-usage events", () => {
    const block = 'event: metadata\ndata: {"model":"nemotron"}\n';
    expect(extractUsageEvent(block)).toBeNull();
  });

  it("returns null for invalid usage payload shape", () => {
    const block = 'event: usage\ndata: {"promptTokens":"NaN","isEstimated":"no"}\n';
    expect(extractUsageEvent(block)).toBeNull();
  });
});

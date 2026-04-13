import { describe, expect, it } from "vitest";

import { extractToolEvent } from "@/lib/sse-parser";

describe("extractToolEvent", () => {
  it("returns parsed tool event for event: tool blocks", () => {
    const block = 'event: tool\ndata: {"stream":"tool_start","toolName":"search"}\n';
    expect(extractToolEvent(block)).toEqual({ stream: "tool_start", toolName: "search" });
  });

  it("returns null for non-tool blocks", () => {
    const block = 'event: metadata\ndata: {"model":"nemotron"}\n';
    expect(extractToolEvent(block)).toBeNull();
  });

  it("returns null when data line is missing", () => {
    expect(extractToolEvent("event: tool\n")).toBeNull();
  });

  it("returns null for malformed json", () => {
    expect(extractToolEvent("event: tool\ndata: {bad-json\n")).toBeNull();
  });
});

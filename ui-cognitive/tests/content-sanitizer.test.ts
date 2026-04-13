import { describe, expect, it, vi, afterEach } from "vitest";

import { sanitizeAssistantContent } from "@/lib/content-sanitizer";

const REPLACEMENT =
  "The agent encountered an internal error while processing the response. Please try again or narrow the scope of your request.";

describe("sanitizeAssistantContent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes through normal content unchanged", () => {
    const content = "This is a normal assistant response with no issues.";
    expect(sanitizeAssistantContent(content)).toBe(content);
  });

  it("passes through empty string unchanged", () => {
    expect(sanitizeAssistantContent("")).toBe("");
  });

  it("detects [SystemMessage(content= pattern", () => {
    const content = "[SystemMessage(content='<identity>You are Cognitive Intelligence</identity>')]";
    expect(sanitizeAssistantContent(content)).toBe(REPLACEMENT);
  });

  it("detects [HumanMessage(content= pattern", () => {
    const content = "Here is the history: [HumanMessage(content='quiero un code review')]";
    expect(sanitizeAssistantContent(content)).toBe(REPLACEMENT);
  });

  it("detects [AIMessage(content= pattern", () => {
    const content = "Messages: [AIMessage(content='Voy a realizar un análisis...', tool_calls=[...])]";
    expect(sanitizeAssistantContent(content)).toBe(REPLACEMENT);
  });

  it("detects [ToolMessage(content= pattern", () => {
    const content = "[ToolMessage(content='Error: GraphRecursionError...', tool_call_id='call_123')]";
    expect(sanitizeAssistantContent(content)).toBe(REPLACEMENT);
  });

  it("detects additional_kwargs={ pattern", () => {
    const content = "Response metadata: additional_kwargs={'tool_calls': [...]}";
    expect(sanitizeAssistantContent(content)).toBe(REPLACEMENT);
  });

  it("detects GraphRecursionError( pattern", () => {
    const content = "Error: GraphRecursionError('Recursion limit of 18 reached without hitting a stop condition.')";
    expect(sanitizeAssistantContent(content)).toBe(REPLACEMENT);
  });

  it("detects [TOOL_CALLS] control marker", () => {
    const content = "[TOOL_CALLS]reader_agent{\"messages\":[{\"role\":\"user\",\"content\":\"List files\"}]}";
    expect(sanitizeAssistantContent(content)).toBe(REPLACEMENT);
  });

  it("detects [TOOL_*] control marker variants", () => {
    const content = "[TOOL_EXEC]shell_execute{\"command\":\"git status\"}";
    expect(sanitizeAssistantContent(content)).toBe(REPLACEMENT);
  });

  it("detects mixed prose with tool marker payload", () => {
    const content =
      "Estoy auditando el repo ahora. [TOOL_CALLS]security_agent{\"messages\":[{\"role\":\"user\",\"content\":\"run scan\"}]}";
    expect(sanitizeAssistantContent(content)).toBe(REPLACEMENT);
  });

  it("returns single replacement even when multiple patterns are present", () => {
    const content =
      "[SystemMessage(content='sys')] [HumanMessage(content='hi')] additional_kwargs={} GraphRecursionError('limit')";
    expect(sanitizeAssistantContent(content)).toBe(REPLACEMENT);
  });

  it("emits console.warn with truncated preview on detection", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const content = "[SystemMessage(content='leaked system prompt that is very long " + "x".repeat(300) + "')]";
    sanitizeAssistantContent(content);
    expect(warn).toHaveBeenCalledOnce();
    const [label, preview] = warn.mock.calls[0] as [string, string];
    expect(label).toContain("content-sanitizer");
    expect(preview.length).toBeLessThanOrEqual(200);
  });

  it("does not call console.warn for clean content", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    sanitizeAssistantContent("A perfectly fine response.");
    expect(warn).not.toHaveBeenCalled();
  });

  it("does not sanitize normal bracketed prose", () => {
    const content = "Estos son tags de ejemplo [TOOLING] y [TOOLS], no metadatos internos.";
    expect(sanitizeAssistantContent(content)).toBe(content);
  });
});

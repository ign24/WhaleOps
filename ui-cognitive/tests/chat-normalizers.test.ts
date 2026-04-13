import { describe, expect, it } from "vitest";

import { normalizeContentText, parseHistory } from "@/lib/chat-normalizers";

describe("normalizeContentText", () => {
  it("returns raw string content", () => {
    expect(normalizeContentText("hola")).toBe("hola");
  });

  it("returns null for non object values", () => {
    expect(normalizeContentText(undefined)).toBeNull();
    expect(normalizeContentText(42)).toBeNull();
    expect(normalizeContentText(false)).toBeNull();
  });

  it("concatenates array content and strips empty chunks", () => {
    const input = [
      "A",
      { text: "B" },
      { content: "C" },
      { content: [{ text: "D" }] },
      null,
    ];

    expect(normalizeContentText(input)).toBe("ABCD");
  });

  it("resolves nested object text/content keys", () => {
    expect(normalizeContentText({ text: { content: "nested" } })).toBe("nested");
  });

  it("returns null when array has no useful text", () => {
    expect(normalizeContentText([{}, null, "   "])).toBeNull();
  });
});

describe("parseHistory", () => {
  it("parses source.result.messages entries", () => {
    const payload = {
      result: {
        messages: [
          { role: "user", content: "hola" },
          { role: "assistant", content: [{ text: "mundo" }] },
        ],
      },
    };

    expect(parseHistory(payload)).toEqual([
      expect.objectContaining({ role: "user", content: "hola" }),
      expect.objectContaining({ role: "assistant", content: "mundo" }),
    ]);
  });

  it("falls back through result.history and top-level keys", () => {
    const payload = {
      history: [{ role: "assistant", content: { content: "from-history" } }],
    };

    expect(parseHistory(payload)).toEqual([expect.objectContaining({ role: "assistant", content: "from-history" })]);
  });

  it("filters invalid roles and empty content", () => {
    const payload = {
      messages: [
        { role: "system", content: "ignored" },
        { role: "user", content: "" },
        { role: "assistant", content: "ok" },
      ],
    };

    expect(parseHistory(payload)).toEqual([expect.objectContaining({ role: "assistant", content: "ok" })]);
  });

  it("returns empty array for malformed payload", () => {
    expect(parseHistory(null)).toEqual([]);
    expect(parseHistory("bad")).toEqual([]);
  });

  it("preserves message id and timestamp when present", () => {
    const payload = {
      messages: [
        {
          id: "m-1",
          role: "assistant",
          content: "ok",
          timestamp: "2026-03-10T10:00:00.000Z",
        },
      ],
    };

    expect(parseHistory(payload)).toEqual([
      {
        id: "m-1",
        role: "assistant",
        content: "ok",
        timestamp: "2026-03-10T10:00:00.000Z",
      },
    ]);
  });

  it("creates fallback id and timestamp for legacy messages", () => {
    const payload = {
      messages: [{ role: "assistant", content: "legacy" }],
    };

    const parsed = parseHistory(payload);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.id).toBeTruthy();
    expect(parsed[0]?.timestamp).toBeTruthy();
    expect(parsed[0]?.content).toBe("legacy");
  });

  it("preserves intermediate steps when present", () => {
    const payload = {
      messages: [
        {
          id: "a-2",
          role: "assistant",
          content: "respuesta",
          timestamp: "2026-03-10T10:00:00.000Z",
          intermediateSteps: [
            {
              id: "step-1",
              stepId: "step-1",
              label: "Planning",
              kind: "agent",
              status: "running",
              startedAt: 1700000000000,
              detail: "Analizando contexto",
            },
          ],
        },
      ],
    };

    const parsed = parseHistory(payload);
    expect(parsed[0]?.intermediateSteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stepId: "step-1",
          detail: "Analizando contexto",
        }),
      ]),
    );
  });
});

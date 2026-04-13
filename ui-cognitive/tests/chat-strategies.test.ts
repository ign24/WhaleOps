import { describe, expect, it } from "vitest";

import { truncateMessages } from "@/lib/chat-strategies";

type SimpleMessage = { role: string; content: string };

describe("truncateMessages", () => {
  const messages: SimpleMessage[] = [
    { role: "user", content: "msg1" },
    { role: "assistant", content: "reply1" },
    { role: "user", content: "msg2" },
    { role: "assistant", content: "reply2" },
    { role: "user", content: "msg3" },
    { role: "assistant", content: "reply3" },
    { role: "user", content: "msg4" },
    { role: "assistant", content: "reply4" },
    { role: "user", content: "msg5" },
  ];

  it("returns all messages when under the limit", () => {
    expect(truncateMessages(messages, 20)).toEqual(messages);
  });

  it("truncates to the last N messages", () => {
    const result = truncateMessages(messages, 4);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ role: "assistant", content: "reply3" });
    expect(result[3]).toEqual({ role: "user", content: "msg5" });
  });

  it("always includes the last message", () => {
    const result = truncateMessages(messages, 1);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: "user", content: "msg5" });
  });

  it("returns empty array for empty input", () => {
    expect(truncateMessages([], 10)).toEqual([]);
  });

  it("handles exact limit match", () => {
    expect(truncateMessages(messages, 9)).toEqual(messages);
  });
});

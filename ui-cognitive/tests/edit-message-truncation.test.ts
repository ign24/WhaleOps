import { describe, expect, it } from "vitest";

import { ensureUiMessageShape } from "@/lib/message-utils";
import { UiChatMessage } from "@/types/chat";

const buildMessages = (): UiChatMessage[] => [
  ensureUiMessageShape({ role: "user", content: "first question" }),
  ensureUiMessageShape({ role: "assistant", content: "first answer" }),
  ensureUiMessageShape({ role: "user", content: "second question" }),
  ensureUiMessageShape({ role: "assistant", content: "second answer" }),
];

describe("edit message truncation logic", () => {
  it("slice(0, i) removes messages from index i onward", () => {
    const messages = buildMessages();
    const editIndex = 2;
    const truncated = messages.slice(0, editIndex);
    expect(truncated).toHaveLength(2);
    expect(truncated[0].content).toBe("first question");
    expect(truncated[1].content).toBe("first answer");
  });

  it("slice(0, 0) removes all messages when editing the first message", () => {
    const messages = buildMessages();
    const truncated = messages.slice(0, 0);
    expect(truncated).toHaveLength(0);
  });

  it("slice preserves message ids and roles", () => {
    const messages = buildMessages();
    const truncated = messages.slice(0, 2);
    expect(truncated[0].role).toBe("user");
    expect(truncated[1].role).toBe("assistant");
    expect(typeof truncated[0].id).toBe("string");
  });
});

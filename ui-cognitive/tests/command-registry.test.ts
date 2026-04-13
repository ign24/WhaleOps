import { describe, expect, it } from "vitest";

import { CHAT_COMMANDS } from "@/lib/command-registry";

describe("CHAT_COMMANDS", () => {
  it("contains unique slash command names", () => {
    const names = CHAT_COMMANDS.map((item) => item.name);
    const unique = new Set(names);

    expect(unique.size).toBe(names.length);
    expect(names.every((name) => name.startsWith("/"))).toBe(true);
  });

  it("exposes required fields for each command", () => {
    for (const item of CHAT_COMMANDS) {
      expect(item.name.trim().length).toBeGreaterThan(0);
      expect(item.insertValue.trim().length).toBeGreaterThan(0);
      expect(item.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps the core command set available", () => {
    expect(CHAT_COMMANDS.map((item) => item.name)).toEqual(
      expect.arrayContaining([
        "/help",
        "/status",
        "/tools",
        "/reset",
        "/stop",
        "/analyze",
        "/quick-review",
      ]),
    );
  });
});

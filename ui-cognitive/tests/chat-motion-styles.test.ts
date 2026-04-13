import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("chat motion styles", () => {
  it("defines active chat enhancement hooks for rich blocks", () => {
    const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

    expect(css).toContain('.chat-rich-markdown[data-chat-enhancement="active"]');
    expect(css).toContain('.chat-rich-block[data-chat-block="activity"]');
    expect(css).toContain('.chat-rich-block[data-chat-block="callout"]');
    expect(css).toContain('--chat-enhance-stagger-step');
  });

  it("keeps reduced-motion overrides with static hierarchy cues", () => {
    const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain('.chat-rich-block[data-chat-block="activity"]');
    expect(css).toContain('.chat-rich-block[data-chat-block="callout"]');
  });
});

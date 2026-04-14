// @vitest-environment happy-dom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/chat/message-markdown", () => ({
  MessageMarkdown: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock("@/components/activity/session-meta", () => ({
  humanizeActivityLabel: vi.fn((label: string) => label),
  humanizeArgKey: vi.fn((key: string) => key),
}));

import { ToolCallCard } from "@/components/activity/tool-call-card";

afterEach(() => cleanup());

describe("ToolCallCard - context chips", () => {
  it("return code chip for exit 0 has success color classes", () => {
    const { container } = render(
      <ToolCallCard returnCodeSummary="rc=0 (success)" />,
    );
    const chip = container.querySelector("[class*='var(--success)']");
    expect(chip).not.toBeNull();
    expect(chip!.className).toContain("border");
    expect(chip!.className).toContain("rounded-full");
  });

  it("return code chip for non-zero exit has error color classes", () => {
    const { container } = render(
      <ToolCallCard returnCodeSummary="rc=1 (error)" />,
    );
    const chip = container.querySelector("[class*='var(--error)']");
    expect(chip).not.toBeNull();
    expect(chip!.className).toContain("border");
    expect(chip!.className).toContain("rounded-full");
  });
});

describe("ToolCallCard - container chip", () => {
  it("renders container chip when containerRef is provided", () => {
    const { container } = render(
      <ToolCallCard containerRef="nginx" />,
    );
    const chips = container.querySelectorAll("span.rounded-full");
    const texts = Array.from(chips).map((c) => c.textContent ?? "");
    expect(texts.some((t) => t.includes("nginx"))).toBe(true);
  });

  it("renders container chip from container_id when containerRef provided", () => {
    const { container } = render(
      <ToolCallCard containerRef="abc123def" />,
    );
    const chips = container.querySelectorAll("span.rounded-full");
    const texts = Array.from(chips).map((c) => c.textContent ?? "");
    expect(texts.some((t) => t.includes("abc123def"))).toBe(true);
  });

  it("does not render container chip when containerRef is not provided", () => {
    const { container } = render(
      <ToolCallCard returnCodeSummary="rc=0 (success)" />,
    );
    const chips = container.querySelectorAll("span.rounded-full");
    // only the rc chip should be present, no container ref chip
    const texts = Array.from(chips).map((c) => c.textContent ?? "");
    expect(texts.every((t) => !t.includes("nginx") && !t.includes("container"))).toBe(true);
  });

  it("does not render sandboxPath chip", () => {
    const { container } = render(
      <ToolCallCard toolArgs={{ container_name: "web" }} containerRef="web" />,
    );
    const chips = container.querySelectorAll("span.rounded-full");
    const texts = Array.from(chips).map((c) => c.textContent ?? "");
    // no chip with "sandbox" or path-like content from old sandboxPath prop
    expect(texts.every((t) => !t.toLowerCase().includes("sandbox"))).toBe(true);
  });
});

describe("ToolCallCard - args table", () => {
  it("renders args inside a <dl> element", () => {
    const { container } = render(
      <ToolCallCard toolArgs={{ file_path: "/workspace/test.py", content: "hello" }} />,
    );
    const dl = container.querySelector("dl");
    expect(dl).not.toBeNull();
  });

  it("renders arg keys as <dt> elements", () => {
    const { container } = render(
      <ToolCallCard toolArgs={{ command: "ls -la" }} />,
    );
    const dt = container.querySelector("dt");
    expect(dt).not.toBeNull();
  });

  it("renders arg values as <dd> elements", () => {
    const { container } = render(
      <ToolCallCard toolArgs={{ query: "find files" }} />,
    );
    const dd = container.querySelector("dd");
    expect(dd).not.toBeNull();
  });
});

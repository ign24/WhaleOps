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

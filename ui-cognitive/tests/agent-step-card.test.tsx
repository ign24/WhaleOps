// @vitest-environment happy-dom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/chat/message-markdown", () => ({
  MessageMarkdown: ({ content }: { content: string }) => <div>{content}</div>,
}));

import { AgentStepCard } from "@/components/activity/agent-step-card";

afterEach(() => cleanup());

describe("AgentStepCard", () => {
  it("renders null when no detail", () => {
    const { container } = render(<AgentStepCard />);
    expect(container.firstChild).toBeNull();
  });

  it("renders null when detail is empty", () => {
    const { container } = render(<AgentStepCard detail="   " />);
    expect(container.firstChild).toBeNull();
  });

  it("card root has left border accent (border-l-2)", () => {
    const { container } = render(<AgentStepCard detail="some agent output" />);
    const card = container.firstChild as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.className).toContain("border-l-2");
  });

  it("card root has primary border color", () => {
    const { container } = render(<AgentStepCard detail="agent detail text" />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("border-[var(--primary)]");
  });
});

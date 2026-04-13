// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { MessageMarkdown } from "@/components/chat/message-markdown";

vi.mock("@/components/chat/code-block", () => ({
  CodeBlock: ({ code, language }: { code: string; language: string }) => (
    <div data-testid="mock-code-block" data-language={language}>
      {code}
    </div>
  ),
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    parse: vi.fn(async (source: string) => {
      if (source.includes("A-->")) {
        throw new Error("invalid mermaid");
      }

      return { diagramType: "flowchart" };
    }),
    render: vi.fn(async () => ({
      svg: "<svg><g><text>ok</text></g></svg>",
    })),
  },
}));

describe("MessageMarkdown", () => {
  it("opens external links in a new tab safely", () => {
    render(<MessageMarkdown content="[OpenAI](https://openai.com)" />);

    const link = screen.getByRole("link", { name: "OpenAI" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("keeps internal anchors in the same tab", () => {
    render(<MessageMarkdown content="[Ir a seccion](#seccion)" />);

    const link = screen.getByRole("link", { name: "Ir a seccion" });
    expect(link.getAttribute("href")).toBe("#seccion");
    expect(link.getAttribute("target")).toBeNull();
    expect(link.getAttribute("rel")).toBeNull();
  });

  it("renders GFM task list checkboxes", () => {
    render(<MessageMarkdown content={"- [x] Hecho\n- [ ] Pendiente"} />);

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
  });

  it("adds stable semantic hooks for text, list, code, and callout blocks", () => {
    render(
      <MessageMarkdown
        content={"Parrafo\n\n- Item\n\n```ts\nconst x = 1\n```\n\n> Nota importante"}
      />,
    );

    expect(document.querySelector('[data-chat-block="text"]')).toBeTruthy();
    expect(document.querySelector('[data-chat-block="list"]')).toBeTruthy();
    expect(document.querySelector('[data-chat-block="callout"]')).toBeTruthy();
    expect(screen.getByTestId("mock-code-block").getAttribute("data-language")).toBe("ts");
  });

  it("renders inline HTML tags as DOM elements, not literal text", () => {
    const { container } = render(<MessageMarkdown content="texto con <strong>negrita</strong> aqui" />);

    const strong = container.querySelector("strong");
    expect(strong).toBeTruthy();
    expect(strong?.textContent).toBe("negrita");
    expect(container.textContent).not.toContain("<strong>");
  });

  it("renders block HTML embedded in markdown", () => {
    const { container } = render(
      <MessageMarkdown content={"## Titulo\n\n<div>contenido html</div>"} />,
    );

    expect(container.querySelector("h2")).toBeTruthy();
    const div = container.querySelector("div > div");
    expect(div).toBeTruthy();
    expect(div?.textContent).toContain("contenido html");
  });

  it("strips script tags from message content", () => {
    const { container } = render(
      <MessageMarkdown content="texto <script>window.__xss=true</script> normal" />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect((window as Record<string, unknown>).__xss).toBeUndefined();
  });

  it("renders mermaid fenced blocks as diagrams", async () => {
    const { container } = render(
      <MessageMarkdown
        content={"```mermaid\nflowchart TD\nA[Inicio] --> B{Decision}\nB --> C[Fin]\n```"}
      />,
    );

    expect(container.querySelector('[data-testid="mermaid-diagram"]')).toBeTruthy();
    await waitFor(() => {
      expect(container.querySelector('[data-testid="mermaid-diagram-svg"]')).toBeTruthy();
    });
    expect(container.querySelector('[data-testid="mock-code-block"]')).toBeNull();
  });

  it("keeps non-mermaid fenced blocks on CodeBlock renderer", () => {
    const { container } = render(<MessageMarkdown content={"```ts\nconst total = 42\n```"} />);

    const codeBlock = container.querySelector('[data-testid="mock-code-block"]');
    expect(codeBlock?.getAttribute("data-language")).toBe("ts");
    expect(container.querySelector('[data-testid="mermaid-diagram"]')).toBeNull();
  });

  it("falls back to code block when mermaid parsing fails", async () => {
    const { container } = render(<MessageMarkdown content={"```mermaid\nflowchart TD\nA-->\n```"} />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="mermaid-fallback"]')).toBeTruthy();
    });

    const codeBlock = container.querySelector('[data-testid="mock-code-block"]');
    expect(codeBlock?.getAttribute("data-language")).toBe("mermaid");
  });
});

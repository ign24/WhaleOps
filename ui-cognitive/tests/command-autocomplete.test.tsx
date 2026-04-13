// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CommandAutocomplete } from "@/components/chat/command-autocomplete";

describe("CommandAutocomplete", () => {
  it("renders nothing when no items are provided", () => {
    const { container } = render(
      <CommandAutocomplete items={[]} activeIndex={0} onSelect={vi.fn()} onHover={vi.fn()} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders items and triggers onSelect", () => {
    const onSelect = vi.fn();

    render(
      <CommandAutocomplete
        items={[
          { label: "/help", value: "/help", description: "help" },
          { label: "/new", value: "/new", description: "new session" },
        ]}
        activeIndex={1}
        onSelect={onSelect}
        onHover={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "/new new session" }));

    expect(onSelect).toHaveBeenCalledWith({
      label: "/new",
      value: "/new",
      description: "new session",
    });
  });

  it("triggers onHover when item is hovered", () => {
    cleanup();
    const onHover = vi.fn();

    render(
      <CommandAutocomplete
        items={[{ label: "/help", value: "/help", description: "help" }]}
        activeIndex={0}
        onSelect={vi.fn()}
        onHover={onHover}
      />,
    );

    fireEvent.mouseEnter(screen.getByRole("button", { name: "/help help" }));
    expect(onHover).toHaveBeenCalledWith(0);
  });
});

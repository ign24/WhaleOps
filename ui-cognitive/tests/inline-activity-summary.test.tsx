// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InlineActivitySummary } from "@/components/chat/inline-activity-summary";
import { ActivityEntry } from "@/types/chat";

const buildEntry = (partial: Partial<ActivityEntry>): ActivityEntry => ({
  id: partial.id ?? "entry-1",
  label: partial.label ?? "tool",
  kind: partial.kind ?? "tool",
  status: partial.status ?? "completed",
  startedAt: partial.startedAt ?? 1000,
  completedAt: partial.completedAt,
});

describe("InlineActivitySummary", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders nothing for empty entries", () => {
    const { container } = render(<InlineActivitySummary entries={[]} onOpen={() => {}} />);
    expect(container.textContent).toBe("");
  });

  it("renders tool count and duration for tool-only entries", () => {
    render(
      <InlineActivitySummary
        entries={[
          buildEntry({ id: "1", kind: "tool", startedAt: 1000, completedAt: 2100 }),
          buildEntry({ id: "2", kind: "tool", startedAt: 2200, completedAt: 3000 }),
        ]}
        onOpen={() => {}}
      />,
    );

    expect(screen.getByText(/2 herramientas/i)).toBeTruthy();
    expect(screen.getByText(/1\.9s/)).toBeTruthy();
  });

  it("handles mixed statuses and opens panel on click", () => {
    const onOpen = vi.fn();
    render(
      <InlineActivitySummary
        entries={[
          buildEntry({ id: "1", kind: "tool", status: "running", startedAt: 1000, completedAt: 1000 }),
          buildEntry({ id: "2", kind: "agent", status: "failed", startedAt: 2000, completedAt: 2600 }),
        ]}
        onOpen={onOpen}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir panel de actividad" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("exposes stable semantic hooks for activity enhancement", () => {
    render(<InlineActivitySummary entries={[buildEntry({ id: "1" })]} onOpen={() => {}} />);

    const summaryButton = screen.getByRole("button", { name: "Abrir panel de actividad" });
    expect(summaryButton.getAttribute("data-chat-block")).toBe("activity");
    expect(summaryButton.getAttribute("data-chat-motion-profile")).toBe("activity");
  });
});

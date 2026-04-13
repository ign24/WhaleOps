// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TimelineEntry } from "@/components/activity/timeline-entry";
import { ActivityEntry } from "@/types/chat";

afterEach(() => {
  cleanup();
});

const buildEntry = (partial: Partial<ActivityEntry>): ActivityEntry => ({
  id: "e-1",
  label: partial.label ?? "tool",
  kind: partial.kind ?? "tool",
  status: partial.status ?? "completed",
  startedAt: 1_700_000_000_000,
  ...partial,
});

describe("TimelineEntry", () => {
  it("shows commandSummary for terminal category entries via TerminalBlock", () => {
    const entry = buildEntry({ label: "shell_execute", commandSummary: "git status" });
    const { container } = render(<TimelineEntry entry={entry} isActiveTool={false} />);
    const termCmd = container.querySelector("[data-testid='terminal-command']");
    expect(termCmd).not.toBeNull();
    expect(termCmd!.textContent).toContain("git status");
  });

  it("does not add $ prefix for file category entries", () => {
    const entry = buildEntry({ label: "write_file", sandboxPath: "/workspace/agent.py" });
    render(<TimelineEntry entry={entry} isActiveTool={false} />);
    expect(screen.queryByText(/^\$ /)).toBeNull();
    expect(screen.getByText("/workspace/agent.py")).toBeTruthy();
  });

  it("adds title attribute with full label text", () => {
    const entry = buildEntry({ label: "fs_tools__write_file" });
    render(<TimelineEntry entry={entry} isActiveTool={false} />);
    const label = screen.getByTitle("Escribir archivo");
    expect(label).toBeTruthy();
  });

  it("terminal entry shows command in TerminalBlock (not as header subtitle)", () => {
    const entry = buildEntry({ label: "shell_execute", commandSummary: "pytest -x" });
    const { container } = render(<TimelineEntry entry={entry} isActiveTool={false} />);
    const termCmd = container.querySelector("[data-testid='terminal-command']");
    expect(termCmd).not.toBeNull();
    expect(termCmd!.textContent).toContain("pytest -x");
  });

  it("renders a vertical connector element (activity-connector class) in the icon container", () => {
    const entry = buildEntry({ status: "completed" });
    const { container } = render(<TimelineEntry entry={entry} isActiveTool={false} />);
    const connector = container.querySelector(".activity-connector");
    expect(connector).not.toBeNull();
  });

  it("terminal entry does not render a nested bordered card inside the li when expanded", () => {
    const entry = buildEntry({
      label: "shell_execute",
      kind: "tool",
      status: "completed",
      commandSummary: "git status",
      returnCodeSummary: "rc=0",
      toolResult: "On branch main",
    });
    const { container } = render(<TimelineEntry entry={entry} isActiveTool={false} />);
    // expand the entry
    const btn = container.querySelector("button") as HTMLButtonElement;
    fireEvent.click(btn);
    // ToolCallCard wrapper has rounded-md + border — terminal should NOT have that nested inside li
    const nested = container.querySelector("li .rounded-md.border");
    expect(nested).toBeNull();
  });
});

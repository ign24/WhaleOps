// @vitest-environment happy-dom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/activity/session-meta", () => ({
  formatDuration: vi.fn((ms: number) => `${ms}ms`),
  getEntryDuration: vi.fn(() => 100),
}));

import { SessionSummary } from "@/components/activity/session-summary";
import { ActivityEntry } from "@/types/chat";

afterEach(() => cleanup());

const makeEntry = (status: ActivityEntry["status"]): ActivityEntry => ({
  id: `e-${Math.random()}`,
  label: "tool",
  kind: "tool",
  status,
  startedAt: Date.now(),
});

describe("SessionSummary", () => {
  it("renders total, duration, completed and error stats in a row with separators", () => {
    const entries = [makeEntry("completed"), makeEntry("completed"), makeEntry("failed")];
    const { container } = render(<SessionSummary entries={entries} />);
    const row = container.querySelector(".divide-x");
    expect(row).not.toBeNull();
  });

  it("shows total count in inline row", () => {
    const entries = [makeEntry("completed"), makeEntry("failed")];
    const { container } = render(<SessionSummary entries={entries} />);
    expect(container.textContent).toContain("2");
  });

  it("shows total and duration", () => {
    const entries = [makeEntry("completed"), makeEntry("failed"), makeEntry("failed")];
    const { container } = render(<SessionSummary entries={entries} />);
    expect(container.textContent).toContain("Total: 3");
    expect(container.textContent).toContain("Duracion: 300ms");
  });
});

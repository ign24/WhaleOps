// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/activity/activity-timeline", () => ({
  ActivityTimeline: () => null,
}));
vi.mock("@/components/activity/session-info", () => ({
  SessionInfo: () => null,
}));
vi.mock("@/components/activity/session-summary", () => ({
  SessionSummary: () => null,
}));

import { ActivityPanel } from "@/components/activity/activity-panel";
import type { ActivityEntry } from "@/types/chat";

afterEach(() => cleanup());

const makeEntry = (overrides: Partial<ActivityEntry>): ActivityEntry => ({
  id: "e1",
  label: "test",
  kind: "tool",
  status: "completed",
  startedAt: 1000,
  ...overrides,
});

describe("ActivityPanel — OpsSessionContext integration", () => {
  it("renders OpsSessionContext panel when containers are present in entries", () => {
    const entries = [
      makeEntry({
        toolNameNormalized: "inspect_container",
        toolArgs: { container_name: "nginx" },
      }),
    ];

    render(
      <ActivityPanel
        entries={entries}
        activeTool={null}
        isLive={false}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText(/Contexto de operaciones/i)).toBeTruthy();
  });

  it("does not render ops panel when entries have no ops tool calls", () => {
    const entries = [makeEntry({ kind: "agent", toolNameNormalized: "thinking" })];

    render(
      <ActivityPanel
        entries={entries}
        activeTool={null}
        isLive={false}
        onClose={() => undefined}
      />,
    );

    expect(screen.queryByText(/Contexto de operaciones/i)).toBeNull();
  });

  it("SessionWorkspace is not rendered in ActivityPanel", () => {
    const entries = [
      makeEntry({ toolNameNormalized: "inspect_container", toolArgs: { container_name: "app" } }),
    ];

    render(
      <ActivityPanel
        entries={entries}
        activeTool={null}
        isLive={false}
        onClose={() => undefined}
      />,
    );

    expect(screen.queryByText(/Espacio de trabajo/i)).toBeNull();
  });
});

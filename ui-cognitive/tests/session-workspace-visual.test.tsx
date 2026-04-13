// @vitest-environment happy-dom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/activity/workspace-snapshot", () => ({
  deriveWorkspaceSnapshot: vi.fn(),
  relativizeToRepo: vi.fn((path: string) => path),
}));

vi.mock("@/components/activity/session-meta", () => ({
  formatDuration: vi.fn((ms: number) => `${ms}ms`),
}));

vi.mock("@/components/activity/tree-node", () => ({
  TreeNode: () => null,
  formatBytes: vi.fn((b: number) => `${b}B`),
}));

// prevent real fetch calls in useWorkspaceTree
global.fetch = vi.fn(() => Promise.reject(new Error("no fetch in tests"))) as unknown as typeof fetch;

import { deriveWorkspaceSnapshot } from "@/components/activity/workspace-snapshot";
import { SessionWorkspace } from "@/components/activity/session-workspace";

const deriveSnapshotMock = vi.mocked(deriveWorkspaceSnapshot);

afterEach(() => {
  cleanup();
  deriveSnapshotMock.mockReset();
});

const emptySnap = {
  repos: [],
  filesRead: [],
  filesWritten: [],
  directoriesExplored: [],
  commandsRun: [],
  subagentTasks: [],
  isEmpty: false,
};

describe("SessionWorkspace - section count badges", () => {
  it("commands section header shows count as pill badge", () => {
    deriveSnapshotMock.mockReturnValue({
      ...emptySnap,
      commandsRun: ["git status", "bun run test"],
    });

    const { container } = render(<SessionWorkspace entries={[]} />);
    const badge = container.querySelector("span.rounded-full");
    expect(badge).not.toBeNull();
  });

  it("files section header shows count as pill badge when files exist", () => {
    deriveSnapshotMock.mockReturnValue({
      ...emptySnap,
      filesRead: [{ path: "/workspace/file.ts" }],
    });

    const { container } = render(<SessionWorkspace entries={[]} />);
    const badge = container.querySelector("span.rounded-full");
    expect(badge).not.toBeNull();
  });
});

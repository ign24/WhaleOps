// @vitest-environment happy-dom

import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SessionWorkspace } from "@/components/activity/session-workspace";
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

const cloneEntry = (url = "https://github.com/org/repo", localPath = "/tmp/repo"): ActivityEntry =>
  makeEntry({
    toolNameNormalized: "clone_repository",
    toolArgs: { url },
    toolResult: JSON.stringify({ repo_path: localPath, clone_type: "shallow", duration_ms: 1500 }),
  });

const readEntry = (path: string): ActivityEntry =>
  makeEntry({ toolNameNormalized: "read_text_file", toolArgs: { path } });

const shellEntry = (cmd: string): ActivityEntry =>
  makeEntry({ toolNameNormalized: "shell_execute", commandSummary: cmd });

// --- isEmpty ---

describe("SessionWorkspace", () => {
  it("renders nothing when entries produce empty snapshot", () => {
    const { container } = render(<SessionWorkspace entries={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when entries have no file-related tools", () => {
    const entries = [makeEntry({ toolNameNormalized: "thinking", kind: "agent" })];
    const { container } = render(<SessionWorkspace entries={entries} />);
    expect(container.firstChild).toBeNull();
  });

  // --- renders when data exists ---

  it("renders section header when there is at least one repo", () => {
    render(<SessionWorkspace entries={[cloneEntry()]} />);
    expect(screen.getByText(/Espacio de trabajo/i)).toBeTruthy();
  });

  it("shows repo URL in the panel", () => {
    render(<SessionWorkspace entries={[cloneEntry("https://github.com/org/repo")]} />);
    expect(screen.getByText(/org\/repo/)).toBeTruthy();
  });

  it("shows files read count or paths", () => {
    const entries = [cloneEntry(), readEntry("/tmp/repo/src/models.py")];
    render(<SessionWorkspace entries={entries} />);
    // should show the relativized path
    expect(screen.getByText(/models\.py/)).toBeTruthy();
  });

  it("shows shell commands", () => {
    render(<SessionWorkspace entries={[shellEntry("pytest tests/")]} />);
    expect(screen.getByText(/pytest tests\//)).toBeTruthy();
  });

  // --- collapse behavior ---

  it("starts expanded when total items <= 10", () => {
    const entries = [cloneEntry(), readEntry("/tmp/repo/a.py"), shellEntry("ls")];
    render(<SessionWorkspace entries={entries} />);
    // content is visible when expanded
    expect(screen.getByText(/a\.py/)).toBeTruthy();
  });

  it("starts collapsed when total items > 10", () => {
    const entries = [
      cloneEntry(),
      ...Array.from({ length: 11 }, (_, i) => readEntry(`/tmp/repo/file${i}.py`)),
    ];
    render(<SessionWorkspace entries={entries} />);
    // with > 10 items, content should be collapsed — file0.py should not be visible
    expect(screen.queryByText(/file0\.py/)).toBeNull();
  });

  it("expands on toggle click", () => {
    const entries = [
      cloneEntry(),
      ...Array.from({ length: 11 }, (_, i) => readEntry(`/tmp/repo/expand${i}.py`)),
    ];
    render(<SessionWorkspace entries={entries} />);
    // starts collapsed
    expect(screen.queryByText(/expand0\.py/)).toBeNull();
    // click header to expand
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText(/expand0\.py/)).toBeTruthy();
  });
});

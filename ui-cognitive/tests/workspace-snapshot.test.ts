import { describe, expect, it } from "vitest";
import {
  deriveWorkspaceSnapshot,
  relativizeToRepo,
} from "@/components/activity/workspace-snapshot";
import type { ActivityEntry } from "@/types/chat";

// --- helpers ---

const baseEntry = (overrides: Partial<ActivityEntry>): ActivityEntry => ({
  id: "e1",
  label: "test",
  kind: "tool",
  status: "completed",
  startedAt: 1000,
  ...overrides,
});

// --- deriveWorkspaceSnapshot ---

describe("deriveWorkspaceSnapshot", () => {
  it("returns isEmpty=true for empty entries", () => {
    const snap = deriveWorkspaceSnapshot([]);
    expect(snap.isEmpty).toBe(true);
    expect(snap.repos).toHaveLength(0);
    expect(snap.filesRead).toHaveLength(0);
    expect(snap.filesWritten).toHaveLength(0);
    expect(snap.directoriesExplored).toHaveLength(0);
    expect(snap.commandsRun).toHaveLength(0);
  });

  it("returns isEmpty=true when entries have no file-related tools", () => {
    const entries = [
      baseEntry({ toolNameNormalized: "thinking", kind: "agent" }),
      baseEntry({ toolNameNormalized: "run_pytest", kind: "tool" }),
    ];
    const snap = deriveWorkspaceSnapshot(entries);
    expect(snap.isEmpty).toBe(true);
  });

  // --- clone_repository ---

  it("extracts repo from clone_repository entry with JSON toolResult", () => {
    const entry = baseEntry({
      toolNameNormalized: "clone_repository",
      toolArgs: { url: "https://github.com/org/repo" },
      toolResult: JSON.stringify({
        repo_path: "/tmp/analysis/repo",
        clone_type: "shallow",
        duration_ms: 2100,
        returncode: 0,
      }),
    });
    const snap = deriveWorkspaceSnapshot([entry]);
    expect(snap.repos).toHaveLength(1);
    expect(snap.repos[0].url).toBe("https://github.com/org/repo");
    expect(snap.repos[0].localPath).toBe("/tmp/analysis/repo");
    expect(snap.repos[0].cloneType).toBe("shallow");
    expect(snap.repos[0].durationMs).toBe(2100);
    expect(snap.isEmpty).toBe(false);
  });

  it("falls back to sandboxPath for repo localPath when toolResult has no repo_path", () => {
    const entry = baseEntry({
      toolNameNormalized: "clone_repository",
      toolArgs: { url: "https://github.com/org/repo" },
      sandboxPath: "/tmp/analysis/repo",
      toolResult: JSON.stringify({ returncode: 0 }),
    });
    const snap = deriveWorkspaceSnapshot([entry]);
    expect(snap.repos[0].localPath).toBe("/tmp/analysis/repo");
  });

  it("includes clone_repository entry with status running (shows during streaming)", () => {
    const entry = baseEntry({
      toolNameNormalized: "clone_repository",
      status: "running",
      toolArgs: { url: "https://github.com/org/repo" },
      sandboxPath: "/tmp/analysis/repo",
    });
    const snap = deriveWorkspaceSnapshot([entry]);
    expect(snap.repos).toHaveLength(1);
    expect(snap.repos[0].url).toBe("https://github.com/org/repo");
    expect(snap.isEmpty).toBe(false);
  });

  // --- read tools ---

  it("extracts file from read_text_file entry", () => {
    const entry = baseEntry({
      toolNameNormalized: "read_text_file",
      toolArgs: { path: "/tmp/analysis/repo/src/models.py" },
      startedAt: 5000,
    });
    const snap = deriveWorkspaceSnapshot([entry]);
    expect(snap.filesRead).toHaveLength(1);
    expect(snap.filesRead[0].path).toBe("/tmp/analysis/repo/src/models.py");
    expect(snap.filesRead[0].timestamp).toBe(5000);
  });

  it("deduplicates read files by path, keeps first occurrence", () => {
    const entries = [
      baseEntry({ toolNameNormalized: "read_text_file", toolArgs: { path: "/a.py" }, startedAt: 1000 }),
      baseEntry({ toolNameNormalized: "read_text_file", toolArgs: { path: "/a.py" }, startedAt: 2000 }),
      baseEntry({ toolNameNormalized: "read_file", toolArgs: { path: "/b.py" }, startedAt: 3000 }),
    ];
    const snap = deriveWorkspaceSnapshot(entries);
    expect(snap.filesRead).toHaveLength(2);
    expect(snap.filesRead[0].path).toBe("/a.py");
    expect(snap.filesRead[0].timestamp).toBe(1000);
  });

  it("ignores read_text_file entry without path in toolArgs", () => {
    const entry = baseEntry({ toolNameNormalized: "read_text_file", toolArgs: {} });
    const snap = deriveWorkspaceSnapshot([entry]);
    expect(snap.filesRead).toHaveLength(0);
  });

  // --- write tools ---

  it("extracts file write from write_file entry", () => {
    const entry = baseEntry({
      toolNameNormalized: "write_file",
      toolArgs: { path: "/tmp/analysis/repo/out.txt" },
      startedAt: 7000,
    });
    const snap = deriveWorkspaceSnapshot([entry]);
    expect(snap.filesWritten).toHaveLength(1);
    expect(snap.filesWritten[0].path).toBe("/tmp/analysis/repo/out.txt");
    expect(snap.filesWritten[0].operation).toBe("write");
    expect(snap.filesWritten[0].timestamp).toBe(7000);
  });

  it("maps edit_file to operation=edit", () => {
    const entry = baseEntry({
      toolNameNormalized: "edit_file",
      toolArgs: { path: "/src/foo.py" },
    });
    expect(deriveWorkspaceSnapshot([entry]).filesWritten[0].operation).toBe("edit");
  });

  it("maps create_file to operation=create", () => {
    const entry = baseEntry({
      toolNameNormalized: "create_file",
      toolArgs: { path: "/src/new.py" },
    });
    expect(deriveWorkspaceSnapshot([entry]).filesWritten[0].operation).toBe("create");
  });

  it("maps apply_patch to operation=edit", () => {
    const entry = baseEntry({
      toolNameNormalized: "apply_patch",
      toolArgs: { path: "/src/foo.py" },
    });
    expect(deriveWorkspaceSnapshot([entry]).filesWritten[0].operation).toBe("edit");
  });

  // --- directory tools ---

  it("extracts directory from directory_tree entry", () => {
    const entry = baseEntry({
      toolNameNormalized: "directory_tree",
      toolArgs: { path: "/tmp/analysis/repo" },
      toolResult: "repo/\n  src/\n  tests/",
    });
    const snap = deriveWorkspaceSnapshot([entry]);
    expect(snap.directoriesExplored).toHaveLength(1);
    expect(snap.directoriesExplored[0].path).toBe("/tmp/analysis/repo");
    expect(snap.directoriesExplored[0].treeText).toBe("repo/\n  src/\n  tests/");
  });

  it("uses last treeText when same path explored multiple times", () => {
    const entries = [
      baseEntry({ toolNameNormalized: "directory_tree", toolArgs: { path: "/tmp/repo" }, toolResult: "first" }),
      baseEntry({ toolNameNormalized: "directory_tree", toolArgs: { path: "/tmp/repo" }, toolResult: "second" }),
    ];
    const snap = deriveWorkspaceSnapshot(entries);
    expect(snap.directoriesExplored).toHaveLength(1);
    expect(snap.directoriesExplored[0].treeText).toBe("second");
  });

  it("extracts directory from list_directory entry without treeText", () => {
    const entry = baseEntry({
      toolNameNormalized: "list_directory",
      toolArgs: { path: "/tmp/repo" },
      toolResult: undefined,
    });
    const snap = deriveWorkspaceSnapshot([entry]);
    expect(snap.directoriesExplored).toHaveLength(1);
    expect(snap.directoriesExplored[0].treeText).toBeUndefined();
  });

  // --- shell tools ---

  it("extracts command from shell_execute entry via commandSummary", () => {
    const entry = baseEntry({
      toolNameNormalized: "shell_execute",
      commandSummary: "pytest tests/",
    });
    const snap = deriveWorkspaceSnapshot([entry]);
    expect(snap.commandsRun).toContain("pytest tests/");
  });

  it("deduplicates commands", () => {
    const entries = [
      baseEntry({ toolNameNormalized: "shell_execute", commandSummary: "pytest tests/" }),
      baseEntry({ toolNameNormalized: "shell_execute", commandSummary: "pytest tests/" }),
      baseEntry({ toolNameNormalized: "bash", commandSummary: "ls -la" }),
    ];
    const snap = deriveWorkspaceSnapshot(entries);
    expect(snap.commandsRun).toHaveLength(2);
  });

  it("ignores shell entry without commandSummary", () => {
    const entry = baseEntry({ toolNameNormalized: "shell_execute" });
    const snap = deriveWorkspaceSnapshot([entry]);
    expect(snap.commandsRun).toHaveLength(0);
  });

  // --- status filtering ---

  it("includes running entries (shows during streaming)", () => {
    const entries = [
      baseEntry({ toolNameNormalized: "clone_repository", status: "running", toolArgs: { url: "https://github.com/org/repo" }, sandboxPath: "/tmp/repo" }),
      baseEntry({ toolNameNormalized: "read_text_file", status: "running", toolArgs: { path: "/a.py" } }),
    ];
    const snap = deriveWorkspaceSnapshot(entries);
    expect(snap.repos).toHaveLength(1);
    expect(snap.filesRead).toHaveLength(1);
    expect(snap.isEmpty).toBe(false);
  });

  it("ignores pending and failed entries", () => {
    const entries = [
      baseEntry({ toolNameNormalized: "read_text_file", status: "pending", toolArgs: { path: "/a.py" } }),
      baseEntry({ toolNameNormalized: "write_file", status: "failed", toolArgs: { path: "/b.py" } }),
    ];
    const snap = deriveWorkspaceSnapshot(entries);
    expect(snap.isEmpty).toBe(true);
  });
});

// --- MCP-prefixed tool names ---

describe("deriveWorkspaceSnapshot with MCP-prefixed tool names", () => {
  it("detects read_text_file with fs_tools__ prefix", () => {
    const entry = baseEntry({
      toolNameNormalized: "fs_tools__read_text_file",
      toolArgs: { path: "/tmp/repo/src/models.py" },
    });
    expect(deriveWorkspaceSnapshot([entry]).filesRead).toHaveLength(1);
  });

  it("detects directory_tree with fs_tools__ prefix", () => {
    const entry = baseEntry({
      toolNameNormalized: "fs_tools__directory_tree",
      toolArgs: { path: "/tmp/repo" },
      toolResult: "repo/\n  src/",
    });
    expect(deriveWorkspaceSnapshot([entry]).directoriesExplored).toHaveLength(1);
  });

  it("detects write_file with fs_tools_write__ prefix", () => {
    const entry = baseEntry({
      toolNameNormalized: "fs_tools_write__write_file",
      toolArgs: { path: "/tmp/repo/out.txt" },
    });
    const snap = deriveWorkspaceSnapshot([entry]);
    expect(snap.filesWritten).toHaveLength(1);
    expect(snap.filesWritten[0].operation).toBe("write");
  });

  it("detects edit_file with fs_tools_write__ prefix", () => {
    const entry = baseEntry({
      toolNameNormalized: "fs_tools_write__edit_file",
      toolArgs: { path: "/tmp/repo/src/foo.py" },
    });
    expect(deriveWorkspaceSnapshot([entry]).filesWritten[0].operation).toBe("edit");
  });

  it("detects shell_execute with shell_tools__ prefix", () => {
    const entry = baseEntry({
      toolNameNormalized: "shell_tools__shell_execute",
      commandSummary: "pytest tests/",
    });
    expect(deriveWorkspaceSnapshot([entry]).commandsRun).toContain("pytest tests/");
  });
});

// --- spawn_agent ---

describe("deriveWorkspaceSnapshot with spawn_agent", () => {
  it("extracts task from spawn_agent entry", () => {
    const entry = baseEntry({
      toolNameNormalized: "spawn_agent",
      status: "completed",
      toolArgs: {
        task: "Analizar la cobertura de docstrings en el repositorio /tmp/analysis/sqlmap.",
        tools: ["analyze_docstrings"],
      },
    });
    const snap = deriveWorkspaceSnapshot([entry]);
    expect(snap.subagentTasks).toHaveLength(1);
    expect(snap.subagentTasks[0].task).toContain("docstrings");
    expect(snap.subagentTasks[0].tools).toEqual(["analyze_docstrings"]);
    expect(snap.subagentTasks[0].repoPath).toBe("/tmp/analysis/sqlmap");
    expect(snap.subagentTasks[0].status).toBe("completed");
    expect(snap.isEmpty).toBe(false);
  });

  it("marks running spawn_agent as running", () => {
    const entry = baseEntry({
      toolNameNormalized: "spawn_agent",
      status: "running",
      toolArgs: { task: "Check /tmp/analysis/myrepo", tools: [] },
    });
    const snap = deriveWorkspaceSnapshot([entry]);
    expect(snap.subagentTasks[0].status).toBe("running");
  });

  it("falls back to sandboxPath when no repo path in task description", () => {
    const entry = baseEntry({
      toolNameNormalized: "spawn_agent",
      status: "completed",
      sandboxPath: "/tmp/analysis/fallback",
      toolArgs: { task: "Run analysis on the repo", tools: ["shell_execute"] },
    });
    const snap = deriveWorkspaceSnapshot([entry]);
    expect(snap.subagentTasks[0].repoPath).toBe("/tmp/analysis/fallback");
  });

  it("handles spawn_agent with no tools array", () => {
    const entry = baseEntry({
      toolNameNormalized: "spawn_agent",
      status: "completed",
      toolArgs: { task: "Do something", tools: null },
    });
    const snap = deriveWorkspaceSnapshot([entry]);
    expect(snap.subagentTasks[0].tools).toEqual([]);
  });

  it("does not include spawn_agent in isEmpty when task exists", () => {
    const entry = baseEntry({
      toolNameNormalized: "spawn_agent",
      status: "completed",
      toolArgs: { task: "Do something", tools: [] },
    });
    expect(deriveWorkspaceSnapshot([entry]).isEmpty).toBe(false);
  });
});

// --- relativizeToRepo ---

describe("relativizeToRepo", () => {
  const repos = [{ url: "https://github.com/org/repo", localPath: "/tmp/analysis/repo", cloneType: "shallow" }];

  it("relativizes path inside repo", () => {
    expect(relativizeToRepo("/tmp/analysis/repo/src/models.py", repos)).toBe("src/models.py");
  });

  it("returns path unchanged when not inside any repo", () => {
    expect(relativizeToRepo("/etc/config.yaml", repos)).toBe("/etc/config.yaml");
  });

  it("returns path unchanged when repos is empty", () => {
    expect(relativizeToRepo("/tmp/analysis/repo/src/models.py", [])).toBe("/tmp/analysis/repo/src/models.py");
  });

  it("handles exact localPath match (root of repo)", () => {
    expect(relativizeToRepo("/tmp/analysis/repo", repos)).toBe(".");
  });
});

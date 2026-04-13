import type {
  ActivityEntry,
  WorkspaceDirectory,
  WorkspaceFileAccess,
  WorkspaceFileWrite,
  WorkspaceRepo,
  WorkspaceSnapshot,
  WorkspaceSubagentTask,
} from "@/types/chat";

// --- tool name sets ---

const CLONE_TOOLS = new Set(["clone_repository"]);
const READ_TOOLS = new Set(["read_text_file", "read_file"]);
const WRITE_TOOLS = new Set(["write_file", "edit_file", "apply_patch", "create_file"]);
const DIR_TOOLS = new Set(["directory_tree", "list_directory"]);
const SHELL_TOOLS = new Set(["shell_execute", "bash", "shell"]);
const SPAWN_TOOLS = new Set(["spawn_agent"]);

// Matches /tmp/analysis/<name>, /app/workspace/<name>, /workspace/<name>
const REPO_PATH_RE = /\/(tmp\/analysis|app\/workspace|workspace)\/([^\s.,;:'")\]]+)/g;

// --- write operation mapping ---

const WRITE_OP_MAP: Record<string, WorkspaceFileWrite["operation"]> = {
  write_file: "write",
  edit_file: "edit",
  apply_patch: "edit",
  create_file: "create",
};

// --- internal helpers ---

const tryParseJson = (value: string | undefined): Record<string, unknown> | null => {
  if (!value || !value.trim().startsWith("{")) return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const getStringField = (obj: Record<string, unknown>, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
};

const getNumberField = (obj: Record<string, unknown>, ...keys: string[]): number | undefined => {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "number") return v;
  }
  return undefined;
};

// Strip MCP namespace prefix (e.g. "fs_tools__read_text_file" → "read_text_file")
const stripMcpPrefix = (name: string): string => name.replace(/^[a-z0-9_]+?__/i, "");

// --- main derivation function ---

export const deriveWorkspaceSnapshot = (entries: ActivityEntry[]): WorkspaceSnapshot => {
  const repos: WorkspaceRepo[] = [];
  const filesReadMap = new Map<string, WorkspaceFileAccess>();
  const filesWrittenMap = new Map<string, WorkspaceFileWrite>();
  const dirMap = new Map<string, WorkspaceDirectory>();
  const commandsSet = new Set<string>();
  const subagentTasks: WorkspaceSubagentTask[] = [];

  for (const entry of entries) {
    // Ignore pending/failed but include running so workspace shows during streaming
    if (entry.status === "pending" || entry.status === "failed") continue;

    const tool = stripMcpPrefix(entry.toolNameNormalized ?? "");
    const args = entry.toolArgs ?? {};

    if (CLONE_TOOLS.has(tool)) {
      const parsed = tryParseJson(entry.toolResult);
      const localPath =
        (parsed ? getStringField(parsed, "repo_path") : undefined) ?? entry.sandboxPath ?? "";
      const url = getStringField(args, "url", "repo_url") ?? "";
      const cloneType = (parsed ? getStringField(parsed, "clone_type") : undefined) ?? "full";
      const durationMs = parsed ? getNumberField(parsed, "duration_ms") : undefined;

      if (url || localPath) {
        repos.push({ url, localPath, cloneType, durationMs });
      }
      continue;
    }

    if (READ_TOOLS.has(tool)) {
      const path = getStringField(args, "path", "file_path");
      if (path && !filesReadMap.has(path)) {
        filesReadMap.set(path, { path, timestamp: entry.startedAt });
      }
      continue;
    }

    if (WRITE_TOOLS.has(tool)) {
      const path = getStringField(args, "path", "file_path");
      if (path && !filesWrittenMap.has(path)) {
        const operation = WRITE_OP_MAP[tool] ?? "write";
        filesWrittenMap.set(path, { path, operation, timestamp: entry.startedAt });
      }
      continue;
    }

    if (DIR_TOOLS.has(tool)) {
      const path = getStringField(args, "path", "directory");
      if (path) {
        const treeText = typeof entry.toolResult === "string" && entry.toolResult.trim().length > 0
          ? entry.toolResult
          : undefined;
        // always update to use the latest result for a given path
        dirMap.set(path, { path, treeText });
      }
      continue;
    }

    if (SHELL_TOOLS.has(tool)) {
      const cmd = entry.commandSummary;
      if (cmd) commandsSet.add(cmd);
      continue;
    }

    if (SPAWN_TOOLS.has(tool)) {
      const task = getStringField(args, "task", "description") ?? "";
      const rawTools = args["tools"];
      const tools = Array.isArray(rawTools) ? rawTools.filter((t): t is string => typeof t === "string") : [];

      // Extract repo path from task description or sandboxPath
      let repoPath: string | undefined;
      const taskText = task || "";
      REPO_PATH_RE.lastIndex = 0;
      const match = REPO_PATH_RE.exec(taskText);
      if (match) {
        repoPath = `/${match[1]}/${match[2]}`;
      } else if (entry.sandboxPath) {
        repoPath = entry.sandboxPath;
      }

      // Map entry status to subagent status
      const taskStatus: WorkspaceSubagentTask["status"] =
        entry.status === "running" ? "running" : entry.status === "completed" ? "completed" : "failed";

      subagentTasks.push({ task, tools, repoPath, status: taskStatus, timestamp: entry.startedAt });
      continue;
    }
  }

  const filesRead = Array.from(filesReadMap.values());
  const filesWritten = Array.from(filesWrittenMap.values());
  const directoriesExplored = Array.from(dirMap.values());
  const commandsRun = Array.from(commandsSet);

  const isEmpty =
    repos.length === 0 &&
    filesRead.length === 0 &&
    filesWritten.length === 0 &&
    directoriesExplored.length === 0 &&
    commandsRun.length === 0 &&
    subagentTasks.length === 0;

  return { repos, filesRead, filesWritten, directoriesExplored, commandsRun, subagentTasks, isEmpty };
};

// --- path relativization ---

export const relativizeToRepo = (filePath: string, repos: WorkspaceSnapshot["repos"]): string => {
  for (const repo of repos) {
    if (!repo.localPath) continue;
    if (filePath === repo.localPath) return ".";
    const prefix = repo.localPath.endsWith("/") ? repo.localPath : repo.localPath + "/";
    if (filePath.startsWith(prefix)) {
      return filePath.slice(prefix.length);
    }
  }
  return filePath;
};

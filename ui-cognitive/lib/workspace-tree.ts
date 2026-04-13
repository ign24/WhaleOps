import path from "path";

const ANALYSIS_ROOT = process.env.ANALYSIS_ROOT ?? "/tmp/analysis";
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT ?? "/app/workspace";

export const ALLOWED_ROOTS = [ANALYSIS_ROOT, WORKSPACE_ROOT];

export type WorkspaceRoot = { path: string; label: string };

export const CONFIGURED_ROOTS: WorkspaceRoot[] = [
  { path: ANALYSIS_ROOT, label: "sandbox" },
  { path: WORKSPACE_ROOT, label: "workspace" },
];

export type WorkspaceTreeNode = {
  name: string;
  type: "file" | "dir";
  size?: number;
  children?: WorkspaceTreeNode[];
};

export type WorkspaceChangedFile = {
  status: string;
  path: string;
};

export type WorkspaceTreeResponse = {
  path: string;
  tree: WorkspaceTreeNode[];
  changedFiles: WorkspaceChangedFile[];
  totalFiles: number;
  totalDirs: number;
  truncated: boolean;
};

export const isAllowedPath = (inputPath: string): boolean => {
  if (!inputPath) return false;
  const resolved = path.resolve(inputPath);
  return ALLOWED_ROOTS.some(
    (root) => resolved === root || resolved.startsWith(root + "/"),
  );
};

export const GIT_STATUS_RE = /^(.{1,2})\s+(.+)$/;

export const parseGitStatus = (stdout: string): WorkspaceChangedFile[] =>
  stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const m = GIT_STATUS_RE.exec(line);
      return m ? { status: m[1].trim(), path: m[2].trim() } : null;
    })
    .filter((x): x is WorkspaceChangedFile => x !== null)
    .slice(0, 100);

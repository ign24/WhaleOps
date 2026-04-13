"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, ChevronDown, ChevronRight, FileText, FolderOpen, GitBranch, Terminal } from "lucide-react";

import { deriveWorkspaceSnapshot, relativizeToRepo } from "@/components/activity/workspace-snapshot";
import { formatDuration } from "@/components/activity/session-meta";
import { TreeNode, formatBytes } from "@/components/activity/tree-node";
import type { ActivityEntry, WorkspaceChangedFile, WorkspaceSnapshot, WorkspaceTreeResponse } from "@/types/chat";

// --- helpers ---

const totalItems = (snap: WorkspaceSnapshot): number =>
  snap.repos.length +
  snap.filesRead.length +
  snap.filesWritten.length +
  snap.directoriesExplored.length +
  snap.commandsRun.length +
  snap.subagentTasks.length;

const truncate = (str: string, max: number): string =>
  str.length > max ? str.slice(0, max) + "…" : str;

// --- tree fetch hook ---

type TreeFetchState = { status: "idle" | "loading" | "done" | "error"; data: WorkspaceTreeResponse | null };

function useWorkspaceTree(repoPaths: string[]): Record<string, TreeFetchState> {
  const [cache, setCache] = useState<Record<string, TreeFetchState>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const p of repoPaths) {
      if (!p || fetchedRef.current.has(p)) continue;
      fetchedRef.current.add(p);

      fetch(`/api/workspace/tree?path=${encodeURIComponent(p)}`)
        .then((r) => r.json())
        .then((data: WorkspaceTreeResponse) =>
          setCache((prev) => ({ ...prev, [p]: { status: "done", data } })),
        )
        .catch(() =>
          setCache((prev) => ({ ...prev, [p]: { status: "error", data: null } })),
        );
    }
  }, [repoPaths.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return cache;
}

const GIT_STATUS_COLOR: Record<string, string> = {
  M: "text-[var(--warning)]",
  A: "text-[var(--success)]",
  D: "text-[var(--error)]",
  "??": "text-[var(--primary)]",
};

const ChangedFilesSection = ({ files }: { files: WorkspaceChangedFile[] }) => {
  if (files.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
        Cambios git ({files.length})
      </p>
      <div className="space-y-0.5">
        {files.map((f, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className={`shrink-0 font-mono text-[10px] font-semibold ${GIT_STATUS_COLOR[f.status] ?? "text-muted"}`}>
              {f.status}
            </span>
            <span className="truncate font-mono text-[10px] text-muted">{f.path}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const RepoTreePanel = ({ state }: { state: TreeFetchState }) => {
  if (state.status === "loading") {
    return (
      <p className="text-[10px] text-muted opacity-60">Cargando árbol…</p>
    );
  }
  if (state.status === "error" || !state.data) {
    return (
      <p className="text-[10px] text-muted opacity-60">No se pudo leer el directorio</p>
    );
  }

  const { tree, changedFiles, totalFiles, totalDirs, truncated } = state.data;

  return (
    <div className="mt-1.5">
      <div className="mb-1 flex flex-wrap gap-1">
        <span className="rounded bg-[var(--border)]/60 px-1.5 py-0.5 text-[10px] text-muted">
          {totalFiles} archivos
        </span>
        <span className="rounded bg-[var(--border)]/60 px-1.5 py-0.5 text-[10px] text-muted">
          {totalDirs} carpetas
        </span>
        {truncated ? (
          <span className="rounded bg-[var(--border)]/60 px-1.5 py-0.5 text-[10px] text-muted">
            truncado
          </span>
        ) : null}
      </div>
      <div className="chat-scrollbar max-h-48 overflow-y-auto rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1">
        {tree.map((node, i) => <TreeNode key={i} node={node} depth={0} />)}
      </div>
      <ChangedFilesSection files={changedFiles} />
    </div>
  );
};

// --- sub-sections ---

const RepoSection = ({
  repos,
  treeCache,
}: {
  repos: WorkspaceSnapshot["repos"];
  treeCache: Record<string, TreeFetchState>;
}) => {
  if (repos.length === 0) return null;
  return (
    <div>
      <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
        <GitBranch size={10} />
        {repos.length === 1 ? "Repositorio" : "Repositorios"}
        <span className="ml-1.5 rounded-full bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-1.5 py-0.5 text-[10px]">{repos.length}</span>
      </p>
      <div className="space-y-2">
        {repos.map((repo, i) => (
          <div key={i} className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs">
            <p className="break-all font-mono text-[11px]">
              {repo.url
                ? repo.url.replace(/^https?:\/\/(www\.)?/, "")
                : repo.localPath}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {repo.localPath ? (
                <span className="rounded bg-[var(--border)]/60 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                  {repo.localPath}
                </span>
              ) : null}
              <span className="rounded bg-[var(--border)]/60 px-1.5 py-0.5 text-[10px] text-muted">
                {repo.cloneType}
              </span>
              {repo.durationMs !== undefined ? (
                <span className="rounded bg-[var(--border)]/60 px-1.5 py-0.5 text-[10px] text-muted">
                  {formatDuration(repo.durationMs)}
                </span>
              ) : null}
            </div>
            {repo.localPath && treeCache[repo.localPath] ? (
              <RepoTreePanel state={treeCache[repo.localPath]} />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

const WRITE_OP_COLORS: Record<string, string> = {
  write: "bg-[var(--success)]/15 text-[var(--success)]",
  edit: "bg-[var(--surface)] text-muted",
  create: "bg-[var(--success)]/15 text-[var(--success)]",
};

const FilesSection = ({
  filesRead,
  filesWritten,
  repos,
}: {
  filesRead: WorkspaceSnapshot["filesRead"];
  filesWritten: WorkspaceSnapshot["filesWritten"];
  repos: WorkspaceSnapshot["repos"];
}) => {
  if (filesRead.length === 0 && filesWritten.length === 0) return null;

  const visibleRead = filesRead.slice(0, 5);
  const hiddenReadCount = filesRead.length - visibleRead.length;

  return (
    <div>
      {filesRead.length > 0 ? (
        <div>
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
            <FileText size={10} />
            Archivos leídos
            <span className="ml-1.5 rounded-full bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-1.5 py-0.5 text-[10px]">{filesRead.length}</span>
          </p>
          <div className="chat-scrollbar max-h-24 space-y-0.5 overflow-y-auto">
            {visibleRead.map((f) => (
              <p key={f.path} className="truncate font-mono text-[10px] text-muted">
                {relativizeToRepo(f.path, repos)}
              </p>
            ))}
            {hiddenReadCount > 0 ? (
              <p className="text-[10px] text-muted">+{hiddenReadCount} más</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {filesWritten.length > 0 ? (
        <div className={filesRead.length > 0 ? "mt-2" : ""}>
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
            <FileText size={10} />
            Archivos modificados
            <span className="ml-1.5 rounded-full bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-1.5 py-0.5 text-[10px]">{filesWritten.length}</span>
          </p>
          <div className="space-y-0.5">
            {filesWritten.map((f) => (
              <div key={f.path} className="flex items-center gap-1.5">
                <span
                  className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase ${WRITE_OP_COLORS[f.operation] ?? "bg-[var(--surface)] text-muted"}`}
                >
                  {f.operation}
                </span>
                <p className="truncate font-mono text-[10px] text-muted">
                  {relativizeToRepo(f.path, repos)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const DirectorySection = ({ dirs }: { dirs: WorkspaceSnapshot["directoriesExplored"] }) => {
  if (dirs.length === 0) return null;
  return (
    <div>
      {dirs.map((d, i) => (
        <div key={i}>
          {d.treeText ? (
            <div>
              <p className="mb-0.5 truncate font-mono text-[10px] text-muted">{d.path}</p>
              <pre className="chat-scrollbar max-h-40 overflow-y-auto whitespace-pre font-mono text-[10px] leading-relaxed text-muted">
                {d.treeText}
              </pre>
            </div>
          ) : (
            <p className="truncate font-mono text-[10px] text-muted">{d.path}</p>
          )}
        </div>
      ))}
    </div>
  );
};

const CommandsSection = ({ commands }: { commands: string[] }) => {
  if (commands.length === 0) return null;
  const visible = commands.slice(0, 5);
  const hidden = commands.length - visible.length;
  return (
    <div>
      <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
        <Terminal size={10} />
        Comandos
        <span className="ml-1.5 rounded-full bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-1.5 py-0.5 text-[10px]">{commands.length}</span>
      </p>
      <div className="space-y-0.5">
        {visible.map((cmd, i) => (
          <p key={i} className="truncate font-mono text-[10px] text-muted">
            {truncate(cmd, 80)}
          </p>
        ))}
        {hidden > 0 ? <p className="text-[10px] text-muted">+{hidden} más</p> : null}
      </div>
    </div>
  );
};

const STATUS_DOT: Record<string, string> = {
  running: "bg-[var(--warning)]",
  completed: "bg-[var(--success)]",
  failed: "bg-[var(--error)]",
};

const SubagentTasksSection = ({
  tasks,
  treeCache,
}: {
  tasks: WorkspaceSnapshot["subagentTasks"];
  treeCache: Record<string, TreeFetchState>;
}) => {
  if (tasks.length === 0) return null;
  return (
    <div>
      <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
        <Bot size={10} />
        Subagentes
        <span className="ml-1.5 rounded-full bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-1.5 py-0.5 text-[10px]">{tasks.length}</span>
      </p>
      <div className="space-y-1.5">
        {tasks.map((t, i) => (
          <div key={i} className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5">
            <div className="mb-0.5 flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[t.status] ?? "bg-muted"}`} />
              <p className="line-clamp-2 text-[10px] leading-tight text-muted">{t.task}</p>
            </div>
            {t.repoPath ? (
              <p className="mt-0.5 truncate font-mono text-[9px] text-muted opacity-70">{t.repoPath}</p>
            ) : null}
            {t.tools.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {t.tools.map((tool) => (
                  <span
                    key={tool}
                    className="rounded bg-[var(--border)]/60 px-1.5 py-0.5 font-mono text-[9px] text-muted"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            ) : null}
            {t.repoPath && treeCache[t.repoPath] ? <RepoTreePanel state={treeCache[t.repoPath]} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
};

// --- main component ---

type SessionWorkspaceProps = {
  entries: ActivityEntry[];
};

export const SessionWorkspace = ({ entries }: SessionWorkspaceProps) => {
  const snapshot = useMemo(() => deriveWorkspaceSnapshot(entries), [entries]);
  const total = useMemo(() => totalItems(snapshot), [snapshot]);

  const [isExpanded, setIsExpanded] = useState<boolean | null>(null);

  const expanded = isExpanded ?? total <= 10;

  // Collect all unique repo paths to fetch trees for
  const repoPaths = useMemo(() => {
    const paths = new Set<string>();
    for (const task of snapshot.subagentTasks) {
      if (task.repoPath) paths.add(task.repoPath);
    }
    for (const repo of snapshot.repos) {
      if (repo.localPath) paths.add(repo.localPath);
    }
    return Array.from(paths);
  }, [snapshot]);

  const treeCache = useWorkspaceTree(repoPaths);

  if (snapshot.isEmpty) return null;

  return (
    <div className="border-t border-[var(--border)]">
      <button
        type="button"
        onClick={() => setIsExpanded(!expanded)}
        className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left text-xs text-muted transition-colors duration-150 hover:bg-[var(--surface)]"
      >
        <span className="flex items-center gap-1 font-medium">
          <FolderOpen size={12} />
          Espacio de trabajo
        </span>
        <div className="flex items-center gap-1 text-[10px]">
          <span>{total} {total === 1 ? "elemento" : "elementos"}</span>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </div>
      </button>

      {expanded ? (
        <div className="space-y-3 px-3 pb-3 pt-1 text-xs">
          <SubagentTasksSection tasks={snapshot.subagentTasks} treeCache={treeCache} />
          <RepoSection repos={snapshot.repos} treeCache={treeCache} />
          <FilesSection
            filesRead={snapshot.filesRead}
            filesWritten={snapshot.filesWritten}
            repos={snapshot.repos}
          />
          <DirectorySection dirs={snapshot.directoriesExplored} />
          <CommandsSection commands={snapshot.commandsRun} />
        </div>
      ) : null}
    </div>
  );
};

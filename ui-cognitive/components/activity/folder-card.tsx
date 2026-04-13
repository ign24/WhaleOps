"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FolderOpen, RefreshCw } from "lucide-react";

import { TreeNode } from "@/components/activity/tree-node";
import type { WorkspaceRoot, WorkspaceTreeResponse } from "@/types/chat";

// --- types ---

type FetchState = { status: "idle" | "loading" | "done" | "error"; data: WorkspaceTreeResponse | null };

// --- hook ---

function useFolderTree(isLive: boolean): {
  roots: WorkspaceRoot[];
  rootsStatus: "loading" | "done" | "error";
  states: Record<string, FetchState>;
  refresh: () => void;
} {
  const [roots, setRoots] = useState<WorkspaceRoot[]>([]);
  const [rootsStatus, setRootsStatus] = useState<"loading" | "done" | "error">("loading");
  const [states, setStates] = useState<Record<string, FetchState>>({});

  const fetchRoots = useCallback(async (signal?: AbortSignal): Promise<WorkspaceRoot[]> => {
    try {
      setRootsStatus("loading");
      const res = await fetch("/api/workspace/roots", { signal });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as { roots?: WorkspaceRoot[] };
      const nextRoots = (data.roots ?? []).filter(
        (root): root is WorkspaceRoot =>
          typeof root?.path === "string" &&
          root.path.length > 0 &&
          typeof root?.label === "string" &&
          root.label.length > 0,
      );
      setRoots(nextRoots);
      setStates(Object.fromEntries(nextRoots.map((root) => [root.path, { status: "idle", data: null }])));
      setRootsStatus("done");
      return nextRoots;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return [];
      setRoots([]);
      setStates({});
      setRootsStatus("error");
      return [];
    }
  }, []);

  const fetchAll = useCallback(() => {
    if (roots.length === 0) return;

    setStates((prev) =>
      Object.fromEntries(
        roots.map((r) => [r.path, { status: "loading" as const, data: prev[r.path]?.data ?? null }]),
      ),
    );

    for (const { path } of roots) {
      fetch(`/api/workspace/tree?path=${encodeURIComponent(path)}`)
        .then((res) => {
          if (!res.ok) throw new Error(`${res.status}`);
          return res.json() as Promise<WorkspaceTreeResponse>;
        })
        .then((data) =>
          setStates((prev) => ({ ...prev, [path]: { status: "done", data } })),
        )
        .catch(() =>
          setStates((prev) => ({ ...prev, [path]: { status: "error", data: null } })),
        );
    }
  }, [roots]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchRoots(controller.signal);
    return () => controller.abort();
  }, [fetchRoots]);

  useEffect(() => {
    if (rootsStatus !== "done") return;
    fetchAll();
  }, [rootsStatus, fetchAll]);

  useEffect(() => {
    if (!isLive || roots.length === 0) return;
    const id = setInterval(fetchAll, 5000);
    return () => clearInterval(id);
  }, [isLive, roots.length, fetchAll]);

  const refresh = useCallback(() => {
    if (roots.length === 0) {
      void fetchRoots();
      return;
    }
    fetchAll();
  }, [roots.length, fetchAll, fetchRoots]);

  return { roots, rootsStatus, states, refresh };
}

// --- section ---

const totalNodes = (data: WorkspaceTreeResponse): number => data.totalFiles + data.totalDirs;

type SectionProps = {
  label: string;
  state: FetchState;
};

const FolderSection = ({ label, state }: SectionProps) => {
  const [expanded, setExpanded] = useState(
    state.status === "done" && state.data ? totalNodes(state.data) <= 10 : true,
  );

  return (
    <div className="border-t border-[var(--border)] first:border-t-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[11px] text-muted transition-colors duration-150 hover:bg-[var(--surface)]"
      >
        <span className="flex items-center gap-1 font-mono font-medium">
          <FolderOpen size={11} />
          /{label}
        </span>
        <div className="flex items-center gap-1 text-[10px]">
          {state.status === "done" && state.data ? (
            <span className="opacity-60">
              {state.data.totalFiles}f · {state.data.totalDirs}d
              {state.data.truncated ? " · truncado" : ""}
            </span>
          ) : null}
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </div>
      </button>

      {expanded ? (
        <div className="px-3 pb-2">
          {state.status === "idle" || state.status === "loading" ? (
            <p className="text-[10px] text-muted opacity-60">Cargando…</p>
          ) : state.status === "error" ? (
            <p className="text-[10px] text-muted opacity-60">No accesible desde este entorno</p>
          ) : state.data?.tree.length === 0 ? (
            <p className="text-[10px] text-muted opacity-60">vacío</p>
          ) : state.data ? (
            <div className="chat-scrollbar max-h-64 overflow-y-auto rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1">
              {state.data.tree.map((node, i) => (
                <TreeNode key={i} node={node} depth={0} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

// --- main component ---

export type FolderCardProps = {
  isLive: boolean;
};

export const FolderCard = ({ isLive }: FolderCardProps) => {
  const { roots, rootsStatus, states, refresh } = useFolderTree(isLive);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-1.5">
        <p className="text-[11px] font-medium text-muted">Sistema de archivos</p>
        <button
          type="button"
          aria-label="Actualizar"
          onClick={refresh}
          className="cursor-pointer rounded p-0.5 text-muted transition-colors duration-150 hover:bg-[var(--border)]/60 hover:text-[var(--text-primary)]"
        >
          <RefreshCw size={11} />
        </button>
      </div>

      <div className="chat-scrollbar flex-1 overflow-y-auto">
        {rootsStatus === "loading" ? (
          <p className="px-3 py-2 text-[10px] text-muted opacity-60">Cargando roots…</p>
        ) : rootsStatus === "error" ? (
          <p className="px-3 py-2 text-[10px] text-muted opacity-60">
            No se pudieron cargar los roots del servidor
          </p>
        ) : roots.length === 0 ? (
          <p className="px-3 py-2 text-[10px] text-muted opacity-60">No hay roots configurados</p>
        ) : roots.map(({ path, label }) => (
          <FolderSection
            key={`${path}:${states[path]?.data ? totalNodes(states[path].data) : -1}`}
            label={label}
            state={states[path] ?? { status: "loading", data: null }}
          />
        ))}
      </div>
    </div>
  );
};

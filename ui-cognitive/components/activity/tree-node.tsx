"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { WorkspaceTreeNode } from "@/types/chat";

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

export const TreeNode = ({ node, depth }: { node: WorkspaceTreeNode; depth: number }) => {
  const [open, setOpen] = useState(depth < 2);

  if (node.type === "dir") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-1 py-0.5 text-left font-mono text-[10px] text-muted hover:text-[var(--text-primary)]"
          style={{ paddingLeft: `${depth * 12}px` }}
        >
          {open ? <ChevronDown size={9} className="shrink-0" /> : <ChevronRight size={9} className="shrink-0" />}
          <span className="truncate">{node.name}/</span>
        </button>
        {open && node.children?.map((child, i) => (
          <TreeNode key={i} node={child} depth={depth + 1} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1 py-0.5 font-mono text-[10px] text-muted"
      style={{ paddingLeft: `${depth * 12 + 13}px` }}
    >
      <span className="truncate">{node.name}</span>
      {node.size !== undefined ? (
        <span className="shrink-0 opacity-50">{formatBytes(node.size)}</span>
      ) : null}
    </div>
  );
};

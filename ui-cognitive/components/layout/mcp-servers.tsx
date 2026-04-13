"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plug, Server } from "lucide-react";
import { useMcpServers } from "@/hooks/use-mcp-servers";
import { Tooltip } from "@/components/ui/tooltip";
import type { McpServerInfo } from "@/app/api/mcp/route";

type McpServerRowProps = {
  server: McpServerInfo;
  isCollapsed: boolean;
};

const StatusDot = ({ healthy }: { healthy: boolean }) => (
  <span
    className="h-1.5 w-1.5 shrink-0 rounded-full"
    style={{
      background: healthy ? "var(--success)" : "var(--error)",
      boxShadow: healthy ? "0 0 4px var(--success)" : "0 0 4px var(--error)",
    }}
  />
);

const McpServerRow = ({ server, isCollapsed }: McpServerRowProps) => {
  const [expanded, setExpanded] = useState(false);

  if (isCollapsed) {
    return (
      <Tooltip
        content={
          <span>
            <span className="font-medium">{server.displayName}</span>
            <span className="text-muted">
              {" "}&mdash; {server.availableTools}/{server.totalTools} herramientas
            </span>
          </span>
        }
        placement="right"
      >
        <div className="flex h-8 w-full items-center justify-center">
          <StatusDot healthy={server.healthy} />
        </div>
      </Tooltip>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)]"
      >
        <StatusDot healthy={server.healthy} />
        <span className="min-w-0 flex-1 truncate font-medium">{server.displayName}</span>
        <span className="shrink-0 text-[11px] text-muted">
          {server.availableTools}/{server.totalTools}
        </span>
        {expanded ? (
          <ChevronDown size={12} className="shrink-0 text-muted" />
        ) : (
          <ChevronRight size={12} className="shrink-0 text-muted" />
        )}
      </button>

      {expanded ? (
        <ul className="ml-5 mt-0.5 space-y-px pb-1">
          {server.tools.map((tool) => (
            <Tooltip key={tool.name} content={tool.description || tool.name} placement="right" delay={500}>
              <li
                className={`flex items-center gap-1.5 truncate text-[11px] ${
                  tool.available ? "text-muted" : "text-[var(--error)] line-through opacity-60"
                }`}
                title={tool.name}
              >
                <span
                  className="h-1 w-1 shrink-0 rounded-full"
                  style={{
                    background: tool.available ? "var(--text-secondary)" : "var(--error)",
                    opacity: tool.available ? 0.5 : 0.8,
                  }}
                />
                {tool.name}
              </li>
            </Tooltip>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

type McpServersProps = {
  isCollapsed: boolean;
};

export const McpServers = ({ isCollapsed }: McpServersProps) => {
  const { servers, isLoading, error } = useMcpServers();

  if (isCollapsed) {
    if (isLoading) return null;
    if (servers.length === 0) return null;

    return (
      <div className="flex flex-col items-center gap-1 py-1">
        <Tooltip content="Servidores MCP" placement="right">
          <div className="flex h-8 w-full items-center justify-center text-muted">
            <Plug size={14} />
          </div>
        </Tooltip>
        {servers.map((server) => (
          <McpServerRow key={server.name} server={server} isCollapsed />
        ))}
      </div>
    );
  }

  return (
    <div className="mb-2.5 sm:mb-3">
      <div className="mb-1 flex items-center gap-1.5">
        <Server size={12} className="text-muted" />
        <p className="text-[11px] uppercase tracking-wide text-muted">MCP Servers</p>
      </div>

      {isLoading ? (
        <div className="space-y-1 px-1">
          <div className="h-6 animate-pulse rounded bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)]" />
          <div className="h-6 animate-pulse rounded bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)]" />
        </div>
      ) : error && servers.length === 0 ? (
        <p className="px-2 text-[11px] text-muted">{error}</p>
      ) : servers.length === 0 ? (
        <p className="px-2 text-[11px] text-muted">Sin servidores MCP</p>
      ) : (
        <div className="space-y-px">
          {servers.map((server) => (
            <McpServerRow key={server.name} server={server} isCollapsed={false} />
          ))}
        </div>
      )}
    </div>
  );
};

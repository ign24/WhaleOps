"use client";

import { useCallback, useEffect, useState } from "react";
import type { McpServerInfo } from "@/app/api/mcp/route";

const MCP_SERVERS_CACHE_TTL_MS = 60_000;

let mcpServersCache: McpServerInfo[] = [];
let mcpServersCacheError: string | null = null;
let mcpServersCacheAt = 0;
let mcpServersInflight: Promise<{ servers: McpServerInfo[]; error: string | null }> | null = null;

const hasFreshMcpServersCache = () => Date.now() - mcpServersCacheAt < MCP_SERVERS_CACHE_TTL_MS;

const loadMcpServers = async () => {
  const res = await fetch("/api/mcp");
  const data = (await res.json()) as { servers?: McpServerInfo[]; error?: string };
  return {
    servers: data.servers ?? [],
    error: data.error ?? null,
  };
};

export const __resetMcpServersCacheForTests = () => {
  mcpServersCache = [];
  mcpServersCacheError = null;
  mcpServersCacheAt = 0;
  mcpServersInflight = null;
};

export const useMcpServers = () => {
  const [servers, setServers] = useState<McpServerInfo[]>(() => mcpServersCache);
  const [isLoading, setIsLoading] = useState(() => !hasFreshMcpServersCache());
  const [error, setError] = useState<string | null>(() => mcpServersCacheError);

  const fetchServers = useCallback(async (force = false) => {
    if (!force && hasFreshMcpServersCache()) {
      setServers(mcpServersCache);
      setError(mcpServersCacheError);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    if (force) {
      setError(null);
    }

    try {
      if (!mcpServersInflight || force) {
        mcpServersInflight = (async () => {
          try {
            const result = await loadMcpServers();
            mcpServersCache = result.servers;
            mcpServersCacheError = result.error;
            mcpServersCacheAt = Date.now();
            return result;
          } catch {
            mcpServersCache = [];
            mcpServersCacheError = "No se pudo conectar";
            mcpServersCacheAt = Date.now();
            return { servers: mcpServersCache, error: mcpServersCacheError };
          } finally {
            mcpServersInflight = null;
          }
        })();
      }

      const result = await mcpServersInflight;
      setServers(result.servers);
      setError(result.error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchServers();
  }, [fetchServers]);

  return { servers, isLoading, error, refresh: fetchServers };
};

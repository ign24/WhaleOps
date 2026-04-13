import { auth } from "@/auth";
import { getBackendUrl } from "@/lib/env";
import { NextResponse } from "next/server";

export type McpToolInfo = {
  name: string;
  description: string;
  available: boolean;
};

export type McpServerInfo = {
  name: string;
  displayName: string;
  transport: string;
  healthy: boolean;
  tools: McpToolInfo[];
  totalTools: number;
  availableTools: number;
};

const DISPLAY_NAMES: Record<string, string> = {
  fs_tools: "Filesystem",
  github_tools: "GitHub",
  context7_tools: "Context7",
};

/** function_group keys that should be merged into a single UI entry. */
const MERGE_GROUPS: Record<string, string> = {
  fs_tools_write: "fs_tools",
};

type NatTool = {
  name?: string;
  description?: string;
  available?: boolean;
};

type NatMcpClient = {
  function_group?: string;
  transport?: string;
  session_healthy?: boolean;
  tools?: NatTool[];
  total_tools?: number;
  available_tools?: number;
};

type NatToolListResponse = {
  mcp_clients?: NatMcpClient[];
};

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backendUrl = getBackendUrl();

  try {
    const response = await fetch(`${backendUrl}/mcp/client/tool/list`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ servers: [], error: "Backend unavailable" }, { status: 200 });
    }

    const payload = (await response.json()) as NatToolListResponse;
    const clients = payload.mcp_clients ?? [];

    const merged = new Map<string, McpServerInfo>();

    for (const client of clients) {
      const rawKey = client.function_group ?? "unknown";
      const key = MERGE_GROUPS[rawKey] ?? rawKey;

      const tools: McpToolInfo[] = (client.tools ?? []).map((t) => ({
        name: t.name ?? "",
        description: t.description ?? "",
        available: t.available ?? false,
      }));

      const existing = merged.get(key);
      if (existing) {
        // Merge: add only tools not already present
        const known = new Set(existing.tools.map((t) => t.name));
        for (const tool of tools) {
          if (!known.has(tool.name)) {
            existing.tools.push(tool);
          }
        }
        existing.totalTools = existing.tools.length;
        existing.availableTools = existing.tools.filter((t) => t.available).length;
        // Unhealthy if any sub-group is unhealthy
        if (!(client.session_healthy ?? false)) {
          existing.healthy = false;
        }
      } else {
        merged.set(key, {
          name: key,
          displayName: DISPLAY_NAMES[key] ?? key,
          transport: client.transport ?? "unknown",
          healthy: client.session_healthy ?? false,
          tools,
          totalTools: tools.length,
          availableTools: tools.filter((t) => t.available).length,
        });
      }
    }

    const servers = Array.from(merged.values());
    return NextResponse.json({ servers });
  } catch {
    return NextResponse.json({ servers: [], error: "Connection failed" }, { status: 200 });
  }
}

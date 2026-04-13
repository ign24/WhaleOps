import { auth } from "@/auth";
import { getBackendUrl } from "@/lib/env";
import { NextResponse } from "next/server";

const collectToolNames = (payload: unknown): string[] => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload.flatMap((item) => collectToolNames(item));
  }

  if (typeof payload === "string") {
    return payload.trim() ? [payload.trim()] : [];
  }

  if (typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.name === "string" && record.name.trim()) {
    return [record.name.trim()];
  }

  if (typeof record.tool === "string" && record.tool.trim()) {
    return [record.tool.trim()];
  }

  if (typeof record.skill === "string" && record.skill.trim()) {
    return [record.skill.trim()];
  }

  return Object.values(record).flatMap((value) => collectToolNames(value));
};

const fetchToolsFromGateway = async (backendUrl: string): Promise<string[]> => {
  const response = await fetch(`${backendUrl}/mcp/client/tool/list`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`NAT backend responded ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const names = collectToolNames(payload);
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
};

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backendUrl = getBackendUrl();

  try {
    const tools = await fetchToolsFromGateway(backendUrl);

    if (tools.length === 0) {
      return NextResponse.json(
        { error: "No se pudieron obtener herramientas del backend NAT" },
        { status: 502 },
      );
    }

    return NextResponse.json({ tools });
  } catch (error) {
    console.error("[api/tools] fetch failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal server error" }, { status: 502 });
  }
}

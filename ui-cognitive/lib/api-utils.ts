import path from "node:path";
import { NextResponse } from "next/server";

export function validateWorkspacePath(rawPath: string): boolean {
  if (rawPath.startsWith("/") || rawPath.startsWith("\\")) return false;

  const decoded = decodeURIComponent(rawPath);
  if (decoded.includes("..")) return false;

  const normalized = path.normalize(decoded);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) return false;

  return true;
}

export async function safeParseJson<T = unknown>(request: Request): Promise<{ data: T } | { error: NextResponse }> {
  try {
    const data = (await request.json()) as T;
    return { data };
  } catch {
    return {
      error: NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      ),
    };
  }
}

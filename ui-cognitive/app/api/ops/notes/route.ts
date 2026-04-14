import { auth } from "@/auth";
import { getBackendUrl } from "@/lib/env";
import type { OpsNotesResponse } from "@/types/ops";
import { NextResponse } from "next/server";

const NOTES_TIMEOUT_MS = 4_000;

const withTimeout = async (url: string): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NOTES_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backendUrl = getBackendUrl();
  const incomingUrl = new URL(request.url);
  const passthrough = new URL(`${backendUrl}/api/ops/notes`);

  const limit = incomingUrl.searchParams.get("limit");
  const noteType = incomingUrl.searchParams.get("note_type");
  const containerName = incomingUrl.searchParams.get("container_name");
  if (limit) passthrough.searchParams.set("limit", limit);
  if (noteType) passthrough.searchParams.set("note_type", noteType);
  if (containerName) passthrough.searchParams.set("container_name", containerName);

  try {
    const response = await withTimeout(passthrough.toString());
    if (!response.ok) {
      return NextResponse.json({ notes: [] as OpsNotesResponse["notes"] });
    }
    const payload = (await response.json()) as OpsNotesResponse;
    return NextResponse.json({ notes: payload.notes ?? [] });
  } catch {
    return NextResponse.json({ notes: [] as OpsNotesResponse["notes"] });
  }
}

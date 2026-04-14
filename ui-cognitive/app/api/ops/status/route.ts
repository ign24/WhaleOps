import { auth } from "@/auth";
import { getBackendUrl } from "@/lib/env";
import type { OpsStatusResponse } from "@/types/ops";
import { NextResponse } from "next/server";

const STATUS_TIMEOUT_MS = 4_000;

const withTimeout = async (url: string): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);
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

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backendUrl = getBackendUrl();
  try {
    const response = await withTimeout(`${backendUrl}/api/ops/status`);
    if (!response.ok) {
      return NextResponse.json({ error: "Ops status unavailable" }, { status: 503 });
    }
    const payload = (await response.json()) as OpsStatusResponse;
    return NextResponse.json({ containers: payload.containers ?? [] });
  } catch {
    return NextResponse.json({ error: "Ops status unavailable" }, { status: 503 });
  }
}

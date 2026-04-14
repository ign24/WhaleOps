import { auth } from "@/auth";
import { getBackendUrl } from "@/lib/env";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ container: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { container } = await params;
  if (!container) {
    return NextResponse.json({ error: "container is required" }, { status: 400 });
  }

  const backendUrl = getBackendUrl();
  try {
    const response = await fetch(
      `${backendUrl}/api/ops/containers/${encodeURIComponent(container)}/inspect`,
      { method: "GET", cache: "no-store" },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status === 404 ? 404 : 503 });
    }
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "Container inspect unavailable" }, { status: 503 });
  }
}

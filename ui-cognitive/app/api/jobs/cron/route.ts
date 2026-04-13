import { auth } from "@/auth";
import { getBackendUrl } from "@/lib/env";
import { NextResponse } from "next/server";

const parseUpstreamError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string; detail?: string };
    if (typeof payload.error === "string" && payload.error.trim().length > 0) return payload.error;
    if (typeof payload.detail === "string" && payload.detail.trim().length > 0) return payload.detail;
  } catch {
    // fallback
  }
  return `Backend responded ${response.status}`;
};

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const backendUrl = getBackendUrl();
  try {
    const response = await fetch(`${backendUrl}/api/jobs/cron`, { method: "GET", cache: "no-store" });
    if (!response.ok) {
      const error = await parseUpstreamError(response);
      return NextResponse.json({ error }, { status: response.status === 503 ? 503 : 502 });
    }
    const payload = await response.json();
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[api/jobs/cron] GET failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal server error" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const backendUrl = getBackendUrl();
  try {
    const response = await fetch(`${backendUrl}/api/jobs/cron`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status === 422 ? 422 : 502 });
    }
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    console.error("[api/jobs/cron] POST failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal server error" }, { status: 502 });
  }
}

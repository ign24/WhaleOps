import { auth } from "@/auth";
import { getBackendUrl } from "@/lib/env";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  const backendUrl = getBackendUrl();
  try {
    const response = await fetch(
      `${backendUrl}/api/jobs/cron/${encodeURIComponent(jobId)}`,
      { method: "DELETE", cache: "no-store" }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status === 404 ? 404 : 502 });
    }
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[api/jobs/cron/[jobId]] DELETE failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal server error" }, { status: 502 });
  }
}

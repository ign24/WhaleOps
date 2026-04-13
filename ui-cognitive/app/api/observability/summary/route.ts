import { auth } from "@/auth";
import { getBackendUrl } from "@/lib/env";
import { computeTraceStats } from "@/lib/observability";
import { getUserCostSnapshot } from "@/lib/cost-governance";
import { NextResponse } from "next/server";
const MONITOR_TIMEOUT_MS = 4_000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MonitorUsersPayload = {
  total_requests?: number;
  active_requests?: number;
  avg_latency_ms?: number;
  error_count?: number;
};

type ObservabilitySummaryResponse = {
  generatedAt: string;
  traceStats: Awaited<ReturnType<typeof computeTraceStats>>;
  monitorUsers: MonitorUsersPayload | null;
  costSummary: {
    userTotalUsd: number;
    perModel: Array<{ model: string; totalUsd: number }>;
  };
};

const fetchMonitorUsers = async (): Promise<MonitorUsersPayload | null> => {
  const backendUrl = getBackendUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MONITOR_TIMEOUT_MS);

  try {
    const response = await fetch(`${backendUrl}/monitor/users`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as MonitorUsersPayload;
    return payload;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [traceStats, monitorUsers] = await Promise.all([
    computeTraceStats(),
    fetchMonitorUsers(),
  ]);
  const userCostSnapshot = getUserCostSnapshot(session.user.id ?? session.user.email ?? "anonymous");

  const payload: ObservabilitySummaryResponse = {
    generatedAt: new Date().toISOString(),
    traceStats,
    monitorUsers,
    costSummary: {
      userTotalUsd: userCostSnapshot.totalUsd,
      perModel: userCostSnapshot.perModel,
    },
  };

  return NextResponse.json(payload);
}

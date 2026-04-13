import { auth } from "@/auth";
import { getBackendUrl } from "@/lib/env";
import { NextResponse } from "next/server";
const HEALTH_TIMEOUT_MS = 3000;

type HealthErrorType = "timeout" | "network" | "unknown";

const fetchWithTimeout = async (input: string, init: RequestInit) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const getBackendHost = (backendUrl: string): string => {
  try {
    return new URL(backendUrl).host;
  } catch {
    return "invalid-url";
  }
};

const classifyHealthError = (
  error: unknown
): { errorType: HealthErrorType; message: string } => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      errorType: "timeout",
      message: `Health check timeout after ${HEALTH_TIMEOUT_MS}ms`,
    };
  }

  if (error instanceof TypeError) {
    return {
      errorType: "network",
      message: error.message || "Network error while reaching NAT backend",
    };
  }

  if (error instanceof Error) {
    return {
      errorType: "unknown",
      message: error.message,
    };
  }

  return {
    errorType: "unknown",
    message: "NAT health check failed",
  };
};

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  const backendUrl = getBackendUrl();
  const backendHost = getBackendHost(backendUrl);
  const startedAt = performance.now();

  try {
    const response = await fetchWithTimeout(`${backendUrl}/health`, {
      method: "GET",
    });

    const latencyMs = Math.round(performance.now() - startedAt);
    const upstreamStatus = response.status;
    const isHealthy = response.ok;

    return NextResponse.json(
      {
        status: isHealthy ? "ok" : "error",
        code: upstreamStatus,
        upstreamStatus,
        latencyMs,
        backendHost,
      },
      { status: isHealthy ? 200 : 502 }
    );
  } catch (error) {
    const { errorType, message } = classifyHealthError(error);
    return NextResponse.json(
      {
        status: "error",
        code: 502,
        errorType,
        message,
        backendHost,
      },
      { status: 502 }
    );
  }
}

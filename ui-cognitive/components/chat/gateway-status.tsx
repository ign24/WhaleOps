"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Tooltip } from "@/components/ui/tooltip";

type HealthState = "loading" | "ok" | "error";

type GatewayStatusProps = {
  className?: string;
  activeTool?: string | null;
  onRetryConnection?: () => void;
  pollIntervalMs?: number;
};

const statusConfig: Record<
  HealthState,
  { label: string; color: string; pulse?: boolean; tooltip: string }
> = {
  loading: {
    label: "Verificando gateway...",
    color: "var(--warning)",
    pulse: true,
    tooltip: "Verificando la conexión con el gateway de IA...",
  },
  ok: {
    label: "Gateway activo",
    color: "var(--success)",
    tooltip: "Gateway activo — respuestas en tiempo real disponibles",
  },
  error: {
    label: "Gateway inactivo",
    color: "var(--error)",
    tooltip: "Gateway inactivo — no se pueden enviar mensajes hasta que la conexión se restaure",
  },
};

export const GatewayStatus = ({
  className,
  activeTool,
  onRetryConnection,
  pollIntervalMs = 15000,
}: GatewayStatusProps) => {
  const [status, setStatus] = useState<HealthState>("loading");
  const [isChecking, setIsChecking] = useState(false);
  const requestIdRef = useRef(0);

  const resolveHealthState = useCallback(async (): Promise<HealthState> => {
    const response = await fetch("/api/health", { method: "GET", cache: "no-store" });
    if (!response.ok) {
      return "error";
    }

    try {
      const payload = (await response.json()) as { status?: string };
      return payload.status === "ok" ? "ok" : "error";
    } catch {
      return "error";
    }
  }, []);

  const runHealthCheck = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsChecking(true);

    try {
      const nextState = await resolveHealthState();
      if (requestIdRef.current === requestId) {
        setStatus(nextState);
      }
    } catch {
      if (requestIdRef.current === requestId) {
        setStatus("error");
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setIsChecking(false);
      }
    }
  }, [resolveHealthState]);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (cancelled) {
        return;
      }

      await runHealthCheck();

      if (cancelled) {
        return;
      }
    };

    check();
    const interval = setInterval(() => {
      void check();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      requestIdRef.current += 1;
      clearInterval(interval);
    };
  }, [pollIntervalMs, runHealthCheck]);

  const handleRetryConnection = () => {
    onRetryConnection?.();
    setStatus("loading");
    void runHealthCheck();
  };

  const config = statusConfig[status];
  const wrapperClassName = ["flex items-center gap-2 text-xs text-muted", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClassName}>
      {/* Status dot with domain tooltip */}
      <Tooltip content={config.tooltip} placement="top">
        <span
          className={
            config.pulse
              ? "inline-block h-2.5 w-2.5 animate-pulse rounded-full cursor-default"
              : "inline-block h-2.5 w-2.5 rounded-full cursor-default"
          }
          style={{ backgroundColor: config.color }}
          aria-hidden="true"
        />
      </Tooltip>

      <span>{config.label}</span>

      {status === "error" ? (
        <button
          type="button"
          onClick={handleRetryConnection}
          disabled={isChecking}
          className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px] hover:bg-[var(--surface)] disabled:opacity-50"
        >
          {isChecking ? "Reintentando..." : "Reintentar conexión"}
        </button>
      ) : null}

      {/* Active tool badge with domain tooltip */}
      {activeTool ? (
        <Tooltip
          content={
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold">El agente está usando una herramienta</span>
              <span className="text-[color:var(--text-secondary)] text-[10px]">{activeTool}</span>
            </span>
          }
          placement="top"
        >
          <span
            className="cursor-default font-medium"
            style={{ color: "var(--warning)" }}
          >
            usando {activeTool}
          </span>
        </Tooltip>
      ) : null}

    </div>
  );
};

"use client";

import { AlertTriangle, BarChart3, Clock3, Coins, RefreshCcw, Wrench } from "lucide-react";
import { ProportionalBarList } from "@/components/observability/charts/proportional-bar-list";
import { TrendLineChart } from "@/components/observability/charts/trend-line-chart";
import { TrendAreaChart } from "@/components/observability/charts/trend-area-chart";
import { GaugeIndicator } from "@/components/observability/charts/gauge-indicator";
import { useCallback, useEffect, useMemo, useState } from "react";

type ObservabilityResponse = {
  generatedAt: string;
  traceStats: {
    requests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    failureRate: number;
    p50LatencyMs: number | null;
    p95LatencyMs: number | null;
    avgLatencyMs: number | null;
    contextOverflowCount: number;
    totalEstimatedCostUsd: number;
    avgCostPerTraceUsd: number | null;
    topToolFailures: Array<{ tool: string; count: number }>;
    topErrorCategories: Array<{ category: string; count: number }>;
    topToolsByUsage: Array<{ tool: string; count: number }>;
    tracesWithCost: number;
    sourcePath: string | null;
    linesProcessed: number;
    parserDiagnostics: {
      skippedLines: number;
      malformedJsonLines: number;
      missingTraceIdEvents: number;
      nestedFieldEvents: number;
      flatFieldEvents: number;
    };
    parity: {
      recentWindowMinutes: number;
      recentRuns: number;
      recentToolEvents: number;
      status: "ok" | "warning";
      reason: string | null;
    };
    trendBuckets: Array<{
      timestamp: number;
      requests: number;
      failures: number;
      p50Ms: number | null;
      p95Ms: number | null;
      costUsd: number;
    }>;
  };
  monitorUsers: {
    total_requests?: number;
    active_requests?: number;
    avg_latency_ms?: number;
    error_count?: number;
  } | null;
  costSummary?: {
    userTotalUsd: number;
    perModel: Array<{ model: string; totalUsd: number }>;
  };
};

const fmtInt = (value: number): string => new Intl.NumberFormat("es-ES").format(value);
const fmtPct = (value: number): string => `${value.toFixed(1)}%`;
const fmtMs = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} s`;
  }
  return `${Math.round(value)} ms`;
};
const fmtUsd = (value: number | null): string => {
  if (value === null || value <= 0) {
    return "-";
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(value);
};

const MetricCard = ({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
}) => {
  return (
    <article className="min-h-[116px] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{title}</p>
        <span className="rounded-lg border border-[var(--border)] p-2 text-muted" aria-hidden="true">
          {icon}
        </span>
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-muted">{subtitle}</p> : null}
    </article>
  );
};

export const ObservabilityDashboardView = () => {
  const [data, setData] = useState<ObservabilityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/observability/summary", { method: "GET", cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "No se pudo cargar observabilidad");
      }

      const payload = (await response.json()) as ObservabilityResponse;
      setData(payload);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Error cargando dashboard";
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const healthLabel = useMemo(() => {
    if (!data?.monitorUsers) {
      return "Monitor NAT no disponible";
    }
    const active = data.monitorUsers.active_requests ?? 0;
    return active > 0 ? `${active} requests activas en backend` : "Backend sin requests activas";
  }, [data]);

  const showNoTraceDataHint =
    !!data && (data.traceStats.sourcePath === null || data.traceStats.linesProcessed === 0);
  const showParserWarning =
    !!data &&
    data.traceStats.parserDiagnostics.skippedLines > 0 &&
    data.traceStats.parserDiagnostics.skippedLines >= Math.max(5, Math.floor(data.traceStats.linesProcessed * 0.2));
  const showParityWarning = !!data && data.traceStats.parity.status === "warning";

  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-4">
      <header className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Dashboard</h1>
            <p className="text-sm text-muted">Observabilidad del agente con trazas del runtime</p>
          </div>
          <button
            type="button"
            onClick={() => void load(true)}
            className="styled-button"
            aria-label="Actualizar dashboard"
            disabled={isRefreshing}
          >
            <RefreshCcw size={16} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
        {data?.generatedAt ? (
          <p className="mt-2 text-xs text-muted">
            Ultima actualizacion: {new Date(data.generatedAt).toLocaleString("es-ES")} · {healthLabel}
          </p>
        ) : null}
      </header>

      <div className="chat-scrollbar grid min-h-0 gap-4 overflow-y-auto pb-2">
        {error ? <p className="rounded-xl border border-[var(--error)]/30 bg-[var(--error)]/10 p-3 text-sm">{error}</p> : null}

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="h-[116px] animate-pulse rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--text-primary)_5%,transparent)]" />
            <div className="h-[116px] animate-pulse rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--text-primary)_5%,transparent)]" />
            <div className="h-[116px] animate-pulse rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--text-primary)_5%,transparent)]" />
            <div className="h-[116px] animate-pulse rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--text-primary)_5%,transparent)]" />
          </div>
        ) : null}

        {!isLoading && data ? (
          <>
            {showNoTraceDataHint ? (
              <p className="rounded-xl border border-[var(--warning)]/35 bg-[var(--warning)]/10 p-3 text-sm">
                No hay trazas disponibles para analizar. Verifica que el backend NAT este escribiendo en
                <code className="mx-1 rounded bg-[var(--surface)] px-1 py-0.5">TRACES_PATH</code>
                y que la UI tenga ese path montado en modo lectura.
              </p>
            ) : null}

            {showParserWarning ? (
              <p className="rounded-xl border border-[var(--warning)]/35 bg-[var(--warning)]/10 p-3 text-sm">
                Se omitieron {fmtInt(data.traceStats.parserDiagnostics.skippedLines)} lineas de trazas durante el parseo.
                Esto puede indicar drift de esquema entre backend y dashboard.
              </p>
            ) : null}

            {showParityWarning ? (
              <p className="rounded-xl border border-[var(--warning)]/35 bg-[var(--warning)]/10 p-3 text-sm">
                Paridad observabilidad: {data.traceStats.parity.reason ?? "Se detecto posible desalineacion de metricas"}.
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Volumen de requests"
                value={fmtInt(data.traceStats.requests)}
                subtitle={`${fmtInt(data.traceStats.successfulRequests)} exitosas · ${fmtInt(data.traceStats.failedRequests)} fallidas`}
                icon={<BarChart3 size={16} />}
              />
              <MetricCard
                title="Tasa de éxito"
                value={fmtPct(data.traceStats.successRate)}
                subtitle={`Tasa de fallo ${fmtPct(data.traceStats.failureRate)}`}
                icon={<AlertTriangle size={16} />}
              />
              <MetricCard
                title="Latencia p50 / p95"
                value={`${fmtMs(data.traceStats.p50LatencyMs)} / ${fmtMs(data.traceStats.p95LatencyMs)}`}
                subtitle={`Promedio ${fmtMs(data.traceStats.avgLatencyMs)}`}
                icon={<Clock3 size={16} />}
              />
              <MetricCard
                title="Costo por traza"
                value={fmtUsd(data.traceStats.avgCostPerTraceUsd)}
                subtitle={`Total ${fmtUsd(data.traceStats.totalEstimatedCostUsd)} · ${fmtInt(data.traceStats.tracesWithCost)} con costo`}
                icon={<Coins size={16} />}
              />
            </div>

            {data.costSummary ? (
              <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <h2 className="mb-2 text-sm font-semibold">Cost governance (sesion UI)</h2>
                <p className="text-sm text-muted">Costo estimado acumulado usuario: {fmtUsd(data.costSummary.userTotalUsd)}</p>
              </article>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-3">
              <TrendLineChart
                data={data.traceStats.trendBuckets}
                dataKeys={["p50Ms", "p95Ms"]}
                title="Latencia (p50 / p95)"
                yAxisFormatter={(v) => fmtMs(v)}
              />
              <TrendLineChart
                data={data.traceStats.trendBuckets}
                dataKeys={["costUsd"]}
                title="Costo por ventana"
                yAxisFormatter={(v) => fmtUsd(v)}
              />
              <TrendAreaChart
                data={data.traceStats.trendBuckets.map((b) => ({
                  ...b,
                  successRate: b.requests > 0 ? ((b.requests - b.failures) / b.requests) * 100 : 100,
                }))}
                dataKey="successRate"
                title="Tasa de éxito"
                sloThreshold={95}
                yAxisFormatter={(v) => `${v.toFixed(0)}%`}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 xl:col-span-1">
                <h2 className="mb-3 text-sm font-semibold">Fallos por herramienta</h2>
                <ProportionalBarList
                  items={data.traceStats.topToolFailures.map((f) => ({ label: f.tool, count: f.count }))}
                  emptyMessage="Sin fallos de tools detectados."
                  variant="error"
                />
              </article>

              <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 xl:col-span-1">
                <h2 className="mb-3 text-sm font-semibold">Categorias de error</h2>
                <ProportionalBarList
                  items={data.traceStats.topErrorCategories.map((e) => ({ label: e.category, count: e.count }))}
                  emptyMessage="Sin errores categorizados."
                  variant="error"
                />
              </article>

              <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 xl:col-span-1">
                <h2 className="mb-3 text-sm font-semibold">Salud de contexto</h2>
                <div className="space-y-3 text-sm">
                  <GaugeIndicator value={data.traceStats.contextOverflowCount} label="Desborde de contexto" />
                  <div className="rounded-lg border border-[var(--border)] px-3 py-2">
                    <p className="text-muted">Lineas procesadas</p>
                    <p className="text-xl font-semibold">{fmtInt(data.traceStats.linesProcessed)}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] px-3 py-2">
                    <p className="text-muted">Fuente de trazas</p>
                    <p className="truncate text-xs">{data.traceStats.sourcePath ?? "No encontrada"}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] px-3 py-2">
                    <p className="text-muted">Parseo (ok/omitidas)</p>
                    <p className="text-sm font-semibold">
                      {fmtInt(Math.max(0, data.traceStats.linesProcessed - data.traceStats.parserDiagnostics.skippedLines))}/
                      {fmtInt(data.traceStats.parserDiagnostics.skippedLines)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] px-3 py-2">
                    <p className="text-muted">Paridad ventana reciente</p>
                    <p className="text-sm font-semibold">
                      {fmtInt(data.traceStats.parity.recentRuns)} runs · {fmtInt(data.traceStats.parity.recentToolEvents)} con tools
                    </p>
                  </div>
                </div>
              </article>
            </div>

            <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="mb-3 flex items-center gap-2">
                <Wrench size={16} className="text-muted" />
                <h2 className="text-sm font-semibold">Herramientas mas usadas</h2>
              </div>
              <ProportionalBarList
                items={data.traceStats.topToolsByUsage.map((t) => ({ label: t.tool, count: t.count }))}
                emptyMessage="No hay uso de herramientas en las trazas analizadas."
              />
            </article>
          </>
        ) : null}
      </div>
    </section>
  );
};

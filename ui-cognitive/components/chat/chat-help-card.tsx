"use client";

import { ArrowRight, BookOpenText, Bug, GitBranch, Search, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, type Variants } from "motion/react";

interface ChatHelpCardProps {
  onPromptSelect: (prompt: string) => void;
}

interface LiveMetrics {
  status: "online" | "offline" | "loading";
  latencyMs: number | null;
  totalRequests: number | null;
  activeRequests: number | null;
  sessionsCount: number | null;
}

function useLiveMetrics(): LiveMetrics {
  const [metrics, setMetrics] = useState<LiveMetrics>({
    status: "loading",
    latencyMs: null,
    totalRequests: null,
    activeRequests: null,
    sessionsCount: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function fetchAll() {
      const [healthRes, summaryRes, sessionsRes] = await Promise.allSettled([
        fetch("/api/health", { signal: controller.signal }),
        fetch("/api/observability/summary", { signal: controller.signal }),
        fetch("/api/sessions", { signal: controller.signal }),
      ]);

      if (controller.signal.aborted) return;

      const health =
        healthRes.status === "fulfilled" && healthRes.value.ok
          ? await healthRes.value.json().catch(() => null)
          : null;

      const summary =
        summaryRes.status === "fulfilled" && summaryRes.value.ok
          ? await summaryRes.value.json().catch(() => null)
          : null;

      const sessions =
        sessionsRes.status === "fulfilled" && sessionsRes.value.ok
          ? await sessionsRes.value.json().catch(() => null)
          : null;

      if (!controller.signal.aborted) {
        setMetrics({
          status: health?.status === "ok" ? "online" : "offline",
          latencyMs: health?.latencyMs ?? null,
          totalRequests: summary?.monitorUsers?.total_requests ?? null,
          activeRequests: summary?.monitorUsers?.active_requests ?? null,
          sessionsCount: sessions?.sessions?.length ?? null,
        });
      }
    }

    fetchAll();
    return () => controller.abort();
  }, []);

  return metrics;
}

const steps = [
  {
    number: "01",
    icon: GitBranch,
    title: "Conectá el repositorio",
    description: "Pegá una URL de GitHub o un path local. El agente clona y mapea el proyecto.",
  },
  {
    number: "02",
    icon: Search,
    title: "El agente investiga",
    description: "Navega archivos, ejecuta herramientas y construye contexto profundo sobre el código.",
  },
  {
    number: "03",
    icon: Zap,
    title: "Insights accionables",
    description: "Findings priorizados, refactors, reportes de seguridad y documentación generada.",
  },
];

const capabilities = [
  {
    icon: Sparkles,
    title: "Code Review Técnico",
    description: "Detecta problemas de calidad, complejidad y mantenibilidad con análisis de diffs.",
    prompt: "Analizá la calidad del código y detectá problemas en este repositorio: ",
  },
  {
    icon: Bug,
    title: "QA y Testing",
    description: "Ejecuta pruebas, revisa cobertura y propone mejoras para reducir regresiones.",
    prompt: "Revisá la cobertura de tests y sugerí mejoras para este repositorio: ",
  },
  {
    icon: ShieldCheck,
    title: "Auditoría de Seguridad",
    description: "Escanea vulnerabilidades, secretos expuestos y dependencias con riesgo.",
    prompt: "Realizá una auditoría de seguridad completa de este repositorio: ",
  },
  {
    icon: BookOpenText,
    title: "Documentación",
    description: "Evalúa docstrings, README y API docs para mejorar onboarding técnico.",
    prompt: "Evaluá y generá documentación técnica para este repositorio: ",
  },
];

const starters = [
  "Analizá este repositorio: https://github.com/",
  "¿Qué problemas de seguridad tiene este proyecto?",
  "Generá un informe de calidad de código",
  "Refactorizá el módulo de autenticación",
];

const container: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.04 },
  },
  exit: {
    opacity: 0,
    y: -16,
    scale: 0.98,
    transition: { duration: 0.22, ease: "easeIn" },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.22, 0.61, 0.36, 1] },
  },
};

// Helper: animación de entrada explícita por delay (no hereda opacity del padre)
const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

function fadeUp(delay: number, duration = 0.32) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration, delay, ease: EASE },
  };
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-[var(--border)]" />
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
        {label}
      </span>
      <div className="h-px flex-1 bg-[var(--border)]" />
    </div>
  );
}

function MetricValue({ value, unit, loading }: { value: string | null; unit?: string; loading: boolean }) {
  if (loading) {
    return <span className="inline-block h-3 w-8 animate-pulse rounded bg-[var(--border)]" aria-hidden="true" />;
  }
  if (value === null) return <span className="text-[var(--text-secondary)]">—</span>;
  return (
    <>
      <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">{value}</span>
      {unit && <span className="text-xs text-[var(--text-secondary)]"> {unit}</span>}
    </>
  );
}

export const ChatHelpCard = ({ onPromptSelect }: ChatHelpCardProps) => {
  const m = useLiveMetrics();
  const isLoading = m.status === "loading";

  const statusColor =
    m.status === "online"
      ? "bg-emerald-500"
      : m.status === "offline"
        ? "bg-red-500"
        : "bg-[var(--border)] animate-pulse";

  const statusLabel =
    m.status === "online"
      ? "online"
      : m.status === "offline"
        ? "offline"
        : "conectando";

  return (
    <motion.section
      className="landing-hero mx-auto w-full max-w-2xl space-y-8 py-6 sm:py-8"
      aria-label="CGN-Agent — Bienvenida"
      variants={container}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Hero */}
      <motion.div className="landing-hero__hero space-y-4" variants={item}>
        <div className="space-y-1">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1">
            <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} aria-hidden="true" />
            <span className="font-mono text-[10px] font-medium text-[var(--text-secondary)]">
              v2.0 — {statusLabel}
              {m.latencyMs !== null && (
                <span className="ml-1 opacity-60">{m.latencyMs}ms</span>
              )}
            </span>
          </div>

          <h1 className="text-[2rem] font-bold leading-[1.1] tracking-tight sm:text-[2.5rem]">
            <span className="landing-hero-title">
              Inteligencia de código
            </span>
            <br />
            <span className="landing-hero-title">
              para tu repositorio
            </span>
          </h1>
        </div>

        <p className="max-w-md text-sm leading-relaxed text-[var(--text-secondary)] sm:text-[15px]">
          Agente autónomo que analiza, refactoriza, audita y documenta repositorios completos
          usando herramientas especializadas — sin intervención manual.
        </p>

        {/* Live stats */}
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <div className="flex items-baseline gap-1">
            <MetricValue
              value={m.totalRequests !== null ? String(m.totalRequests) : null}
              unit="requests"
              loading={isLoading}
            />
          </div>
          <div className="flex items-baseline gap-1">
            <MetricValue
              value={m.sessionsCount !== null ? String(m.sessionsCount) : null}
              unit="sesiones"
              loading={isLoading}
            />
          </div>
          {m.activeRequests !== null && m.activeRequests > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
              <span className="font-mono text-xs text-[var(--text-secondary)]">
                {m.activeRequests} activo{m.activeRequests !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* How it works — cada tarjeta entra con delay explícito */}
      <div className="landing-hero__steps space-y-4">
        <motion.div {...fadeUp(0.30)}>
          <SectionDivider label="Cómo funciona" />
        </motion.div>
        <div className="grid gap-2 sm:grid-cols-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                {...fadeUp(0.36 + i * 0.09)}
                className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4"
              >
                <div
                  className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--primary)] to-transparent opacity-60"
                  aria-hidden="true"
                />
                <div className="mb-3 flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold tabular-nums text-[var(--text-secondary)]">
                    {step.number}
                  </span>
                  <Icon size={12} className="text-[var(--text-secondary)]" aria-hidden="true" />
                </div>
                <p className="mb-1 text-xs font-semibold text-[var(--text-primary)]">{step.title}</p>
                <p className="text-[11px] leading-[1.6] text-[var(--text-secondary)]">
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Capabilities — ídem */}
      <div className="landing-hero__capabilities space-y-4">
        <motion.div {...fadeUp(0.60)}>
          <SectionDivider label="Capacidades" />
        </motion.div>
        <div className="grid gap-2 sm:grid-cols-2">
          {capabilities.map((cap, i) => {
            const Icon = cap.icon;
            return (
              <motion.button
                key={cap.title}
                {...fadeUp(0.67 + i * 0.08)}
                type="button"
                onClick={() => onPromptSelect(cap.prompt)}
                className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-left transition-all duration-150 hover:border-[color-mix(in_srgb,var(--primary)_35%,var(--border)_65%)] hover:bg-[color-mix(in_srgb,var(--surface)_94%,var(--primary)_6%)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                aria-label={`Usar modo: ${cap.title}`}
              >
                <div
                  className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--primary)] to-transparent opacity-40 transition-opacity duration-150 group-hover:opacity-80"
                  aria-hidden="true"
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <Icon size={13} className="shrink-0 text-[var(--primary)]" aria-hidden="true" />
                      <p className="text-xs font-semibold text-[var(--text-primary)]">{cap.title}</p>
                    </div>
                    <p className="text-[11px] leading-[1.6] text-[var(--text-secondary)]">
                      {cap.description}
                    </p>
                  </div>
                  <ArrowRight
                    size={13}
                    className="mt-0.5 shrink-0 text-[var(--text-secondary)] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Quick starters */}
      <div className="space-y-3">
        <motion.div {...fadeUp(1.00)}>
          <SectionDivider label="Inicio rápido" />
        </motion.div>
        <div className="flex flex-wrap gap-2">
          {starters.map((starter, i) => (
            <motion.button
              key={starter}
              {...fadeUp(1.06 + i * 0.05)}
              type="button"
              onClick={() => onPromptSelect(starter)}
              className="cursor-pointer rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)] transition-all duration-150 hover:border-[color-mix(in_srgb,var(--primary)_30%,var(--border)_70%)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              {starter}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.section>
  );
};

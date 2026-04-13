"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertCircle, BarChart3, ChevronLeft, ChevronRight, Clock, History, Loader2, MessageSquarePlus, Pencil, Shield, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useSessions } from "@/hooks/use-sessions";
import { Tooltip } from "@/components/ui/tooltip";
import { McpServers } from "@/components/layout/mcp-servers";
import { beginNewConversationAttempt, markNewConversationFeedbackVisible } from "@/lib/new-conversation-latency";


type SidebarProps = {
  isAdmin: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
};

export const Sidebar = ({
  isAdmin,
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { sessions, isLoading, error, setError, refresh } = useSessions();
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [pendingSessionKey, setPendingSessionKey] = useState<string | null>(null);
  const pendingResetTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!pendingSessionKey) {
      return;
    }

    if (pathname === `/chat/${pendingSessionKey}`) {
      setIsCreatingConversation(false);
      setPendingSessionKey(null);
    }
  }, [pathname, pendingSessionKey]);

  useEffect(() => {
    if (!isCreatingConversation) {
      if (pendingResetTimeoutRef.current !== null) {
        window.clearTimeout(pendingResetTimeoutRef.current);
        pendingResetTimeoutRef.current = null;
      }
      return;
    }

    pendingResetTimeoutRef.current = window.setTimeout(() => {
      setIsCreatingConversation(false);
      setPendingSessionKey(null);
      pendingResetTimeoutRef.current = null;
    }, 6000);

    return () => {
      if (pendingResetTimeoutRef.current !== null) {
        window.clearTimeout(pendingResetTimeoutRef.current);
        pendingResetTimeoutRef.current = null;
      }
    };
  }, [isCreatingConversation]);

  const createSessionKey = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID().slice(0, 8);
    }

    return Math.random().toString(36).slice(2, 10);
  };

  const createConversation = async () => {
    if (isCreatingConversation) {
      return;
    }

    setError(null);

    const sessionKey = createSessionKey();
    beginNewConversationAttempt(sessionKey, "sidebar");
    setPendingSessionKey(sessionKey);
    setIsCreatingConversation(true);
    markNewConversationFeedbackVisible(sessionKey);
    router.push(`/chat/${sessionKey}?bootstrap=new`);
  };

  const deleteConversation = async (sessionKey: string) => {
    const confirmed = window.confirm("¿Eliminar esta sesión?");
    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionKey}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("No se pudo eliminar la sesion");
      }

      await refresh(true);

      if (pathname === `/chat/${sessionKey}`) {
        router.push("/chat/main");
      }
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la sesion";
      setError(message);
    }
  };

  const renameConversation = async (sessionKey: string, currentTitle: string) => {
    const nextTitle = window.prompt("Nuevo nombre de la sesion", currentTitle);
    if (typeof nextTitle !== "string") {
      return;
    }

    setError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });

      if (!response.ok) {
        throw new Error("No se pudo renombrar la sesion");
      }

      await refresh(true);
    } catch (renameError) {
      const message = renameError instanceof Error ? renameError.message : "No se pudo renombrar la sesion";
      setError(message);
    }
  };

  /* ── Collapsed: icon-only rail (64px) ─────────────────────────── */
  if (isCollapsed) {
    return (
      <motion.aside
        key="collapsed"
        initial={{ x: "-100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
        className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"
        aria-busy={isCreatingConversation}
      >
        {/* Toggle: expand */}
        <div className="flex shrink-0 justify-center border-b border-[var(--border)] px-2 py-2">
          {onToggleCollapse ? (
            <Tooltip content="Expandir sidebar" placement="right" delay={300}>
              <button
                type="button"
                onClick={onToggleCollapse}
                className="styled-button styled-button-icon"
                aria-label="Expandir sidebar"
                aria-pressed={false}
              >
                <ChevronRight size={16} />
              </button>
            </Tooltip>
          ) : null}
        </div>

        {/* Nav icons */}
        <div className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto px-2 py-2.5">
          {/* Nueva conversación */}
          <Tooltip content="Nueva conversación" placement="right">
            <button
              type="button"
              onClick={createConversation}
              className="styled-button styled-button-icon"
              aria-label={isCreatingConversation ? "Creando conversación" : "Nueva conversación"}
              disabled={isCreatingConversation}
              aria-disabled={isCreatingConversation}
            >
              {isCreatingConversation ? <Loader2 size={18} className="animate-spin text-muted" /> : <MessageSquarePlus size={18} />}
            </button>
          </Tooltip>

          {/* Dashboard */}
          <Tooltip content="Dashboard de observabilidad" placement="right">
            <Link
              href="/observability"
              aria-label="Dashboard"
              className={`styled-button styled-button-icon ${
                pathname.startsWith("/observability") ? "text-[var(--primary)]" : ""
              }`}
            >
              <BarChart3 size={18} />
            </Link>
          </Tooltip>

          {/* MCP Servers */}
          <McpServers isCollapsed />

          {/* Divider */}
          <div className="my-1 w-8 border-t border-[var(--border)]" />

          {/* Sessions */}
          {isLoading ? (
            <>
              <div className="h-9 w-full animate-pulse rounded-lg bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)]" />
              <div className="h-9 w-full animate-pulse rounded-lg bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)]" />
              <div className="h-9 w-full animate-pulse rounded-lg bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)]" />
            </>
          ) : error ? (
            <Tooltip content={error} placement="right">
              <div className="flex justify-center rounded-lg p-2 text-[var(--error)]">
                <AlertCircle size={15} />
              </div>
            </Tooltip>
          ) : sessions.length === 0 ? (
            <Tooltip content="Sin sesiones activas" placement="right">
              <div className="flex justify-center rounded-lg p-2 text-muted">
                <History size={15} />
              </div>
            </Tooltip>
          ) : (
            <AnimatePresence initial={false}>
              {sessions.map((session) => {
                const isActive = pathname === `/chat/${session.sessionKey}`;
                return (
                  <motion.div
                    key={session.sessionKey}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.18 }}
                    className="w-full"
                  >
                    <Tooltip content={session.title} placement="right" delay={300} wrapperClassName="w-full">
                      <Link
                        href={`/chat/${session.sessionKey}`}
                        aria-label={session.title}
                        className={`flex h-9 w-full items-center justify-center rounded-lg text-sm font-semibold transition-colors duration-200 ${
                          isActive
                            ? "bg-[var(--primary)] text-[var(--text-on-primary)]"
                            : "hover:bg-[color-mix(in_srgb,var(--text-primary)_8%,transparent)]"
                        }`}
                      >
                        {session.title.slice(0, 1).toUpperCase()}
                      </Link>
                    </Tooltip>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Admin */}
        {isAdmin ? (
          <div className="shrink-0 border-t border-[var(--border)] px-2 py-2">
            <Tooltip content="Administración de usuarios" placement="right" wrapperClassName="w-full">
              <Link
                href="/admin/users"
                aria-label="Usuarios"
                className={`flex h-9 w-full items-center justify-center rounded-lg transition-colors duration-200 ${
                  pathname === "/admin/users"
                    ? "bg-[var(--primary)] text-[var(--text-on-primary)]"
                    : "hover:bg-[color-mix(in_srgb,var(--text-primary)_8%,transparent)]"
                }`}
              >
                <Shield size={16} />
              </Link>
            </Tooltip>
          </div>
        ) : null}
      </motion.aside>
    );
  }

  /* ── Expanded: full sidebar ────────────────────────────────────── */
  return (
    <motion.aside
      key="expanded"
      initial={{ x: "-100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "-100%", opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"
      aria-busy={isCreatingConversation}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-3 py-2 sm:px-4">
        <Tooltip
          content="Iniciar una nueva conversación"
          placement="right"
          wrapperClassName="min-w-0 flex-1"
        >
          <button
            type="button"
            onClick={createConversation}
            className="styled-button styled-button-full whitespace-nowrap disabled:opacity-70"
            aria-label={isCreatingConversation ? "Creando conversación" : "Nueva conversación"}
            disabled={isCreatingConversation}
            aria-disabled={isCreatingConversation}
          >
            {isCreatingConversation ? <Loader2 size={16} className="animate-spin text-muted" /> : <MessageSquarePlus size={18} />}
            {isCreatingConversation ? "Creando conversación..." : "Nueva conversación"}
          </button>
        </Tooltip>

        {onToggleCollapse ? (
          <Tooltip content="Colapsar sidebar" placement="right" delay={500} wrapperClassName="shrink-0">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="styled-button styled-button-icon shrink-0"
              aria-label="Colapsar sidebar"
              aria-pressed={true}
            >
              <ChevronLeft size={16} />
            </button>
          </Tooltip>
        ) : null}
      </div>

      {/* Content */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-2.5 sm:px-4 sm:py-3">
        {/* Observability link */}
        <Tooltip content="Dashboard de observabilidad del agente" placement="right" wrapperClassName="mb-2.5 w-full sm:mb-3">
          <Link
            href="/observability"
            aria-label="Dashboard"
            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors duration-200 sm:px-3 sm:py-2 sm:text-sm ${
              pathname.startsWith("/observability")
                ? "bg-[var(--primary)] text-[var(--text-on-primary)]"
                : "hover:bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)]"
            }`}
          >
            <BarChart3 size={15} className="shrink-0" />
            Dashboard
          </Link>
        </Tooltip>

        {/* MCP Servers */}
        <McpServers isCollapsed={false} />

        {/* Workspace label */}
        <Tooltip
          content="Sesiones compartidas — todo el equipo puede ver y continuar estas conversaciones"
          placement="top"
          delay={600}
          wrapperClassName="block"
        >
          <p className="mb-1.5 cursor-default text-[11px] uppercase tracking-wide text-muted">Workspace</p>
        </Tooltip>

        {/* Sessions list */}
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-0.5">
          {isLoading ? (
            <>
              <div className="h-10 animate-pulse rounded-lg bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] sm:h-12" />
              <div className="h-10 animate-pulse rounded-lg bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] sm:h-12" />
              <div className="h-10 animate-pulse rounded-lg bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] sm:h-12" />
            </>
          ) : error ? (
            <p className="text-sm text-[var(--error)]">{error}</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted">Historial de sesiones deshabilitado temporalmente.</p>
          ) : (
            <AnimatePresence initial={false}>
              {sessions.map((session) => {
                const isActive = pathname === `/chat/${session.sessionKey}`;

                return (
                <motion.div
                  key={session.sessionKey}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.2 }}
                  className={`rounded-lg px-2.5 py-1.5 text-[13px] transition-colors duration-200 sm:px-3 sm:py-2 sm:text-sm ${
                    isActive
                      ? "bg-[var(--primary)] text-[var(--text-on-primary)]"
                      : "hover:bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)]"
                  }`}
                >
                  <Link href={`/chat/${session.sessionKey}`} className="block">
                    <Tooltip content={session.title} placement="top" delay={700} wrapperClassName="block w-full min-w-0">
                      <p className="truncate font-medium">{session.title}</p>
                    </Tooltip>
                    {session.updatedAt ? (
                      <Tooltip content="Última actividad en esta sesión" placement="top" delay={700} wrapperClassName="block w-full min-w-0">
                        <p className={`truncate text-xs ${isActive ? "text-white/70" : "text-muted"}`}>
                          {session.updatedAt}
                        </p>
                      </Tooltip>
                    ) : null}
                  </Link>
                  <div className="mt-1 flex gap-1 sm:mt-1.5">
                    <Tooltip content={`Renombrar ${session.title}`} placement="top" delay={450} wrapperClassName="block">
                      <button
                        type="button"
                        onClick={() => void renameConversation(session.sessionKey, session.title)}
                        className={`rounded p-1 transition-colors duration-150 ${isActive ? "text-white/70 hover:text-white" : "text-muted hover:text-[var(--text-primary)]"}`}
                        aria-label={`Renombrar ${session.title}`}
                      >
                        <Pencil size={12} />
                      </button>
                    </Tooltip>
                    <Tooltip content={`Eliminar ${session.title}`} placement="top" delay={450} wrapperClassName="block">
                      <button
                        type="button"
                        onClick={() => void deleteConversation(session.sessionKey)}
                        className={`rounded p-1 transition-colors duration-150 ${isActive ? "text-white/70 hover:text-white" : "text-muted hover:text-[var(--error)]"}`}
                        aria-label={`Eliminar ${session.title}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </Tooltip>
                  </div>
                </motion.div>
              );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Admin footer */}
      {isAdmin ? (
        <div className="shrink-0 border-t border-[var(--border)] px-3 py-2.5 sm:px-4 sm:py-3">
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">Admin</p>
          <Tooltip content="Administración de usuarios del sistema" placement="top" wrapperClassName="block w-full">
            <Link
              href="/admin/users"
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors duration-200 sm:px-3 sm:py-2 sm:text-sm ${
                pathname === "/admin/users"
                  ? "bg-[var(--primary)] text-[var(--text-on-primary)]"
                  : "hover:bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)]"
              }`}
            >
              <Shield size={15} className="shrink-0" />
              Usuarios
            </Link>
          </Tooltip>
        </div>
      ) : null}
    </motion.aside>
  );
};

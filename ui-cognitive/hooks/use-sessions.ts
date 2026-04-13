"use client";

import { useCallback, useEffect, useState } from "react";

import { normalizeSessions, SessionRow } from "@/lib/session-normalizers";

const SESSIONS_CACHE_TTL_MS = 60_000;

let sessionsCache: SessionRow[] = normalizeSessions({ sessions: [] });
let sessionsCacheError: string | null = null;
let sessionsCacheAt = 0;
let sessionsInflight: Promise<{ sessions: SessionRow[]; error: string | null }> | null = null;

const hasFreshSessionsCache = () => Date.now() - sessionsCacheAt < SESSIONS_CACHE_TTL_MS;

const loadSessions = async () => {
  const response = await fetch("/api/sessions", { method: "GET", cache: "no-store" });
  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const source = payload as { error?: unknown };
    throw new Error(typeof source.error === "string" ? source.error : "No se pudieron cargar sesiones");
  }

  return normalizeSessions(payload);
};

export const __resetSessionsCacheForTests = () => {
  sessionsCache = normalizeSessions({ sessions: [] });
  sessionsCacheError = null;
  sessionsCacheAt = 0;
  sessionsInflight = null;
};

export const useSessions = () => {
  const [sessions, setSessions] = useState<SessionRow[]>(() => sessionsCache);
  const [isLoading, setIsLoading] = useState(() => !hasFreshSessionsCache());
  const [error, setError] = useState<string | null>(() => sessionsCacheError);

  const refresh = useCallback(async (force = false) => {
    if (!force && hasFreshSessionsCache()) {
      setSessions(sessionsCache);
      setError(sessionsCacheError);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    if (force) {
      setError(null);
    }

    try {
      if (!sessionsInflight || force) {
        sessionsInflight = (async () => {
          try {
            const nextSessions = await loadSessions();
            sessionsCache = nextSessions;
            sessionsCacheError = null;
            sessionsCacheAt = Date.now();
            return { sessions: nextSessions, error: null as string | null };
          } catch (loadError) {
            const message = loadError instanceof Error ? loadError.message : "No se pudieron cargar sesiones";
            sessionsCache = normalizeSessions({ sessions: [] });
            sessionsCacheError = message;
            sessionsCacheAt = Date.now();
            return { sessions: sessionsCache, error: message };
          } finally {
            sessionsInflight = null;
          }
        })();
      }

      const result = await sessionsInflight;
      setSessions(result.sessions);
      setError(result.error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { sessions, isLoading, error, refresh, setError };
};

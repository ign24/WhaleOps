"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpsContainer } from "@/types/ops";

const REFRESH_INTERVAL_MS = 30_000;

export type OpsStatusState = {
  containers: OpsContainer[];
  isLoading: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
};

export const useOpsStatus = (): OpsStatusState => {
  const [containers, setContainers] = useState<OpsContainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async (force = false) => {
    if (!force) setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/ops/status");
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? `Error ${res.status}`);
        setContainers([]);
      } else {
        const data = (await res.json()) as { containers: OpsContainer[] };
        setContainers(data.containers ?? []);
        setError(null);
      }
    } catch {
      setError("No se pudo conectar con el servidor");
      setContainers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const id = setInterval(() => void fetchStatus(), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchStatus]);

  return { containers, isLoading, error, refresh: fetchStatus };
};

"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpsNote } from "@/types/ops";

const REFRESH_INTERVAL_MS = 60_000;

export type OpsNotesState = {
  notes: OpsNote[];
  isLoading: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
};

export const useOpsNotes = (params?: {
  limit?: number;
  note_type?: string;
  container_name?: string;
}): OpsNotesState => {
  const [notes, setNotes] = useState<OpsNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async (force = false) => {
    if (!force) setError(null);
    setIsLoading(true);
    try {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.note_type) searchParams.set("note_type", params.note_type);
      if (params?.container_name) searchParams.set("container_name", params.container_name);
      const qs = searchParams.toString();
      const url = qs ? `/api/ops/notes?${qs}` : "/api/ops/notes";

      const res = await fetch(url);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? `Error ${res.status}`);
        setNotes([]);
      } else {
        const data = (await res.json()) as { notes: OpsNote[] };
        setNotes(data.notes ?? []);
        setError(null);
      }
    } catch {
      setError("No se pudo conectar con el servidor");
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.limit, params?.note_type, params?.container_name]);

  useEffect(() => {
    void fetchNotes();
    const id = setInterval(() => void fetchNotes(), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchNotes]);

  return { notes, isLoading, error, refresh: fetchNotes };
};

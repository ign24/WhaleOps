"use client";

import { useCallback, useEffect, useState } from "react";
import { getThinkingVariant, NEMOTRON_THINKING_KEY } from "@/lib/model-registry";
import type { InferencePrefs, TemperaturePreset } from "@/types/chat";

const STORAGE_KEY = "openclaw:inference-prefs";

const DEFAULT_PREFS: InferencePrefs = {
  model: "devstral",
  temperaturePreset: "medium",
  thinking: false,
};

function readFromStorage(): InferencePrefs {
  if (typeof window === "undefined") {
    return DEFAULT_PREFS;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_PREFS;
    }
    const parsed = JSON.parse(raw) as Partial<InferencePrefs>;
    return {
      model: parsed.model ?? DEFAULT_PREFS.model,
      temperaturePreset: parsed.temperaturePreset ?? DEFAULT_PREFS.temperaturePreset,
      thinking: parsed.thinking ?? DEFAULT_PREFS.thinking,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writeToStorage(prefs: InferencePrefs): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable — proceed without persistence
  }
}

export type UseInferencePrefsReturn = {
  prefs: InferencePrefs;
  /** The resolved model key to send in the request (handles thinking variant). */
  resolvedModelKey: string;
  setModel: (model: string) => void;
  setTemperaturePreset: (preset: TemperaturePreset) => void;
  toggleThinking: () => void;
};

export function useInferencePrefs(): UseInferencePrefsReturn {
  // Keep first render deterministic for SSR/CSR hydration.
  // Storage is loaded after mount to avoid text mismatches (e.g. Devstral vs Nemotron).
  const [prefs, setPrefs] = useState<InferencePrefs>(DEFAULT_PREFS);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPrefs(readFromStorage());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const updatePrefs = useCallback((patch: Partial<InferencePrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      writeToStorage(next);
      return next;
    });
  }, []);

  const setModel = useCallback(
    (model: string) => {
      // When switching to a model that doesn't support thinking, reset thinking flag
      const thinkingVariant = getThinkingVariant(model);
      updatePrefs({ model, thinking: thinkingVariant !== null ? prefs.thinking : false });
    },
    [prefs.thinking, updatePrefs],
  );

  const setTemperaturePreset = useCallback(
    (temperaturePreset: TemperaturePreset) => {
      updatePrefs({ temperaturePreset });
    },
    [updatePrefs],
  );

  const toggleThinking = useCallback(() => {
    const thinkingVariant = getThinkingVariant(prefs.model);
    if (thinkingVariant === null) {
      // Model doesn't support thinking — no-op (caller handles the warning)
      return;
    }
    updatePrefs({ thinking: !prefs.thinking });
  }, [prefs.model, prefs.thinking, updatePrefs]);

  // The actual model key to send to the backend
  const resolvedModelKey =
    prefs.thinking && getThinkingVariant(prefs.model) !== null
      ? NEMOTRON_THINKING_KEY
      : prefs.model;

  return { prefs, resolvedModelKey, setModel, setTemperaturePreset, toggleThinking };
}

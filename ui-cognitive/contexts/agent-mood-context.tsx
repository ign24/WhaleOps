"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { AgentMood } from "@/types/chat";

type AgentMoodContextValue = {
  mood: AgentMood;
  setMood: (mood: AgentMood) => void;
};

const AgentMoodContext = createContext<AgentMoodContextValue>({
  mood: "idle",
  setMood: () => {},
});

export const AgentMoodProvider = ({ children }: { children: React.ReactNode }) => {
  const [mood, setMoodState] = useState<AgentMood>("idle");

  const setMood = useCallback((next: AgentMood) => {
    setMoodState(next);
  }, []);

  const value = useMemo(() => ({ mood, setMood }), [mood, setMood]);

  return <AgentMoodContext.Provider value={value}>{children}</AgentMoodContext.Provider>;
};

export const useAgentMood = (): AgentMood => {
  return useContext(AgentMoodContext).mood;
};

export const useSetAgentMood = (): ((mood: AgentMood) => void) => {
  return useContext(AgentMoodContext).setMood;
};

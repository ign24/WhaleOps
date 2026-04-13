"use client";

import { BrainCircuit } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Tooltip } from "@/components/ui/tooltip";
import {
  isBackgroundMotionEnabledSnapshot,
  setBackgroundMotionEnabled,
  subscribeBackgroundMotion,
} from "@/lib/background-motion";

const getBackgroundMotionServerSnapshot = () => true;

export const BackgroundMotionToggle = () => {
  const isEnabled = useSyncExternalStore(
    subscribeBackgroundMotion,
    isBackgroundMotionEnabledSnapshot,
    getBackgroundMotionServerSnapshot,
  );

  const toggle = () => {
    setBackgroundMotionEnabled(!isEnabled);
  };

  const actionLabel = isEnabled ? "Usar fondo estático" : "Usar fondo animado";

  return (
    <Tooltip content={actionLabel}>
      <button
        type="button"
        onClick={toggle}
        className="styled-button styled-button-icon"
        aria-label={actionLabel}
        aria-pressed={isEnabled}
      >
        <BrainCircuit size={16} className={isEnabled ? "opacity-100" : "opacity-55"} />
      </button>
    </Tooltip>
  );
};

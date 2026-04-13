"use client";

import { Moon, Sun } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

const storageKey = "cgn-agent-theme";
const legacyStorageKey = "cognitive-theme";

export const ThemeToggle = () => {
  const toggle = () => {
    const isDark = document.documentElement.classList.contains("dark");
    const nextIsDark = !isDark;

    document.documentElement.classList.toggle("dark", nextIsDark);
    localStorage.setItem(storageKey, nextIsDark ? "dark" : "light");
    localStorage.removeItem(legacyStorageKey);
  };

  return (
    <Tooltip content="Cambiar tema">
      <button
        type="button"
        onClick={toggle}
        className="styled-button styled-button-icon"
        aria-label="Cambiar tema"
      >
        <Sun size={18} className="hidden dark:block" />
        <Moon size={18} className="block dark:hidden" />
      </button>
    </Tooltip>
  );
};

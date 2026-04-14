"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";

import { Sidebar } from "@/components/layout/sidebar";

type SidebarShellProps = {
  isAdmin: boolean;
  logoutAction?: () => Promise<void>;
  children: React.ReactNode;
};

const SIDEBAR_COLLAPSED_KEY = "cgn.sidebar.collapsed";

export const SidebarShell = ({ isAdmin, logoutAction, children }: SidebarShellProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: must sync localStorage after mount
      setIsCollapsed(true);
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((previous) => {
      const next = !previous;
      globalThis.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <section
      className={`grid h-full min-h-0 grid-cols-1 gap-6 overflow-hidden transition-[grid-template-columns] duration-300 ease-in-out ${
        isCollapsed ? "lg:grid-cols-[64px_1fr]" : "lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr]"
      }`}
    >
      <div className="hidden overflow-hidden lg:block lg:h-full lg:min-h-0">
        <AnimatePresence mode="wait">
          <Sidebar
            key={isCollapsed ? "collapsed" : "expanded"}
            isAdmin={isAdmin}
            logoutAction={logoutAction}
            isCollapsed={isCollapsed}
            onToggleCollapse={toggleCollapse}
          />
        </AnimatePresence>
      </div>
      <div className="h-full min-h-0 overflow-hidden">{children}</div>
    </section>
  );
};

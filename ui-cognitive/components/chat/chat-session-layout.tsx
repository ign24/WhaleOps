"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { ActivityPanel } from "@/components/activity/activity-panel";
import { FolderCard } from "@/components/activity/folder-card";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Tooltip } from "@/components/ui/tooltip";
import { ActivityEntry } from "@/types/chat";

export type ChatSessionLayoutProps = {
  sessionKey: string;
};

type PanelMode = "live" | { messageId: string };

const PANEL_STORAGE_KEY = "chat:activity-panel-open";
const PANEL_STORAGE_EVENT = "chat:activity-panel-open:changed";
const ACTIVITY_PANEL_WIDTH = 380;

const subscribePanelState = (onStoreChange: () => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const notify = () => onStoreChange();
  window.addEventListener("storage", notify);
  window.addEventListener(PANEL_STORAGE_EVENT, notify);

  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(PANEL_STORAGE_EVENT, notify);
  };
};

const getPanelStateSnapshot = () => {
  if (typeof window === "undefined") {
    return true;
  }

  const persistedValue = window.localStorage.getItem(PANEL_STORAGE_KEY);
  if (persistedValue === "0") {
    return false;
  }
  if (persistedValue === "1") {
    return true;
  }

  return window.innerWidth >= 1024;
};

const getPanelStateServerSnapshot = () => true;

const setPanelState = (open: boolean) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PANEL_STORAGE_KEY, open ? "1" : "0");
  window.dispatchEvent(new Event(PANEL_STORAGE_EVENT));
};

// Merge new entries into accumulated workspace entries (dedup by id, update existing)
const mergeWorkspaceEntries = (prev: ActivityEntry[], next: ActivityEntry[]): ActivityEntry[] => {
  if (next.length === 0) return prev;
  const byId = new Map(prev.map((e) => [e.id, e]));
  for (const entry of next) {
    byId.set(entry.id, entry);
  }
  return Array.from(byId.values());
};

export const ChatSessionLayout = ({ sessionKey }: ChatSessionLayoutProps) => {
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [selectedModelKey, setSelectedModelKey] = useState<string | null>(null);
  // workspaceLog accumulates entries across messages — never reset, only merged
  const [workspaceLog, setWorkspaceLog] = useState<ActivityEntry[]>([]);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const isActivityOpen = useSyncExternalStore(
    subscribePanelState,
    getPanelStateSnapshot,
    getPanelStateServerSnapshot,
  );
  const [panelMode, setPanelMode] = useState<PanelMode>("live");
  const [historicalEntries, setHistoricalEntries] = useState<ActivityEntry[]>([]);
  const [isLiveSending, setIsLiveSending] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : false,
  );

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const panelEntries = useMemo(
    () => (panelMode === "live" ? activityLog : historicalEntries),
    [activityLog, historicalEntries, panelMode],
  );

  // Intercept activity events: forward to activityLog (resets normally) and
  // separately accumulate into workspaceLog (never cleared between messages)
  const handleActivityEvent = useCallback(
    (update: ActivityEntry[] | ((prev: ActivityEntry[]) => ActivityEntry[])) => {
      if (Array.isArray(update) && update.length === 0) {
        // Reset incoming — snapshot current activityLog into workspaceLog first
        setActivityLog((prev) => {
          if (prev.length > 0) {
            setWorkspaceLog((wsPrev) => mergeWorkspaceEntries(wsPrev, prev));
          }
          return [];
        });
        return;
      }
      // Incremental update — accumulate into workspaceLog
      setActivityLog((prev) => {
        const next = typeof update === "function" ? update(prev) : update;
        if (next.length > 0) {
          setWorkspaceLog((wsPrev) => mergeWorkspaceEntries(wsPrev, next));
        }
        return next;
      });
    },
    [],
  );

  const handleSendingChange = (isSending: boolean) => {
    setIsLiveSending(isSending);
    if (isSending) {
      setPanelMode("live");
    }
  };

  const handleToggleActivity = () => {
    setPanelState(!isActivityOpen);
  };

  const handleOpenHistorical = (messageId: string, entries: ActivityEntry[]) => {
    setHistoricalEntries(entries);
    setPanelMode({ messageId });
    setPanelState(true);
  };

  const handleHistoryLoaded = (entries: ActivityEntry[]) => {
    setWorkspaceLog(entries);
  };


  return (
    <>
      <div
        data-testid="chat-session-layout-grid"
        className="flex h-full min-h-0 gap-6 overflow-hidden"
      >
        <div className="relative min-w-0 min-h-0 flex-1">
          <div className="absolute right-2 top-2 z-10 inline-flex items-center gap-1">
            <Tooltip
              content={isActivityOpen ? "Ocultar panel de actividad" : "Mostrar panel de actividad"}
              placement="left"
              delay={450}
            >
              <button
                type="button"
                onClick={handleToggleActivity}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)]/90 px-2 py-1 text-xs text-muted backdrop-blur-sm hover:bg-[var(--surface)]"
                aria-label={isActivityOpen ? "Ocultar actividad" : "Mostrar actividad"}
                aria-pressed={isActivityOpen}
              >
                {isActivityOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
                <span className="hidden sm:inline">Actividad</span>
              </button>
            </Tooltip>

          </div>
          <ChatPanel
            sessionKey={sessionKey}
            activityLog={activityLog}
            onActivityEvent={handleActivityEvent}
            activeTool={activeTool}
            onActiveToolChange={setActiveTool}
            onToggleActivity={handleToggleActivity}
            isActivityOpen={isActivityOpen}
            onOpenHistoricalActivity={handleOpenHistorical}
            onSendingChange={handleSendingChange}
            onModelResolvedChange={setSelectedModelKey}
            onHistoryLoaded={handleHistoryLoaded}
          />
        </div>

        <AnimatePresence initial={false}>
          {isActivityOpen && isDesktop ? (
            /* shell anima su propio ancho; overflow-hidden clips el x-slide interior */
            <motion.div
              key="activity-desktop-shell"
              className="h-full min-h-0 shrink-0 overflow-hidden"
              initial={{ width: 0 }}
              animate={{ width: ACTIVITY_PANEL_WIDTH }}
              exit={{ width: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <motion.div
                initial={{ x: ACTIVITY_PANEL_WIDTH }}
                animate={{ x: 0 }}
                exit={{ x: ACTIVITY_PANEL_WIDTH }}
                transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
                className="flex h-full min-h-0 flex-col gap-6"
                style={{ width: ACTIVITY_PANEL_WIDTH }}
              >
                <div className="shrink-0 max-h-[520px]">
                  <FolderCard isLive={panelMode === "live" && isLiveSending} />
                </div>
                <div className="flex-1 min-h-0">
                  <ActivityPanel
                    entries={panelEntries}
                    workspaceEntries={panelMode === "live" ? workspaceLog : historicalEntries}
                    activeTool={activeTool}
                    isLive={panelMode === "live" && isLiveSending}
                    selectedModelKey={panelMode === "live" ? selectedModelKey : null}
                    onClose={handleToggleActivity}
                    canGoBackToLive={panelMode !== "live"}
                    onBackToLive={() => setPanelMode("live")}
                  />
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isActivityOpen && !isDesktop ? (
          <motion.div
            key="activity-mobile"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 bottom-0 top-14 z-40"
            role="dialog"
            aria-modal="true"
          >
            {/* backdrop tap to close */}
            <button
              type="button"
              className="absolute inset-0"
              aria-label="Cerrar actividad"
              onClick={handleToggleActivity}
            />

            {/* drawer: desliza desde la derecha */}
            <div className="absolute inset-y-0 right-0 w-[88vw] max-w-sm overflow-hidden">
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
                className="flex h-full w-full flex-col gap-4 py-2 pr-2"
              >
                <div className="shrink-0 max-h-[40%]">
                  <FolderCard isLive={panelMode === "live" && isLiveSending} />
                </div>
                <div className="flex-1 min-h-0">
                  <ActivityPanel
                    entries={panelEntries}
                    workspaceEntries={panelMode === "live" ? workspaceLog : historicalEntries}
                    activeTool={activeTool}
                    isLive={panelMode === "live" && isLiveSending}
                    selectedModelKey={panelMode === "live" ? selectedModelKey : null}
                    onClose={handleToggleActivity}
                    canGoBackToLive={panelMode !== "live"}
                    onBackToLive={() => setPanelMode("live")}
                  />
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
};

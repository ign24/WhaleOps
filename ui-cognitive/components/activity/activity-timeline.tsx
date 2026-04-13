"use client";

import { useEffect, useRef } from "react";

import { TimelineEntry } from "@/components/activity/timeline-entry";
import { ActivityEntry } from "@/types/chat";

type ActivityTimelineProps = {
  entries: ActivityEntry[];
  activeTool: string | null;
  isLive: boolean;
};

export const ActivityTimeline = ({ entries, activeTool, isLive }: ActivityTimelineProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isLive) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [entries, isLive]);

  if (entries.length === 0) {
    return (
      <div className="flex h-full min-h-32 items-center justify-center p-4 text-sm text-muted">
        Sin actividad todavía
      </div>
    );
  }

  const visible = entries.filter((entry) => entry.kind !== "lifecycle");

  return (
    <div ref={containerRef} className="chat-scrollbar h-full min-h-0 overflow-y-auto px-4 py-3">
      <ul className="space-y-2">
        {visible.map((entry, index) => (
          <TimelineEntry
            key={`${entry.id}-${index}`}
            entry={entry}
            isActiveTool={activeTool === entry.label}
            isLast={index === visible.length - 1}
          />
        ))}
      </ul>
    </div>
  );
};

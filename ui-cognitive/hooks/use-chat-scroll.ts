"use client";

import { useCallback, useRef, useState } from "react";

const AUTO_SCROLL_THRESHOLD_PX = 70;

export const useChatScroll = () => {
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesBottomRef = useRef<HTMLDivElement | null>(null);

  const resolveScrollBehavior = useCallback((behavior?: ScrollBehavior): ScrollBehavior => {
    if (behavior) {
      return behavior;
    }

    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    }

    return "smooth";
  }, []);

  const scrollToBottom = useCallback(
    (behavior?: ScrollBehavior) => {
      messagesBottomRef.current?.scrollIntoView({ behavior: resolveScrollBehavior(behavior), block: "end" });
    },
    [resolveScrollBehavior],
  );

  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
    return remaining < AUTO_SCROLL_THRESHOLD_PX;
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollToBottom(remaining > AUTO_SCROLL_THRESHOLD_PX);
  }, []);

  return {
    showScrollToBottom,
    messagesContainerRef,
    messagesBottomRef,
    scrollToBottom,
    isNearBottom,
    handleMessagesScroll,
  };
};

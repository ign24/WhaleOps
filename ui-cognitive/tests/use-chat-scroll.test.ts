// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useChatScroll } from "@/hooks/use-chat-scroll";

describe("useChatScroll", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses smooth scroll by default", () => {
    const matchMediaMock = vi.fn().mockReturnValue({ matches: false });
    vi.stubGlobal("matchMedia", matchMediaMock);
    Object.defineProperty(window, "matchMedia", { writable: true, value: matchMediaMock });

    const { result } = renderHook(() => useChatScroll());
    const scrollIntoView = vi.fn();
    result.current.messagesBottomRef.current = { scrollIntoView } as unknown as HTMLDivElement;

    act(() => {
      result.current.scrollToBottom();
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "end" });
  });

  it("falls back to auto scroll when reduced motion is enabled", () => {
    const matchMediaMock = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal("matchMedia", matchMediaMock);
    Object.defineProperty(window, "matchMedia", { writable: true, value: matchMediaMock });

    const { result } = renderHook(() => useChatScroll());
    const scrollIntoView = vi.fn();
    result.current.messagesBottomRef.current = { scrollIntoView } as unknown as HTMLDivElement;

    act(() => {
      result.current.scrollToBottom();
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "end" });
  });

  it("keeps explicit behavior overrides", () => {
    const { result } = renderHook(() => useChatScroll());
    const scrollIntoView = vi.fn();
    result.current.messagesBottomRef.current = { scrollIntoView } as unknown as HTMLDivElement;

    act(() => {
      result.current.scrollToBottom("auto");
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "end" });
  });

  it("updates scroll-to-bottom button visibility from container distance", () => {
    const { result } = renderHook(() => useChatScroll());

    result.current.messagesContainerRef.current = {
      scrollHeight: 1000,
      scrollTop: 320,
      clientHeight: 500,
    } as HTMLDivElement;

    act(() => {
      result.current.handleMessagesScroll();
    });

    expect(result.current.showScrollToBottom).toBe(true);

    result.current.messagesContainerRef.current = {
      scrollHeight: 1000,
      scrollTop: 440,
      clientHeight: 500,
    } as HTMLDivElement;

    act(() => {
      result.current.handleMessagesScroll();
    });

    expect(result.current.showScrollToBottom).toBe(false);
    expect(result.current.isNearBottom()).toBe(true);
  });
});

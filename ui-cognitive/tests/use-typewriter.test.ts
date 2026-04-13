// @vitest-environment happy-dom

/**
 * Tests for use-typewriter hook — granular streaming events §6
 *
 * 6.1 RED: small deltas (≤40 chars) bypass queue during active streaming
 *          → displayedContent updates without a rAF cycle
 * 6.2 RED: large deltas (>40 chars) use existing queue path
 *          → rAF is scheduled, content not immediately shown
 * 6.3 RED: queue drains at fast-drain rate after streaming ends
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useTypewriter } from "@/hooks/use-typewriter";

// Track pending rAF callbacks — lets us verify whether the hook scheduled a
// paint cycle or appended directly.
const pendingRafs: Array<(t: number) => void> = [];
let rafHandle = 0;

const flushRafs = (timestamp = 100) => {
  const callbacks = [...pendingRafs];
  pendingRafs.length = 0;
  for (const cb of callbacks) cb(timestamp);
};

beforeEach(() => {
  pendingRafs.length = 0;
  rafHandle = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => {
    rafHandle += 1;
    pendingRafs.push(cb);
    return rafHandle;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 6.1 — small-delta bypass during active streaming
// ---------------------------------------------------------------------------
describe("useTypewriter — small-delta bypass during streaming (6.1)", () => {
  it("appends a ≤40-char delta directly without scheduling a rAF", () => {
    // "hello " has a space so it would normally enter the word queue.
    // With bypass it should be appended directly and no rAF queued.
    const SMALL = "hello "; // 6 chars — well within the 40-char limit
    const { result, rerender } = renderHook(
      ({ content, isStreaming }) => useTypewriter({ content, isStreaming }),
      { initialProps: { content: "", isStreaming: true } },
    );

    act(() => {
      rerender({ content: SMALL, isStreaming: true });
    });

    // With bypass: no rAF needed, content is immediately visible.
    expect(result.current.displayedContent).toBe(SMALL);
    expect(pendingRafs).toHaveLength(0);
  });

  it("isVisualStreaming stays true while isStreaming is true after bypass append", () => {
    const { result, rerender } = renderHook(
      ({ content, isStreaming }) => useTypewriter({ content, isStreaming }),
      { initialProps: { content: "", isStreaming: true } },
    );

    act(() => {
      rerender({ content: "hi ", isStreaming: true });
    });

    expect(result.current.isVisualStreaming).toBe(true);
  });

  it("accumulates multiple small bypass appends correctly", () => {
    const { result, rerender } = renderHook(
      ({ content, isStreaming }) => useTypewriter({ content, isStreaming }),
      { initialProps: { content: "", isStreaming: true } },
    );

    act(() => { rerender({ content: "foo ", isStreaming: true }); });
    act(() => { rerender({ content: "foo bar ", isStreaming: true }); });
    act(() => { rerender({ content: "foo bar baz ", isStreaming: true }); });

    expect(result.current.displayedContent).toBe("foo bar baz ");
    // No rAF cycles needed for small sequential deltas
    expect(pendingRafs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6.2 — large deltas (>40 chars) use the existing word queue
// ---------------------------------------------------------------------------
describe("useTypewriter — large delta uses queue (6.2)", () => {
  it("schedules a rAF for a >40-char delta and does not display it immediately", () => {
    // 50 chars — just above the 40-char threshold, with spaces so words enter queue
    const LARGE = "alpha beta gamma delta epsilon zeta eta theta "; // > 40 chars

    const { result, rerender } = renderHook(
      ({ content, isStreaming }) => useTypewriter({ content, isStreaming }),
      { initialProps: { content: "", isStreaming: true } },
    );

    act(() => {
      rerender({ content: LARGE, isStreaming: true });
    });

    // Large delta must not be displayed immediately — it goes through the queue
    expect(result.current.displayedContent).not.toBe(LARGE);
    // A rAF should have been scheduled to drain the queue
    expect(pendingRafs.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 6.3 — queue drains after streaming ends
// ---------------------------------------------------------------------------
describe("useTypewriter — fast-drain after streaming ends (6.3)", () => {
  it("drains queue fully once isStreaming flips to false", () => {
    // Sentence with multiple words — will build a queue
    const CONTENT = "one two three four five six seven eight nine ten";

    const { result, rerender } = renderHook(
      ({ content, isStreaming }) => useTypewriter({ content, isStreaming }),
      { initialProps: { content: "", isStreaming: true } },
    );

    // Feed content while streaming (goes through queue)
    act(() => {
      rerender({ content: CONTENT, isStreaming: true });
    });

    // Flip streaming off — this should trigger fast-drain path
    act(() => {
      rerender({ content: CONTENT, isStreaming: false });
    });

    // Flush rAF repeatedly to drain all queued words
    act(() => {
      for (let i = 0; i < 30; i++) flushRafs(100 + i * 17);
    });

    // All content should be visible and streaming should have stopped
    expect(result.current.displayedContent).toBe(CONTENT);
    expect(result.current.isVisualStreaming).toBe(false);
  });

  it("isVisualStreaming remains true while queue is non-empty after streaming ends", () => {
    const CONTENT = "alpha beta gamma delta epsilon zeta eta theta";

    const { result, rerender } = renderHook(
      ({ content, isStreaming }) => useTypewriter({ content, isStreaming }),
      { initialProps: { content: "", isStreaming: true } },
    );

    act(() => {
      rerender({ content: CONTENT, isStreaming: true });
    });

    act(() => {
      rerender({ content: CONTENT, isStreaming: false });
    });

    // Before draining: still visually streaming
    expect(result.current.isVisualStreaming).toBe(true);

    // Drain completely
    act(() => {
      for (let i = 0; i < 30; i++) flushRafs(100 + i * 17);
    });

    expect(result.current.isVisualStreaming).toBe(false);
  });
});

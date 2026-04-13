import { renderHook, act } from '@testing-library/react';

import { useTypewriter } from '@/hooks/useTypewriter';

// Mock requestAnimationFrame / cancelAnimationFrame
let rafCallbacks: Map<number, FrameRequestCallback> = new Map();
let rafId = 0;

beforeEach(() => {
  rafCallbacks = new Map();
  rafId = 0;

  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    const id = ++rafId;
    rafCallbacks.set(id, cb);
    return id;
  });

  jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => {
    rafCallbacks.delete(id);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Flush N rAF frames, each with a timestamp 16ms apart */
function flushFrames(count: number, startTimestamp = 0) {
  for (let i = 0; i < count; i++) {
    const ts = startTimestamp + i * 16;
    const callbacks = Array.from(rafCallbacks.values());
    rafCallbacks.clear();
    act(() => {
      callbacks.forEach((cb) => cb(ts));
    });
  }
}

describe('useTypewriter', () => {
  it('starts with empty displayedContent', () => {
    const { result } = renderHook(() =>
      useTypewriter('', false)
    );
    expect(result.current.displayedContent).toBe('');
    expect(result.current.isDraining).toBe(false);
  });

  it('reveals content word by word while streaming', () => {
    const { result, rerender } = renderHook(
      ({ content, isStreaming }) => useTypewriter(content, isStreaming),
      { initialProps: { content: '', isStreaming: true } }
    );

    // Feed content in
    rerender({ content: 'hello world foo', isStreaming: true });

    // After enough frames, words should appear progressively
    // Slow speed (≤30 words): 1 word per 40ms. Frames at 16ms each.
    // Frame 0 (ts=0):  elapsed=0  < 40 → skip
    // Frame 1 (ts=16): elapsed=16 < 40 → skip
    // Frame 2 (ts=32): elapsed=32 < 40 → skip
    // Frame 3 (ts=48): elapsed=48 > 40 → reveal 1 word
    flushFrames(4);
    expect(result.current.displayedContent).toContain('hello');
    expect(result.current.isDraining).toBe(true);

    // After more frames, more words
    flushFrames(10);
    expect(result.current.displayedContent).toContain('world');
  });

  it('sets isDraining to false when queue is empty and not streaming', () => {
    const { result, rerender } = renderHook(
      ({ content, isStreaming }) => useTypewriter(content, isStreaming),
      { initialProps: { content: 'one two', isStreaming: true } }
    );

    rerender({ content: 'one two', isStreaming: false });

    // Flush many frames to drain remaining words
    flushFrames(50);

    expect(result.current.displayedContent).toBe('one two');
    expect(result.current.isDraining).toBe(false);
  });

  it('resets when content becomes empty string', () => {
    const { result, rerender } = renderHook(
      ({ content, isStreaming }) => useTypewriter(content, isStreaming),
      { initialProps: { content: 'some content here', isStreaming: true } }
    );

    // Partially drain
    flushFrames(5);

    // Reset
    act(() => {
      rerender({ content: '', isStreaming: false });
    });

    expect(result.current.displayedContent).toBe('');
    expect(result.current.isDraining).toBe(false);
  });

  it('cancels rAF on unmount', () => {
    const cancelSpy = jest.spyOn(globalThis, 'cancelAnimationFrame');
    const { result, unmount, rerender } = renderHook(
      ({ content, isStreaming }) => useTypewriter(content, isStreaming),
      { initialProps: { content: '', isStreaming: true } }
    );

    rerender({ content: 'a b c d e', isStreaming: true });
    flushFrames(1); // Start the rAF loop

    unmount();

    expect(cancelSpy).toHaveBeenCalled();
  });

  it('uses fast speed when queue has more than 150 words', () => {
    const manyWords = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');

    const { result, rerender } = renderHook(
      ({ content, isStreaming }) => useTypewriter(content, isStreaming),
      { initialProps: { content: '', isStreaming: true } }
    );

    rerender({ content: manyWords, isStreaming: true });

    // At fast speed (10 words/frame), after 10 frames we should have ~100 words
    flushFrames(10);

    const wordCount = result.current.displayedContent.split(' ').filter(Boolean).length;
    expect(wordCount).toBeGreaterThan(20); // Definitely more than slow speed would give
  });

  it('continues draining after streaming ends before queue is empty', () => {
    const { result, rerender } = renderHook(
      ({ content, isStreaming }) => useTypewriter(content, isStreaming),
      { initialProps: { content: 'a b c d e f g', isStreaming: true } }
    );

    rerender({ content: 'a b c d e f g', isStreaming: true });
    flushFrames(2); // Partially drain

    const partialContent = result.current.displayedContent;

    // Streaming ends before all words shown
    rerender({ content: 'a b c d e f g', isStreaming: false });

    // Should still drain remaining
    flushFrames(30);

    expect(result.current.displayedContent).toBe('a b c d e f g');
    expect(result.current.isDraining).toBe(false);
  });
});

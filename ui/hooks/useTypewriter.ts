import { useEffect, useRef, useState } from 'react';

export interface UseTypewriterResult {
  displayedContent: string;
  isDraining: boolean;
}

/**
 * Returns ms-per-word pace based on queue depth.
 * Short queue → slow, natural feel. Long queue → faster to avoid unbearable waits.
 */
function msPerWord(queueLength: number): number {
  if (queueLength <= 60) return 55;   // ~18 words/sec
  if (queueLength <= 200) return 30;  // ~33 words/sec
  return 15;                          // ~67 words/sec (long response catch-up)
}

/**
 * Simulates a typewriter effect by revealing content word-by-word.
 * Uses requestAnimationFrame for smooth, non-blocking animation.
 * Adaptive speed: drains faster when there are many pending words.
 */
export function useTypewriter(
  content: string,
  isStreaming: boolean,
): UseTypewriterResult {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isDraining, setIsDraining] = useState(false);

  // Refs to avoid stale closures in the rAF loop
  const queueRef = useRef<string[]>([]);
  const displayedRef = useRef('');
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const isStreamingRef = useRef(isStreaming);
  const isDrainingRef = useRef(false);

  // Keep isStreaming ref current
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Reset when content is cleared (new conversation)
  useEffect(() => {
    if (content === '') {
      queueRef.current = [];
      displayedRef.current = '';
      setDisplayedContent('');
      setIsDraining(false);
      isDrainingRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }
  }, [content]);

  // Enqueue new words when content grows
  useEffect(() => {
    if (content === '') return;

    const currentDisplayed = displayedRef.current;

    // Find the new suffix that hasn't been displayed yet
    let newText = '';
    if (content.startsWith(currentDisplayed)) {
      newText = content.slice(currentDisplayed.length);
    } else if (!currentDisplayed) {
      newText = content;
    } else {
      // Content replaced entirely (rare — just queue everything)
      newText = content;
      queueRef.current = [];
      displayedRef.current = '';
      setDisplayedContent('');
    }

    if (!newText) return;

    // Split into words, preserving the space that precedes each non-first word
    const words = newText.split(/(?= )/);
    queueRef.current.push(...words);

    if (!isDrainingRef.current) {
      isDrainingRef.current = true;
      setIsDraining(true);
      scheduleFrame();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  function scheduleFrame() {
    rafRef.current = requestAnimationFrame(onFrame);
  }

  function onFrame(timestamp: number) {
    const elapsed = timestamp - lastFrameTimeRef.current;
    const queue = queueRef.current;

    if (queue.length === 0) {
      isDrainingRef.current = false;
      setIsDraining(false);
      rafRef.current = null;
      return;
    }

    const pace = msPerWord(queue.length);

    // Always throttle by elapsed time — applies regardless of queue depth
    if (elapsed < pace) {
      rafRef.current = requestAnimationFrame(onFrame);
      return;
    }

    lastFrameTimeRef.current = timestamp;

    // Always reveal 1 word at a time — pace controls speed, not batch size
    const word = queue.splice(0, 1)[0];
    const newDisplayed = displayedRef.current + word;
    displayedRef.current = newDisplayed;
    setDisplayedContent(newDisplayed);

    if (queue.length === 0) {
      isDrainingRef.current = false;
      setIsDraining(false);
      rafRef.current = null;
    } else {
      rafRef.current = requestAnimationFrame(onFrame);
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  return { displayedContent, isDraining };
}

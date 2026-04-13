"use client";

import { useEffect, useMemo, useReducer, useRef } from "react";

type UseTypewriterOptions = {
  content: string;
  isStreaming: boolean;
};

type UseTypewriterResult = {
  displayedContent: string;
  isVisualStreaming: boolean;
  isQueueDrained: boolean;
};

type TypewriterState = {
  displayedContent: string;
  isQueueDrained: boolean;
};

type TypewriterAction =
  | { type: "reset" }
  | { type: "append"; chunk: string }
  | { type: "mark-undrained" }
  | { type: "mark-drained"; drained: boolean };

const initialTypewriterState: TypewriterState = {
  displayedContent: "",
  isQueueDrained: true,
};

const typewriterReducer = (state: TypewriterState, action: TypewriterAction): TypewriterState => {
  if (action.type === "reset") {
    return initialTypewriterState;
  }

  if (action.type === "append") {
    if (!action.chunk) {
      return state;
    }
    return {
      displayedContent: state.displayedContent + action.chunk,
      isQueueDrained: false,
    };
  }

  if (action.type === "mark-undrained") {
    if (!state.isQueueDrained) {
      return state;
    }
    return {
      ...state,
      isQueueDrained: false,
    };
  }

  if (action.type === "mark-drained") {
    if (state.isQueueDrained === action.drained) {
      return state;
    }
    return {
      ...state,
      isQueueDrained: action.drained,
    };
  }

  return state;
};

const splitQueuedWords = (buffer: string): { words: string[]; remainder: string } => {
  const parts = buffer.split(" ");
  if (parts.length <= 1) {
    return { words: [], remainder: buffer };
  }

  return {
    words: parts.slice(0, -1).map((part) => `${part} `),
    remainder: parts[parts.length - 1] ?? "",
  };
};

const resolveDrainConfig = (pendingWords: number, isStreaming: boolean): { minFrameMs: number; wordsPerFrame: number } => {
  if (!isStreaming && pendingWords > 0) {
    return { minFrameMs: 16, wordsPerFrame: 10 };
  }

  if (pendingWords <= 30) {
    return { minFrameMs: 40, wordsPerFrame: 1 };
  }

  if (pendingWords <= 150) {
    return { minFrameMs: 16, wordsPerFrame: 3 };
  }

  return { minFrameMs: 16, wordsPerFrame: 10 };
};

export const useTypewriter = ({ content, isStreaming }: UseTypewriterOptions): UseTypewriterResult => {
  const [state, dispatch] = useReducer(typewriterReducer, initialTypewriterState);

  const queueRef = useRef<string[]>([]);
  const remainderRef = useRef("");
  const consumedRef = useRef("");
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);

  useEffect(() => {
    if (content.length === 0) {
      queueRef.current = [];
      remainderRef.current = "";
      consumedRef.current = "";
      dispatch({ type: "reset" });
      return;
    }

    const previousConsumed = consumedRef.current;
    if (!content.startsWith(previousConsumed)) {
      queueRef.current = [];
      remainderRef.current = "";
      consumedRef.current = "";
      dispatch({ type: "reset" });
    }

    const delta = content.slice(consumedRef.current.length);
    if (!delta) {
      if (!isStreaming && queueRef.current.length === 0 && remainderRef.current.length === 0) {
        dispatch({ type: "mark-drained", drained: state.displayedContent === content });
      }
      return;
    }

    consumedRef.current = content;

    // Bypass path: small deltas during active streaming skip the word queue
    // and append directly so each token appears on the next render cycle.
    if (isStreaming && delta.length <= 40) {
      const toAppend = remainderRef.current + delta;
      remainderRef.current = "";
      if (toAppend) {
        dispatch({ type: "append", chunk: toAppend });
      }
      return;
    }

    const parsed = splitQueuedWords(remainderRef.current + delta);
    queueRef.current.push(...parsed.words);
    remainderRef.current = parsed.remainder;

    if (!isStreaming && remainderRef.current.length > 0) {
      queueRef.current.push(remainderRef.current);
      remainderRef.current = "";
    }

    if (queueRef.current.length > 0 || remainderRef.current.length > 0) {
      dispatch({ type: "mark-undrained" });
    }
  }, [content, isStreaming, state.displayedContent]);

  useEffect(() => {
    if (isStreaming) {
      return;
    }

    if (remainderRef.current.length > 0) {
      queueRef.current.push(remainderRef.current);
      remainderRef.current = "";
      dispatch({ type: "mark-undrained" });
    }
  }, [isStreaming]);

  useEffect(() => {
    const drain = (timestamp: number) => {
      if (queueRef.current.length === 0) {
        const done = remainderRef.current.length === 0 && state.displayedContent === content;
        dispatch({ type: "mark-drained", drained: done });
        rafRef.current = null;
        return;
      }

      const { minFrameMs, wordsPerFrame } = resolveDrainConfig(queueRef.current.length, isStreaming);
      if (timestamp - lastTickRef.current >= minFrameMs) {
        lastTickRef.current = timestamp;
        const chunk = queueRef.current.splice(0, wordsPerFrame).join("");
        if (chunk) {
          dispatch({ type: "append", chunk });
        }
      }

      rafRef.current = window.requestAnimationFrame(drain);
    };

    if (queueRef.current.length > 0 && rafRef.current === null) {
      rafRef.current = window.requestAnimationFrame(drain);
    }

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [content, isStreaming, state.displayedContent]);

  const isVisualStreaming = useMemo(() => {
    if (content.length === 0) {
      return false;
    }
    if (isStreaming) {
      return true;
    }
    return !state.isQueueDrained || state.displayedContent.length < content.length;
  }, [content.length, isStreaming, state.displayedContent.length, state.isQueueDrained]);

  return {
    displayedContent: state.displayedContent,
    isVisualStreaming,
    isQueueDrained: state.isQueueDrained,
  };
};

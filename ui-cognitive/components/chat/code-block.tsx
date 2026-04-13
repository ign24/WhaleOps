"use client";

import { memo, useEffect, useState } from "react";

type CodeBlockProps = {
  code: string;
  language: string;
};

const MAX_HIGHLIGHT_CACHE_ENTRIES = 50;
const highlightCache = new Map<string, string>();

const getCurrentTheme = (): "github-dark" | "github-light" => {
  if (typeof document === "undefined") {
    return "github-light";
  }

  return document.documentElement.classList.contains("dark") ? "github-dark" : "github-light";
};

const getFromCache = (key: string): string | null => {
  const cached = highlightCache.get(key);
  if (!cached) {
    return null;
  }

  highlightCache.delete(key);
  highlightCache.set(key, cached);
  return cached;
};

const setInCache = (key: string, value: string): void => {
  if (highlightCache.has(key)) {
    highlightCache.delete(key);
  }

  highlightCache.set(key, value);

  if (highlightCache.size <= MAX_HIGHLIGHT_CACHE_ENTRIES) {
    return;
  }

  const oldestKey = highlightCache.keys().next().value as string | undefined;
  if (oldestKey) {
    highlightCache.delete(oldestKey);
  }
};

const CodeBlockComponent = ({ code, language }: CodeBlockProps) => {
  const [html, setHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<"github-dark" | "github-light">("github-light");

  useEffect(() => {
    setTheme(getCurrentTheme());

    const observer = new MutationObserver(() => {
      setTheme(getCurrentTheme());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setHtml("");
      const cacheKey = `${theme}::${language || "text"}::${code}`;
      const cached = getFromCache(cacheKey);
      if (cached) {
        if (!cancelled) {
          setHtml(cached);
        }
        return;
      }

      try {
        const { codeToHtml } = await import("shiki");
        const highlighted = await codeToHtml(code, {
          lang: language || "text",
          theme,
        });
        if (cancelled) {
          return;
        }

        setInCache(cacheKey, highlighted);
        setHtml(highlighted);
      } catch {
        if (!cancelled) {
          setHtml("");
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [code, language, theme]);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className="code-glass-block chat-rich-block my-3 overflow-hidden rounded-xl border border-[var(--border)]"
      data-chat-block="code"
      data-chat-motion-profile="code"
    >
      <div className="flex items-center justify-between px-4 py-2.5 text-xs text-muted">
        <span className="font-mono">{language || "text"}</span>
        <button type="button" onClick={copy} className="code-copy-button" aria-live="polite">
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>

      {html ? (
        <div className="overflow-x-auto px-4 pb-4 text-sm" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre
          className="overflow-x-auto px-4 py-4 text-sm"
          style={{
            background: "transparent",
            minHeight: "2.5rem",
          }}
        >
          <code className="whitespace-pre opacity-70">{code}</code>
        </pre>
      )}
    </div>
  );
};

export const CodeBlock = memo(CodeBlockComponent);

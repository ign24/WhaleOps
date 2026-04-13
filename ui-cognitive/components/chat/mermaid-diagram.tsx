"use client";

import { memo, useEffect, useState } from "react";

import { CodeBlock } from "@/components/chat/code-block";

type MermaidDiagramProps = {
  content: string;
};

const getTheme = (): "default" | "dark" => {
  if (typeof document === "undefined") {
    return "default";
  }

  return document.documentElement.classList.contains("dark") ? "dark" : "default";
};

const MermaidDiagramComponent = ({ content }: MermaidDiagramProps) => {
  const [theme, setTheme] = useState<"default" | "dark">("default");
  const [svg, setSvg] = useState<string>("");
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    setTheme(getTheme());

    const observer = new MutationObserver(() => {
      setTheme(getTheme());
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
      setSvg("");
      setFallback(false);

      try {
        const mermaidModule = await import("mermaid");
        const mermaidApi = mermaidModule.default;

        mermaidApi.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme,
        });

        await mermaidApi.parse(content);

        const renderId = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
        const rendered = await mermaidApi.render(renderId, content);
        const svgOutput = typeof rendered === "string" ? rendered : rendered.svg;

        if (!cancelled) {
          setSvg(svgOutput);
        }
      } catch {
        if (!cancelled) {
          setFallback(true);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [content, theme]);

  if (fallback) {
    return (
      <div data-testid="mermaid-fallback" className="mermaid-diagram">
        <CodeBlock code={content} language="mermaid" />
      </div>
    );
  }

  return (
    <div data-testid="mermaid-diagram" className="mermaid-diagram">
      {svg ? (
        <div data-testid="mermaid-diagram-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="text-xs text-muted">Renderizando diagrama…</div>
      )}
    </div>
  );
};

export const MermaidDiagram = memo(MermaidDiagramComponent);

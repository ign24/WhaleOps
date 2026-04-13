"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { CodeBlock } from "@/components/chat/code-block";
import { MermaidDiagram } from "@/components/chat/mermaid-diagram";

type MessageMarkdownProps = {
  content: string;
  enhancementState?: "idle" | "active";
};

const EXECUTION_BUDGET_I18N_REPLACEMENTS: Array<[RegExp, string]> = [
  [
    /Execution budget was exhausted before full completion\. Returning partial output\./g,
    "El presupuesto de ejecución se agotó antes de completar toda la tarea. Se devuelve una salida parcial.",
  ],
  [/^##\s+Verified$/gm, "## Verificado"],
  [/^##\s+Unverified$/gm, "## Sin verificar"],
  [/^##\s+Blocked By$/gm, "## Bloqueado por"],
  [/^##\s+Next Steps$/gm, "## Próximos pasos"],
  [
    /No verifiable artifacts were completed before budget exhaustion\./g,
    "No se completaron artefactos verificables antes de agotar el presupuesto.",
  ],
  [/Full repository-wide verification remains incomplete\./g, "La verificación completa del repositorio sigue incompleta."],
  [/Ainvoke fallback failed:/g, "Falló el fallback de Ainvoke:"],
  [
    /Retry with a narrower scope \(single vulnerability class\)\./g,
    "Reintentar con un alcance más acotado (una sola clase de vulnerabilidad).",
  ],
  [
    /Request evidence-only output with file:line and snippet per finding\./g,
    "Solicitar salida solo con evidencia, con archivo:línea y fragmento por hallazgo.",
  ],
];

function localizeExecutionBudgetMessage(content: string): string {
  return EXECUTION_BUDGET_I18N_REPLACEMENTS.reduce(
    (currentContent, [pattern, replacement]) => currentContent.replace(pattern, replacement),
    content,
  );
}

/**
 * Convert single-line $$...$$ to multi-line format so remark-math
 * parses them as display math (block) instead of inline math.
 * LLMs output `$$\frac{a}{b}$$` on one line, but remark-math v6
 * requires `$$` on its own line for display mode.
 */
function preprocessDisplayMath(text: string): string {
  return text.replace(
    /^\$\$(.+?)\$\$$/gm,
    (_, expr) => `$$\n${expr}\n$$`,
  );
}

const MessageMarkdownComponent = ({ content, enhancementState = "idle" }: MessageMarkdownProps) => {
  const localizedContent = localizeExecutionBudgetMessage(content);

  return (
    <div
      className="markdown-body chat-rich-markdown space-y-2 text-sm leading-6"
      data-chat-enhancement={enhancementState}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeSanitize, [rehypeKatex, { throwOnError: false }]]}
        components={{
          p(props) {
            const { children, ...rest } = props;
            return (
              <p className="chat-rich-block" data-chat-block="text" data-chat-motion-profile="text" {...rest}>
                {children}
              </p>
            );
          },
          ul(props) {
            const { children, ...rest } = props;
            return (
              <ul className="chat-rich-block" data-chat-block="list" data-chat-motion-profile="list" {...rest}>
                {children}
              </ul>
            );
          },
          ol(props) {
            const { children, ...rest } = props;
            return (
              <ol className="chat-rich-block" data-chat-block="list" data-chat-motion-profile="list" {...rest}>
                {children}
              </ol>
            );
          },
          blockquote(props) {
            const { children, ...rest } = props;
            return (
              <blockquote
                className="chat-rich-block chat-rich-callout"
                data-chat-block="callout"
                data-chat-motion-profile="callout"
                {...rest}
              >
                {children}
              </blockquote>
            );
          },
          h1(props) {
            const { children, ...rest } = props;
            return (
              <h1 className="chat-rich-block" data-chat-block="heading" data-chat-motion-profile="heading" {...rest}>
                {children}
              </h1>
            );
          },
          h2(props) {
            const { children, ...rest } = props;
            return (
              <h2 className="chat-rich-block" data-chat-block="heading" data-chat-motion-profile="heading" {...rest}>
                {children}
              </h2>
            );
          },
          h3(props) {
            const { children, ...rest } = props;
            return (
              <h3 className="chat-rich-block" data-chat-block="heading" data-chat-motion-profile="heading" {...rest}>
                {children}
              </h3>
            );
          },
          a(props) {
            const { href, children, ...rest } = props;
            const isExternal = typeof href === "string" && /^https?:\/\//i.test(href);

            return (
              <a
                href={href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                {...rest}
              >
                {children}
              </a>
            );
          },
          code(props) {
            const { className, children, ...rest } = props;
            const match = /language-(\w+)/.exec(className || "");
            const code = String(children).replace(/\n$/, "");
            const isBlockWithoutLanguage = !match && code.includes("\n");
            const language = match?.[1]?.toLowerCase() ?? "text";

            if (!match && !isBlockWithoutLanguage) {
              return (
                <code
                  className="inline-code rounded bg-black/10 px-1 py-0.5 text-xs"
                  data-chat-block="text"
                  data-chat-motion-profile="text"
                  {...rest}
                >
                  {children}
                </code>
              );
            }

            if (language === "mermaid") {
              return (
                <div className="chat-rich-block" data-chat-block="code" data-chat-motion-profile="code">
                  <MermaidDiagram content={code} />
                </div>
              );
            }

            return (
              <div className="chat-rich-block" data-chat-block="code" data-chat-motion-profile="code">
                <CodeBlock code={code} language={language} />
              </div>
            );
          },
        }}
      >
        {preprocessDisplayMath(localizedContent)}
      </ReactMarkdown>
    </div>
  );
};

export const MessageMarkdown = memo(MessageMarkdownComponent);

const LEAK_PATTERNS: RegExp[] = [
  /\[SystemMessage\(content=/,
  /\[HumanMessage\(content=/,
  /\[AIMessage\(content=/,
  /\[ToolMessage\(content=/,
  /additional_kwargs=\{/,
  /GraphRecursionError\(/,
  /\[TOOL_CALLS\]/,
  /\[TOOL_[A-Z_]+\]/,
];

const REPLACEMENT_MESSAGE =
  "The agent encountered an internal error while processing the response. Please try again or narrow the scope of your request.";

export const sanitizeAssistantContent = (content: string): string => {
  if (!content) {
    return content;
  }

  const matched = LEAK_PATTERNS.some((pattern) => pattern.test(content));

  if (!matched) {
    return content;
  }

  console.warn(
    "[content-sanitizer] Internal agent state detected in assistant response. Replacing content.",
    content.slice(0, 200),
  );

  return REPLACEMENT_MESSAGE;
};

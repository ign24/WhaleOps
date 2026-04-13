const THINK_OPEN_TAG = "<think>";
const THINK_CLOSE_TAG = "</think>";

const THINK_NOISE_PATTERNS = [
  /^systemmessage\(/i,
  /^humanmessage\(/i,
  /^aimessage\(/i,
  /^messages=\[/i,
  /^function input:?/i,
  /^function start:?/i,
  /^input:?$/i,
  /^output:?$/i,
  /^previous conversation history:?/i,
  /^question:\s*/i,
  /^thought:\s*/i,
  /^final answer:\s*/i,
  /^arguments must be provided as a valid json object/i,
  /^fieldinfo\(/i,
];

const longestSuffixPrefix = (value: string, pattern: string): number => {
  const maxLength = Math.min(value.length, pattern.length - 1);
  for (let size = maxLength; size > 0; size -= 1) {
    if (value.endsWith(pattern.slice(0, size))) {
      return size;
    }
  }
  return 0;
};

const sanitizeThinkingText = (value: string): string => {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const withoutTags = normalized.replace(/<\/?think>/gi, "");
  const lines = withoutTags
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !THINK_NOISE_PATTERNS.some((pattern) => pattern.test(line)))
    .filter((line) => !(line.length <= 2 && /^[a-z0-9.,!?;:-]+$/i.test(line)));

  const deduped: string[] = [];
  for (const line of lines) {
    if (deduped[deduped.length - 1] === line) {
      continue;
    }
    deduped.push(line);
  }

  return deduped.join("\n").trim();
};

export type ThinkParseEvent =
  | { type: "visible"; content: string }
  | { type: "thinking_start" }
  | { type: "thinking_end"; content: string };

export type ThinkStreamState = {
  insideThink: boolean;
  buffer: string;
  thinkingBuffer: string;
};

export const createThinkStreamState = (): ThinkStreamState => ({
  insideThink: false,
  buffer: "",
  thinkingBuffer: "",
});

export const parseThinkChunk = (
  state: ThinkStreamState,
  chunk: string
): { state: ThinkStreamState; events: ThinkParseEvent[] } => {
  let buffer = state.buffer + chunk;
  let insideThink = state.insideThink;
  let thinkingBuffer = state.thinkingBuffer;
  const events: ThinkParseEvent[] = [];

  while (buffer.length > 0) {
    if (!insideThink) {
      const openIndex = buffer.indexOf(THINK_OPEN_TAG);
      if (openIndex === -1) {
        const keep = longestSuffixPrefix(buffer, THINK_OPEN_TAG);
        const visible = buffer.slice(0, buffer.length - keep);
        if (visible.length > 0) {
          events.push({ type: "visible", content: visible });
        }
        buffer = buffer.slice(buffer.length - keep);
        break;
      }

      const visibleBeforeThink = buffer.slice(0, openIndex);
      if (visibleBeforeThink.length > 0) {
        events.push({ type: "visible", content: visibleBeforeThink });
      }

      events.push({ type: "thinking_start" });
      insideThink = true;
      thinkingBuffer = "";
      buffer = buffer.slice(openIndex + THINK_OPEN_TAG.length);
      continue;
    }

    const closeIndex = buffer.indexOf(THINK_CLOSE_TAG);
    if (closeIndex === -1) {
      const keep = longestSuffixPrefix(buffer, THINK_CLOSE_TAG);
      const thinkPart = buffer.slice(0, buffer.length - keep);
      if (thinkPart.length > 0) {
        thinkingBuffer += thinkPart;
      }
      buffer = buffer.slice(buffer.length - keep);
      break;
    }

    thinkingBuffer += buffer.slice(0, closeIndex);
    const sanitizedThinking = sanitizeThinkingText(thinkingBuffer);
    events.push({ type: "thinking_end", content: sanitizedThinking });
    insideThink = false;
    thinkingBuffer = "";
    buffer = buffer.slice(closeIndex + THINK_CLOSE_TAG.length);
  }

  return {
    state: {
      insideThink,
      buffer,
      thinkingBuffer,
    },
    events,
  };
};

export const flushThinkState = (
  state: ThinkStreamState
): { state: ThinkStreamState; events: ThinkParseEvent[] } => {
  const events: ThinkParseEvent[] = [];

  if (state.insideThink) {
    const sanitizedThinking = sanitizeThinkingText(state.thinkingBuffer + state.buffer);
    events.push({ type: "thinking_end", content: sanitizedThinking });
    return {
      state: createThinkStreamState(),
      events,
    };
  }

  if (state.buffer.length > 0) {
    events.push({ type: "visible", content: state.buffer });
  }

  return {
    state: createThinkStreamState(),
    events,
  };
};

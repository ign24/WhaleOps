## Context

The CGN-Agent backend (LangGraph + LangChain) can produce responses where the LLM reproduces Python repr of internal message objects. This happens when a sub-agent fails and the parent LLM echoes the garbage in its next response. The frontend currently has no defense — it streams and displays raw tokens regardless of content.

The sanitization point must be **post-completion, not per-token**, because patterns like `[SystemMessage(content=` can arrive fragmented across multiple tokens and would be missed by per-token checks.

## Goals / Non-Goals

**Goals:**
- Detect Python LangChain repr patterns in the final accumulated content of assistant messages
- Replace detected content with a clear, user-friendly error message
- Add zero latency to the happy path (no garbage detected)
- Cover all known leak patterns: SystemMessage, HumanMessage, AIMessage, ToolMessage, additional_kwargs, GraphRecursionError as chat text

**Non-Goals:**
- Fixing the root cause in the backend LLM or sub-agent logic
- Sanitizing tool call arguments or activity panel entries
- Per-token filtering or streaming interception
- Handling non-LangChain internal state leaks

## Decisions

### D1: Pure function in a dedicated module

`content-sanitizer.ts` is a pure function `sanitizeAssistantContent(content: string): string`. No side effects, no imports from chat infrastructure. This keeps it independently testable.

**Alternatives considered:**
- Inside `message-utils.ts`: Rejected — message-utils handles shape/ID normalization, not content policy.
- Inside `MessageMarkdown`: Rejected — rendering layer should not contain content policy logic; also applies too late (after state is set).

### D2: Apply at message completion, not per-token

The sanitizer runs in `chat-panel.tsx` exactly once per assistant message, when `finish_reason=stop` is received (or SSE stream ends). At that point `content` is fully accumulated.

**Why not per-token:** Patterns like `[SystemMessage(content=` arrive across multiple token boundaries. Per-token detection would require stateful buffer logic and would add overhead to every token.

### D3: Full message replacement, not partial redaction

If any leak pattern is detected, the **entire message content** is replaced. Partial redaction (removing only matched substrings) risks leaving confusing partial context or broken markdown.

**Replacement message:**
```
The agent encountered an internal error while processing the response.
Please try again or narrow the scope of your request.
```

**Why full replacement:** Partial content mixed with garbage is worse UX than a clean error. The user gets a clear action (retry/narrow scope) instead of corrupted text.

### D4: Regex-based detection

Patterns are compiled regexes checked against the full content string. Detection is O(n × p) where n = content length and p = number of patterns (6). For typical chat messages this is negligible.

Patterns:
- `/\[SystemMessage\(content=/`
- `/\[HumanMessage\(content=/`
- `/\[AIMessage\(content=/`
- `/\[ToolMessage\(content=/`
- `/additional_kwargs=\{/`
- `/GraphRecursionError\(/`

## Risks / Trade-offs

- **False positive risk**: A user could legitimately ask about LangChain and the agent could reproduce an example that matches a pattern. Mitigation: Patterns are specific enough (e.g., `[SystemMessage(content=` with bracket and equals) to be highly unlikely in legitimate responses. Accepted trade-off for now; patterns can be made stricter if false positives occur.
- **New leak patterns**: Future LangChain versions or other frameworks could produce different repr formats. Mitigation: Sanitizer is easily extended — add patterns to a single array.
- **No visibility into sanitized messages**: User sees generic error, not what was returned. Mitigation: `console.warn` with a truncated preview for debugging.

## Migration Plan

No migration needed. Frontend-only change, no data model impact. Deploy with normal frontend build. Rollback: revert the two file changes.

## Open Questions

None. Scope is fully defined.

## Context

The UI currently streams assistant tokens from SSE `data:` payloads and renders them as visible content. In some sessions, control-plane tool markers such as `[TOOL_CALLS]reader_agent{...}` appear in that visible token stream even though backend tool execution succeeds. Existing sanitization already covers LangChain repr leaks (`AIMessage(...)`, `ToolMessage(...)`, `additional_kwargs`, `GraphRecursionError`) but does not cover tool-control marker formats observed in production chats.

This change is cross-cutting across chat streaming and output safety behavior in `ui-cognitive`, and must preserve current activity/tool telemetry while preventing internal control payloads from reaching final user-visible messages.

## Goals / Non-Goals

**Goals:**
- Prevent tool-control marker payloads from being displayed in assistant chat output.
- Keep tool/activity side panel behavior unchanged.
- Add deterministic regression tests reproducing the observed leak traces.
- Ensure a consistent fallback message when sanitization blocks leaked content.

**Non-Goals:**
- Redesign the SSE protocol between UI and backend.
- Change backend agent orchestration semantics or disable tool calls.
- Implement a full semantic classifier for output safety beyond known control-marker patterns.

## Decisions

1. **Defense-in-depth at render boundary (chosen)**
   - Extend `sanitizeAssistantContent` with explicit control-marker patterns (e.g. `\[TOOL_CALLS\]`, future-compatible `\[TOOL_[A-Z_]+\]`).
   - Rationale: fastest containment with minimal risk and no backend contract changes.
   - Alternative considered: backend-only filtering of token stream. Rejected for this change because frontend is the final trust boundary for what gets displayed and already has sanitizer architecture.

2. **Sanitize only completed assistant content (keep current timing)**
   - Preserve existing behavior of applying sanitizer when stream completes/flushes.
   - Rationale: avoids over-filtering partial tokens and preserves streaming UX.
   - Alternative considered: per-token filtering. Rejected due to complexity and false-positive risk on partial chunks.

3. **Preserve tool/activity event channels untouched**
   - Keep `event: tool` and `event: activity` handling as-is; only prevent control payloads from entering visible assistant prose.
   - Rationale: avoids regressions in side-panel diagnostics.

4. **Add explicit leak test vectors for observed payloads**
   - Include test cases with `[TOOL_CALLS]reader_agent{...}` and mixed-content variants.
   - Rationale: guards against recurrence with concrete field evidence.

## Risks / Trade-offs

- **[Risk] Over-broad pattern matching could mask legitimate user text** → Mitigation: use narrowly scoped regex anchored to control-marker signatures and add pass-through tests for normal bracketed content.
- **[Risk] New control-marker formats may appear later** → Mitigation: keep sanitizer patterns centrally defined and add tests for each newly observed format.
- **[Risk] Leak still visible during stream before final sanitize** → Mitigation: this phase guarantees final committed message safety; if needed, a future follow-up can add streaming-time suppression.

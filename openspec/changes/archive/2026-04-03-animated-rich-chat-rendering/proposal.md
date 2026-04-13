## Why

The current `ui-cognitive` chat rendering is functional but visually flat, which makes long assistant responses harder to parse and less engaging. We need richer, block-aware motion that improves readability while preserving fast first paint and accessibility.

## What Changes

- Add progressive, type-specific animations for chat content blocks: paragraph text, lists, code, activity updates, and callouts.
- Prioritize immediate content visibility, then apply enhancement animations without delaying perceived response time.
- Respect `prefers-reduced-motion` with motion-minimized behavior that preserves hierarchy and clarity.
- Scope implementation to frontend chat rendering paths in `ui-cognitive` (`chat-panel`, `message-markdown`, `code-block`, styles, and related tests).

## Capabilities

### New Capabilities
- `animated-chat-block-rendering`: Progressive, accessible visual rendering for chat blocks with per-block animation semantics and reduced-motion fallbacks.

### Modified Capabilities
- None.

## Impact

- Affected code: `ui-cognitive` chat UI components and styling layers for markdown and code rendering.
- Affected tests: frontend tests covering chat rendering behavior, reduced-motion behavior, and non-blocking progressive enhancement.
- No backend, API, or dependency contract changes are required.

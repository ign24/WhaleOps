## 1. Extend sanitizer coverage

- [x] 1.1 Add leak patterns for tool-control markers (`[TOOL_CALLS]` and `[TOOL_... ]` variants) in `ui-cognitive/lib/content-sanitizer.ts`.
- [x] 1.2 Keep the existing replacement message contract unchanged and verify no regressions for current LangChain leak patterns.

## 2. Protect chat commit path

- [x] 2.1 Ensure assistant content sanitization is applied on all completion paths in `chat-panel.tsx` (normal completion and flush/close path).
- [x] 2.2 Ensure blocked control-marker payloads are not persisted as visible assistant content in session history.

## 3. Add regression tests

- [x] 3.1 Add unit tests for sanitizer with observed payloads like `[TOOL_CALLS]reader_agent{...}` and mixed-content variants.
- [x] 3.2 Add pass-through tests to confirm normal bracketed prose is not falsely sanitized.
- [x] 3.3 Add/adjust chat-panel integration tests validating final committed assistant output never contains tool-control marker payloads.

## 4. Validate and document rollout

- [x] 4.1 Run UI quality gates (`bun run lint`, `bun run test`, and targeted chat/sanitizer tests) and fix any failures.
- [x] 4.2 Capture before/after evidence for the leak case in change notes and confirm user-visible output is clean while tool activity remains visible in activity traces.

## Before / After evidence

### Before

- Observed user-visible assistant output leaked control payloads, e.g.:
  - `[TOOL_CALLS]reader_agent{"messages":[...]}`
- Tools were still executed in backend logs, but control markers appeared in visible chat text.

### After

- Sanitizer now detects tool-control markers (`[TOOL_CALLS]`, `[TOOL_*]`) and replaces leaked content with the existing friendly fallback message.
- Chat-panel regression test verifies leaked marker is not visible in the final committed assistant output.
- API chat route regression test verifies persisted assistant content is sanitized before writing session history.

### Verification commands

- `bun run test tests/content-sanitizer.test.ts tests/chat-panel.test.tsx tests/api-chat-route.test.ts`
- `bun run lint`
- `bun run test`
- `bun run build`

### Verification summary

- Targeted tests: passed
- Full UI test suite: passed (33 files, 179 tests)
- Build: passed
- Lint: passed with 1 pre-existing warning in `components/activity/tool-call-card.tsx` (`argKey` unused)

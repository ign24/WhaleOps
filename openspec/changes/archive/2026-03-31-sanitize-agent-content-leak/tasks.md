## 1. Content Sanitizer Module

- [x] 1.1 Create `ui-cognitive/lib/content-sanitizer.ts` with `sanitizeAssistantContent(content: string): string`
- [x] 1.2 Define the leak pattern array (6 patterns: SystemMessage, HumanMessage, AIMessage, ToolMessage, additional_kwargs, GraphRecursionError)
- [x] 1.3 Implement detection logic: check all patterns against full content string
- [x] 1.4 Implement replacement: return user-friendly error message when any pattern matches
- [x] 1.5 Implement debug logging: `console.warn` with truncated preview (first 200 chars) on detection
- [x] 1.6 Ensure empty and normal content pass through unmodified

## 2. Chat Panel Integration

- [x] 2.1 Import `sanitizeAssistantContent` in `chat-panel.tsx`
- [x] 2.2 Apply sanitizer to accumulated `content` at the point where the assistant message is committed to state (finish_reason=stop path)
- [x] 2.3 Apply sanitizer to the flush path (stream close without finish_reason)

## 3. Tests

- [x] 3.1 Create `ui-cognitive/tests/content-sanitizer.test.ts`
- [x] 3.2 Test: each of the 6 patterns individually triggers replacement
- [x] 3.3 Test: empty string passes through unchanged
- [x] 3.4 Test: normal content with no patterns passes through unchanged
- [x] 3.5 Test: content containing multiple patterns still returns single replacement message
- [x] 3.6 Test: console.warn is called with truncated preview on detection

## 4. Verification

- [x] 4.1 Run `bun run lint` — no new lint errors
- [x] 4.2 Run `bun run build` — clean build
- [x] 4.3 Run test suite — all sanitizer tests pass

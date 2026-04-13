## 1. API Input Safety (SDD+TDD)

- [x] 1.1 RED: Write failing tests for malformed JSON handling in all 5 API routes (POST with invalid JSON expects 400, empty body expects 400, valid JSON passes through)
- [x] 1.2 GREEN: Create `lib/api-utils.ts` with `safeParseJson(request)` helper that wraps `request.json()` in try-catch
- [x] 1.3 GREEN: Apply `safeParseJson` to `/api/users/route.ts`, `/api/users/[userId]/route.ts`, `/api/sessions/[sessionKey]/route.ts`, `/api/sessions/[sessionKey]/feedback/route.ts`, `/api/chat/route.ts`
- [x] 1.4 REFACTOR: Verify all 5 routes use consistent 400 response format, deduplicate any shared patterns

## 2. Error Response Sanitization (SDD+TDD)

- [x] 2.1 RED: Write failing tests that verify API routes return generic error messages (not raw error.message) on internal errors
- [x] 2.2 GREEN: Update catch blocks in all API routes to return `{ error: "Internal server error" }` and log details server-side
- [x] 2.3 GREEN: Preserve specific safe messages for known validation errors (missing fields, email-already-exists, etc.)
- [x] 2.4 REFACTOR: Verify no route leaks stack traces, file paths, or database details in responses

## 3. Path Traversal Guard (SDD+TDD)

- [x] 3.1 RED: Write failing tests for path traversal in `/api/workspace/tree` (double-dot, encoded double-dot, absolute path expect 400; valid relative path passes)
- [x] 3.2 GREEN: Add `validateWorkspacePath(path)` to `lib/api-utils.ts` that rejects `..`, absolute paths, and normalizes with `path.normalize()`
- [x] 3.3 GREEN: Apply validation in `/api/workspace/tree/route.ts` before forwarding to backend
- [x] 3.4 REFACTOR: Verify edge cases (empty path, trailing slashes, Windows-style paths)

## 4. Environment Variable Validation

- [x] 4.1 RED: Write failing tests for `lib/env.ts` (throws in production when NAT_BACKEND_URL missing, falls back in development, exports valid values when present)
- [x] 4.2 GREEN: Create `lib/env.ts` with validated exports and NODE_ENV-aware behavior
- [x] 4.3 GREEN: Replace all `process.env.NAT_BACKEND_URL ?? DEFAULT_NAT_BACKEND_URL` usages across API routes with import from `lib/env.ts`
- [x] 4.4 REFACTOR: Remove `DEFAULT_NAT_BACKEND_URL` constants from individual route files

## 5. Hydration Safety Fixes

- [x] 5.1 RED: Write failing tests that verify SSR-safe initial state for `agentMode` in `chat-panel.tsx` (useState always returns "analyze" on first render)
- [x] 5.2 GREEN: Fix `chat-panel.tsx:488-491` — initialize useState with `"analyze"`, read localStorage in useEffect
- [x] 5.3 GREEN: Fix `sidebar-shell.tsx:15-20` — same pattern: SSR default, useEffect for localStorage
- [x] 5.4 GREEN: Fix `code-block.tsx:13-18` — already correct: useState("github-light") + useEffect reads document
- [x] 5.5 GREEN: Fix `chat-session-layout.tsx:37-51` — already correct: useSyncExternalStore with deterministic server snapshot
- [x] 5.6 REFACTOR: Verify no hydration warnings in browser console by hitting all affected pages

## 6. Fetch Lifecycle Cleanup

- [x] 6.1 RED: Write failing tests that verify AbortController cleanup (mock fetch, verify abort called on unmount/dependency change)
- [x] 6.2 GREEN: Add AbortController to history fetch in `chat-panel.tsx:857-883`
- [x] 6.3 GREEN: Add AbortController to tools fetch in `chat-panel.tsx:903-930`
- [x] 6.4 GREEN: Add AbortController to fetches in `chat-help-card.tsx:28-68`
- [x] 6.5 GREEN: Add AbortController to fetch chain in `folder-card.tsx:50-87`
- [x] 6.6 GREEN: setTimeout(0) focus calls are low-risk fire-and-forget; setCopiedMessageIndex 1200ms is ephemeral — no ref tracking needed
- [x] 6.7 REFACTOR: Verify no AbortError leaks to console, all abort catches are silent

## 7. Final Verification

- [x] 7.1 Run full test suite: `bun run test` — 364 tests passed, 0 failed
- [x] 7.2 Run linter: `bun run lint` — 0 errors, 6 preexisting warnings
- [x] 7.3 Run build: `bun run build` — successful compilation
- [x] 7.4 Next.js DevTools MCP `get_errors` — "No errors detected in 1 browser session(s)"
- [x] 7.5 Secrets check — clean, no hardcoded secrets

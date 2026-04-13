## Why

A deep scan of ui-cognitive using Next.js DevTools MCP revealed 4 hydration mismatches, 5 API routes vulnerable to JSON parse crashes, missing session ownership validation (authorization bypass), a path traversal risk, and multiple memory leaks from uncancelled fetches. These are production-blocking issues: the hydration error is actively firing in the browser, and the API vulnerabilities expose the system to data leaks and denial of service.

## What Changes

- **API input safety**: Wrap all `request.json()` calls in try-catch, returning 400 on malformed input instead of crashing with 500
- **Session ownership validation**: Verify the authenticated user owns the session before returning history, updating, or submitting feedback
- **Path traversal protection**: Validate and sanitize the `path` parameter in `/api/workspace/tree` to reject `..` sequences
- **Error message sanitization**: Replace raw `error.message` in API responses with generic messages; log details server-side only
- **Environment variable validation**: Fail fast in production when `NAT_BACKEND_URL` is missing instead of silently falling back to localhost
- **Hydration mismatch fixes**: Move all client-only state (localStorage, window, document) to `useEffect` hydration pattern across 4 components
- **Fetch lifecycle cleanup**: Add `AbortController` to all `useEffect` fetches to prevent race conditions and setState-on-unmounted-component warnings

## Capabilities

### New Capabilities
- `api-input-safety`: Try-catch around request.json(), Content-Type validation, and generic error responses across all API routes
- `session-authorization`: Ownership validation on session-scoped API routes (history, update, feedback)
- `path-traversal-guard`: Input sanitization for filesystem path parameters in workspace API
- `env-validation`: Fail-fast validation of required environment variables in production
- `hydration-safety`: Deterministic SSR-safe state initialization pattern for client-only values (localStorage, window, document)
- `fetch-lifecycle`: AbortController cleanup pattern for all useEffect-based fetch calls

### Modified Capabilities

## Impact

- **API routes affected**: `api/users/route.ts`, `api/users/[userId]/route.ts`, `api/sessions/[sessionKey]/route.ts`, `api/sessions/[sessionKey]/history/route.ts`, `api/sessions/[sessionKey]/feedback/route.ts`, `api/chat/route.ts`, `api/workspace/tree/route.ts`, `api/tools/route.ts`, `api/health/route.ts`, `api/observability/summary/route.ts`, `api/mcp/route.ts`, `api/workspace/roots/route.ts`
- **Components affected**: `chat-panel.tsx`, `sidebar-shell.tsx`, `code-block.tsx`, `chat-session-layout.tsx`, `chat-help-card.tsx`, `folder-card.tsx`
- **Dependencies**: None added. All fixes use built-in Node.js/React/Next.js APIs
- **Breaking changes**: None. All fixes are internal behavior corrections

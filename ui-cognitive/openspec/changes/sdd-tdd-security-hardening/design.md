## Context

ui-cognitive is a Next.js 16 chat UI for cognitive-agents. Authentication uses NextAuth v5 with JWT strategy and credentials provider. API routes follow a consistent pattern: check `await auth()` for session, try-catch around logic, return JSON responses. The app proxies several routes to a Python backend at `NAT_BACKEND_URL`.

A deep scan revealed critical security gaps: API routes crash on malformed JSON, sessions have no user ownership (any authenticated user can access any session), workspace tree route is vulnerable to path traversal, and error messages leak internal details. On the frontend, 4 components have hydration mismatches from reading localStorage/window during SSR, and multiple fetch calls lack AbortController cleanup.

## Goals / Non-Goals

**Goals:**
- Harden all API routes against malformed input (try-catch on `request.json()`)
- Sanitize all error responses to never leak internal details to clients
- Protect workspace tree against path traversal
- Validate required environment variables at startup in production
- Fix all 4 hydration mismatches with a consistent SSR-safe pattern
- Add AbortController to all useEffect fetch calls to prevent race conditions
- Defer session ownership to a follow-up change (data model migration required)

**Non-Goals:**
- Rate limiting (requires infrastructure: Redis or similar)
- CORS headers (Next.js defaults are sufficient for same-origin deployment)
- Zod schema validation (valuable but separate concern — too broad for this change)
- CSRF protection (NextAuth handles this for auth endpoints)
- Session ownership implementation (sessions lack userId field — requires data model migration, tracked as separate change)
- Password policy changes (separate user management concern)

## Decisions

### D1: Safe JSON parsing via helper function

**Choice:** Create a shared `safeParseJson(request)` helper that wraps `request.json()` in try-catch and returns `{ data, error }`.

**Why over inline try-catch in each route:** DRY — 5+ routes need this. Single point to add Content-Type validation later. Consistent 400 response shape.

**Location:** `lib/api-utils.ts`

### D2: Generic error responses with server-side logging

**Choice:** All catch blocks return `{ error: "Internal server error" }` with status 500. The actual error is logged with `console.error` including a request context identifier.

**Why over returning error.message:** error.message can contain database paths, stack traces, or internal service details. Generic client messages + detailed server logs is the standard pattern.

### D3: Path validation via allowlist pattern

**Choice:** Validate workspace path parameters by: (1) rejecting paths containing `..`, (2) rejecting absolute paths, (3) normalizing with `path.normalize()` and verifying the result stays within the workspace root.

**Why over just stripping `..`:** Stripping is bypassable (`....//` becomes `../`). Normalize-then-verify is the OWASP-recommended approach.

### D4: Environment variable validation at module level

**Choice:** Create `lib/env.ts` that exports validated env vars. Throws at import time in production if required vars are missing. In development, falls back to localhost defaults.

**Why over checking in each route:** Fail-fast at server startup rather than at first request. Single source of truth for all env vars.

### D5: Hydration-safe state pattern

**Choice:** Always initialize `useState` with the SSR-safe default. Read client-only values (localStorage, window) in a `useEffect` that runs after hydration.

**Why over `useSyncExternalStore`:** simpler for localStorage reads that don't need subscription. `useSyncExternalStore` is correct for `chat-session-layout.tsx` which already uses it — just needs a correct server snapshot.

### D6: AbortController pattern for fetch in useEffect

**Choice:** Create AbortController in the useEffect body, pass `signal` to fetch, call `controller.abort()` in the cleanup function.

**Why:** Standard React pattern. Prevents race conditions when dependencies change and setState on unmounted components.

### D7: Session ownership deferred

**Choice:** Do NOT implement session ownership validation in this change.

**Why:** The current data model has no `userId` field on sessions. Adding it requires migrating existing session data, updating the session creation flow, and adding the field to the backend persistence layer. This is a separate change that should be planned with the full data migration lifecycle.

## Risks / Trade-offs

- **[Risk] Safe JSON parsing adds overhead** → Negligible: one try-catch per request. No measurable impact.
- **[Risk] Generic error messages make debugging harder for frontend devs** → Mitigation: include a `requestId` in responses that correlates to server logs.
- **[Risk] Environment validation crashes server on missing vars** → Mitigation: only in production. Development keeps fallback behavior.
- **[Risk] Hydration fix causes brief flash of default state** → Mitigation: the flash is sub-frame (useEffect fires synchronously after paint). Users won't notice for small UI elements like mode buttons.
- **[Risk] Session ownership still missing** → Mitigation: tracked as immediate follow-up change. Current auth still requires login.

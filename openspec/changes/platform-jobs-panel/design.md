## Context

The backend already has a fully operational APScheduler instance (`cron_tools._scheduler`) backed by RedisJobStore. It starts during NAT lifespan via a monkey-patch in `register.py`, and the agent can manage jobs through the `schedule_task` tool. The frontend is completely blind to this layer.

The custom REST API pattern is established: `workspace_api.py` registers routes via `register_workspace_routes(app)` called inside the lifespan patch. The same pattern is reused here for jobs routes.

SSE streaming is in place (`granular-streaming-events` branch): `tool_start`, `tool_end`, and `intermediate_data` events already flow from the agent to the chat panel. Adding `task_complete` follows the same path.

The UI uses a neumorphic design system with CSS custom properties. Navigation is sidebar-based on desktop, drawer-based on mobile. The header is always visible on both breakpoints — making it the only reliable surface for persistent status on mobile.

## Goals / Non-Goals

**Goals:**
- Expose APScheduler state via authenticated REST API (list, create, cancel)
- Mobile-first jobs status: always visible in the header, no drawer required
- Full management UI at `/jobs` (create, view, cancel) — Vercel-style table + card fallback on mobile
- Clear agent termination signal: `task_complete` SSE event → "Done" / "Failed" badge in chat
- TDD throughout: tests written before implementation for every new unit

**Non-Goals:**
- Job execution history / logs (jobs fire into `cron:scheduled` session, no structured log per job)
- Real-time job status updates via WebSocket (polling on the jobs page is sufficient)
- Multi-user job ownership (all jobs are global to the server instance)
- Background one-shot tasks (separate future change)

## Decisions

### D1: Jobs REST API lives in a new `jobs_api.py` module, not in `workspace_api.py`

`workspace_api.py` already handles workspace filesystem concerns. Jobs are a separate domain. A dedicated `jobs_api.py` with its own `APIRouter` keeps concerns separate and makes it testable in isolation. It gets registered in `register.py` alongside `register_workspace_routes`.

**Alternative considered**: Extend `workspace_api.py`. Rejected — it conflates two unrelated domains and makes both harder to test.

### D2: Jobs REST API reads `cron_tools._scheduler` directly (no abstraction layer)

The scheduler is a module-level singleton. Adding a service/repository abstraction adds indirection with no benefit — there's only one scheduler instance, and the API endpoints are thin read/write wrappers. Direct access keeps the code minimal.

**Alternative considered**: A `CronJobService` class. Rejected — premature abstraction for 3 endpoints.

### D3: `JobsStatusIndicator` polls `/api/jobs/cron` every 30 seconds

The header indicator needs to stay current without overloading the server. WebSocket for this would be over-engineered. A 30-second interval with SWR (`useSWR`) gives acceptable freshness. On tab focus, SWR revalidates immediately.

**Alternative considered**: WebSocket push. Rejected — adds infrastructure complexity for a low-urgency indicator.

### D4: Mobile uses a bottom sheet, desktop uses a popover

On mobile, a bottom sheet (slide up from bottom edge) is ergonomic for finger reach. On desktop, a small popover anchored to the header indicator is conventional. Both render the same `JobsQuickList` component. Breakpoint is `lg` (matches existing sidebar breakpoint).

**Alternative considered**: Same popover on all screen sizes. Rejected — popover anchored to top-right is awkward to reach on mobile.

### D5: `task_complete` is emitted in `safe_tool_calling_agent.py` after the graph exits

The LangGraph graph finishes when `astream_events` exhausts. The agent already iterates this stream. After the loop, it emits `task_complete` via the same `_emit_stream_activity` path used for `tool_start`/`tool_end`. `success=True` if no exception was raised; `success=False` if the loop exited via exception.

**Alternative considered**: Emit from NAT's runner. Rejected — we don't control NAT internals cleanly, and the agent already has the right hooks.

### D6: `task_complete` re-enables the chat input via React state (no SSE channel close)

The SSE channel stays open for the session lifetime (existing behavior). `task_complete` is just a signal event. The frontend sets `isStreaming=false` and renders the badge when it receives it. No channel management needed.

### D7: `/jobs` page uses server-side auth check (RSC) + client-side data fetching

Follows the pattern of `/observability/page.tsx`: RSC page checks auth and redirects if unauthenticated, then renders a client component that fetches data. The client component handles loading, empty, and error states.

## Risks / Trade-offs

- **`_scheduler` is None during tests** → Mitigation: `jobs_api.py` returns 503 with a clear message if `_scheduler is None`. Tests mock `cron_tools._scheduler`.
- **30s polling misses a job that was created and deleted within the window** → Acceptable: the management page does an immediate refetch after create/cancel actions.
- **`task_complete` not emitted if the process crashes mid-stream** → Mitigation: frontend has a 60-second stale streaming timeout (existing behavior). No change needed.
- **Bottom sheet z-index conflicts with existing overlays** → Mitigation: use `z-50` (same as mobile sidebar drawer). Test both open states.

## Migration Plan

1. Deploy backend changes (jobs API + `task_complete` emission) — frontend ignores unknown SSE events gracefully, so this is safe to ship first.
2. Deploy frontend changes — the header indicator and `/jobs` page are purely additive.
3. No database migration required (APScheduler + Redis already running).
4. Rollback: revert the `register.py` route registration line — jobs API disappears, frontend shows empty state.

## Open Questions

- Should the `/jobs` page be admin-only or visible to all authenticated users? For now: all authenticated users (consistent with how the agent can create jobs for any user).
- Should job creation from the UI support the same prompt safety validation as the tool? Yes — reuse `_validate_prompt` and `_validate_cron` from `cron_tools.py`.

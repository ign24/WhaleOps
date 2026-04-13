## Why

The agent can schedule recurring cron jobs and manage them via `schedule_task`, but the frontend has zero visibility into what's running — users must ask the agent to list its own jobs, which is friction. At the same time, the chat has no clear termination signal: the agent response ends ambiguously with no "done" indicator, leaving users uncertain whether the task completed or stalled.

## What Changes

- Add a REST API layer that exposes APScheduler state to the frontend (`GET/POST/DELETE /api/jobs/cron`)
- Add a persistent jobs status indicator in the Header (mobile-first: always visible, never buried in a drawer)
- Add a full `/jobs` management page for creating, inspecting, and cancelling scheduled jobs
- Emit a `task_complete` SSE event when the LangGraph graph reaches `__end__`, rendered as a "Done" / "Failed" badge in the chat

## Capabilities

### New Capabilities

- `jobs-rest-api`: FastAPI endpoints to list, create, and cancel APScheduler cron jobs. Mounted via the existing custom-route lifespan patch pattern in `register.py`.
- `jobs-status-header`: Persistent jobs count indicator in the Header component. Shows a pulsing dot when jobs are active. Opens a bottom sheet (mobile) or popover (desktop) with a compact job list and last-run info. Mobile-first: this is the primary surface for job status on small screens.
- `jobs-management-page`: Full `/jobs` route with Vercel-style table for creating, viewing, and cancelling cron jobs. Card layout fallback on small screens. Accessible from the sidebar drawer (Clock icon).
- `task-complete-signal`: Backend emits `{ type: "task_complete", payload: { success: boolean } }` as a final SSE event when the graph exits. Frontend renders a compact "Done" or "Failed" badge after the last message, and re-enables the input.

### Modified Capabilities

- `cron-scheduler`: No requirement changes. The scheduler itself is unchanged — the REST API reads from `cron_tools._scheduler` directly. No delta spec needed.

## Impact

- **Backend**: `workspace_api.py` (or new `jobs_api.py`) — 3 new routes; `register.py` — mount jobs router; `safe_tool_calling_agent.py` — emit `task_complete` on graph exit
- **Frontend**: `header.tsx` — add `JobsStatusIndicator`; new `app/(app)/jobs/page.tsx` + view component; `sidebar.tsx` — add Clock nav link; `chat-panel.tsx` — handle `task_complete` SSE event and render badge
- **Dependencies**: No new packages. Uses existing lucide-react, motion/react, and SSE infrastructure.
- **API surface**: 3 new authenticated REST endpoints under `/api/jobs/`

## 1. Backend — Jobs REST API

- [x] 1.1 Create `src/cognitive_code_agent/jobs_api.py` with an `APIRouter` and a `CronJobItem` Pydantic response model (`id`, `description`, `cron_expr`, `next_run`, `status`)
- [x] 1.2 Write failing tests for `GET /api/jobs/cron`: jobs exist, empty list, scheduler not initialized, unauthenticated (RED)
- [x] 1.3 Implement `GET /api/jobs/cron` handler reading from `cron_tools._scheduler`; pass all tests (GREEN)
- [x] 1.4 Write failing tests for `POST /api/jobs/cron`: valid creation, invalid cron, dangerous prompt, missing fields (RED)
- [x] 1.5 Implement `POST /api/jobs/cron` handler reusing `_validate_cron` and `_validate_prompt` from `cron_tools`; pass all tests (GREEN)
- [x] 1.6 Write failing tests for `DELETE /api/jobs/cron/{job_id}`: existing job, non-existent job, unauthenticated (RED)
- [x] 1.7 Implement `DELETE /api/jobs/cron/{job_id}` handler; pass all tests (GREEN)
- [x] 1.8 Register the jobs router in `register.py` via the lifespan patch alongside `register_workspace_routes`

## 2. Backend — task_complete SSE signal

- [x] 2.1 Write failing test: after graph exits normally, `task_complete` event with `success=true` is emitted via `intermediate_data` (RED)
- [x] 2.2 Write failing test: after graph exits via exception, `task_complete` with `success=false` is emitted (RED)
- [x] 2.3 Add `task_complete` emission in `safe_tool_calling_agent.py` after the `astream_events` loop (try/finally to cover both paths); pass all tests (GREEN)

## 3. Frontend — API client

- [x] 3.1 Create `ui-cognitive/lib/jobs-api.ts` with typed fetch helpers: `fetchJobs()`, `createJob(body)`, `cancelJob(id)` using the existing fetch patterns in the codebase
- [x] 3.2 Write tests for `fetchJobs`: maps response to `CronJob[]`, handles empty array, handles 503 error

## 4. Frontend — JobsStatusIndicator (header)

- [x] 4.1 Write failing tests for `JobsStatusIndicator`: renders pulsing dot when jobs > 0, neutral dot when 0, neutral on error (RED)
- [x] 4.2 Implement `ui-cognitive/components/layout/jobs-status-indicator.tsx` with SWR polling every 30s; pass tests (GREEN)
- [x] 4.3 Write failing tests for `JobsQuickList`: renders job rows with description/cron/next-run, cancel button fires `cancelJob`, empty state, "Manage jobs" link (RED)
- [x] 4.4 Implement `ui-cognitive/components/layout/jobs-quick-list.tsx`; pass tests (GREEN)
- [x] 4.5 Write failing tests for bottom sheet vs popover rendering based on breakpoint mock (RED)
- [x] 4.6 Implement `JobsQuickPanel` — bottom sheet on mobile (`lg:hidden`), popover on desktop (`hidden lg:block`); integrate `JobsQuickList`; pass tests (GREEN)
- [x] 4.7 Wire `JobsStatusIndicator` + `JobsQuickPanel` into `header.tsx` between the logo and the mobile hamburger

## 5. Frontend — /jobs management page

- [ ] 5.1 Add `Clock` icon nav link to `/jobs` in `sidebar.tsx` — expanded label, collapsed tooltip, active state; write test for active state
- [ ] 5.2 Create `ui-cognitive/app/(app)/jobs/page.tsx` (RSC: auth check + redirect if unauthenticated, renders `JobsPageView`)
- [ ] 5.3 Write failing tests for `JobsPageView`: table on desktop, card layout on mobile, loading skeleton, empty state, error state with retry (RED)
- [ ] 5.4 Implement `ui-cognitive/components/jobs/jobs-page-view.tsx` with SWR fetch, desktop table, mobile card grid; pass tests (GREEN)
- [ ] 5.5 Write failing tests for `NewJobForm`: cron preview text, invalid cron inline error, successful submit closes form and refreshes list, 422 error displayed inline (RED)
- [ ] 5.6 Implement `ui-cognitive/components/jobs/new-job-form.tsx` with client-side cron validation and human-readable preview; pass tests (GREEN)
- [ ] 5.7 Write failing tests for cancel confirmation: confirm fires DELETE, dismiss makes no call (RED)
- [ ] 5.8 Implement inline confirmation pattern on job rows/cards; pass tests (GREEN)

## 6. Frontend — task_complete chat badge

- [ ] 6.1 Write failing tests for `TaskCompleteBadge`: renders "Done" in success color, "Failed" in error color, not rendered for other event types (RED)
- [ ] 6.2 Implement `ui-cognitive/components/chat/task-complete-badge.tsx`; pass tests (GREEN)
- [ ] 6.3 Write failing test: `chat-panel.tsx` re-enables input and shows badge when `task_complete` SSE event is received (RED)
- [ ] 6.4 Handle `task_complete` event in `chat-panel.tsx` SSE parser: set `isStreaming=false`, store `success` flag, render `TaskCompleteBadge` after last message; pass tests (GREEN)

## 7. Verification

- [ ] 7.1 Run full backend test suite: `uv run pytest -x` — all pass
- [ ] 7.2 Run full frontend lint + type check: `bun run lint && bun run build` — no errors
- [ ] 7.3 Manual smoke test: create a cron job from `/jobs`, verify it appears in the header indicator, cancel it from the quick-view, verify it disappears
- [ ] 7.4 Manual smoke test: send a message to the agent, verify "Done" badge appears after the response completes
- [ ] 7.5 Mobile smoke test: open header indicator on a narrow viewport, verify bottom sheet opens and closes correctly

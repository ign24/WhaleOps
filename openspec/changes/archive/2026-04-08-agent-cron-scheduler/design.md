## Context

The agent currently handles every user interaction as a one-shot request/response cycle. When users ask for recurring work ("analyze this repo every Monday", "run a security scan nightly"), the agent has no mechanism to honor that — the request ends and nothing is remembered as a schedule.

Redis and the FastAPI server (via NAT) are already running. The NAT lifecycle uses a standard FastAPI `lifespan` context manager, which `register.py` already extends via monkey-patching (MCP enum patch, NIM timeout patch). APScheduler is a mature Python scheduling library with a `RedisJobStore` that persists job state in Redis natively, requiring no new infrastructure.

The emergent project (github.com/ign24/emergent) implements the same pattern with SQLite instead of Redis — this design adapts that approach to the existing Redis stack.

## Goals / Non-Goals

**Goals:**
- Agent can create, list, and cancel scheduled recurring tasks via a tool
- Schedules persist in Redis and survive server restarts
- Jobs fire in-process on the asyncio event loop — no separate worker, no HTTP roundtrip
- Scheduler lifecycle is tied to the NAT server lifecycle (start/stop together)
- Minimal new infrastructure: one new Python dep (`apscheduler>=3.10`), one new key namespace in Redis

**Non-Goals:**
- User-facing schedule management UI (out of scope — agent is the only interface)
- One-shot delayed execution (only recurring cron expressions, no `run once in 2 hours`)
- Per-user schedule isolation (all schedules are global; user_id is embedded in the job prompt)
- Result delivery via Telegram or other channels (results go to logs/traces only in v1)
- Fine-grained per-second scheduling (minute-level granularity is sufficient)

## Decisions

### D1: APScheduler over croniter + custom loop

**Decision**: Use `APScheduler>=3.10` with `AsyncIOScheduler` rather than a hand-rolled `asyncio.sleep(60)` loop with `croniter`.

**Rationale**: APScheduler provides cron expression parsing, missed-fire handling, job persistence protocol, and graceful shutdown out of the box. A custom loop would require re-implementing all of these. `croniter` alone only parses expressions — it doesn't manage execution, missed fires, or persistence.

**Alternative considered**: croniter + Redis sorted set (next_run_time as score). Rejected because it duplicates APScheduler's job store behavior without the maturity.

---

### D2: RedisJobStore over SQLAlchemyJobStore (SQLite)

**Decision**: Persist scheduled jobs in Redis via `APScheduler`'s built-in `RedisJobStore`, not SQLite.

**Rationale**: Redis is already in the stack (episodic memory, embedding cache). Adding SQLite would be a new infra dependency with its own volume mount, WAL configuration, and backup concerns. RedisJobStore uses a single key namespace (`cgn:apscheduler`) and requires zero new infra.

**Alternative considered**: SQLAlchemyJobStore with SQLite (emergent's approach). Rejected because it introduces a new dependency when Redis already covers this.

---

### D3: Lifespan injection via monkey-patch of `configure()`

**Decision**: Wrap `FastAPIFrontEndPluginWorker.configure` to schedule a `asyncio.create_task(scheduler.start())` call after NAT's own startup completes. Stop the scheduler inside the same wrapper on shutdown.

**Rationale**: NAT's `lifespan` calls `await self.configure(starting_app, builder)` before `yield`. We cannot subclass `FastAPIFrontEndPluginWorker` (NAT instantiates it internally). Monkey-patching `configure` is consistent with the two patches already in `register.py` and is the minimally invasive approach.

**Alternative considered**: Starting the scheduler at module import time in `register.py` with `asyncio.get_event_loop().create_task(...)`. Rejected because the event loop may not be running at import time, making this fragile across Python/uvicorn startup orderings.

---

### D4: In-process dispatch, not HTTP

**Decision**: When a scheduled job fires, call `stream_fn` (the NAT workflow callable) directly in-process, not via `POST /chat/stream`.

**Rationale**: HTTP dispatch introduces a dependency on the server being fully up and listening, adds latency, requires authentication tokens, and complicates error handling. In-process dispatch is synchronous with the event loop, traceable via the existing telemetry system, and consistent with how NAT invokes workflows internally.

**Session ID**: Jobs run under `session_id="cron:scheduled"` to separate them from interactive sessions in telemetry.

---

### D5: Module-level pickleable job function

**Decision**: The APScheduler job function (`_run_cron_job`) is a module-level coroutine. The actual workflow callback is injected via a module-level singleton (`_cron_callback`), set during scheduler initialization.

**Rationale**: APScheduler's `RedisJobStore` serializes jobs using `pickle`. Closures and lambdas are not pickleable. Module-level functions are. The singleton pattern (from emergent) avoids passing the callable as a job argument, keeping the pickled job payload small and stable.

---

### D6: `schedule_task` tool in `execute` mode only

**Decision**: `schedule_task` is added to `execute` mode `tool_names`. It is NOT available in `analyze` or `chat` modes.

**Rationale**: Scheduling is a write/side-effect operation. It fits the execute mode contract (stateful, HITL-guarded). Analyze mode is read-only by design. Chat mode is fast-path with suppressed side effects.

## Risks / Trade-offs

**APScheduler pickle sensitivity** → Mitigation: module-level job function with no closure captures. If `_cron_callback` changes signature, existing pickled jobs will fail on next fire. Document: always clear Redis job namespace after updating `_run_cron_job`.

**Redis job store not transactional** → Mitigation: APScheduler handles job state atomically at the key level. Concurrent fires of the same job are prevented by APScheduler's `next_run_time` locking pattern.

**In-process dispatch blocks the event loop if job is CPU-heavy** → Mitigation: `stream_fn` is fully async. Acceptable for LLM workloads which are I/O-bound.

**Missed fires on long downtime** → APScheduler's `misfire_grace_time` (set to 60s) means jobs missed during a restart window are skipped, not replayed. This is acceptable for analysis/monitoring tasks but should be documented.

**No result delivery in v1** → Cron job results go to JSONL traces only. Users cannot query "what did the Monday job find?" via the agent today. This is a known gap — `query_findings` can serve results if the job calls `persist_findings`.

## Migration Plan

1. Add `apscheduler>=3.10` to `pyproject.toml` and run `uv sync`
2. Implement `src/cognitive_code_agent/tools/cron_tools.py` with scheduler init + tool
3. Register monkey-patch in `register.py` (after existing patches, before tool imports)
4. Add `schedule_task` to `config.yml` functions and `execute` mode `tool_names`
5. Add `schedule_task` to `register.py` `__all__`
6. Add unit tests for tool actions and integration test for scheduler lifecycle

**Rollback**: Remove `schedule_task` from `config.yml` tool_names. Scheduler never starts if the tool is not registered. Redis namespace `cgn:apscheduler:*` can be flushed manually.

## Open Questions

- Should jobs be tied to a `user_id` so different users can only see/cancel their own schedules? (v1: global namespace, revisit if multi-user conflicts arise)
- Should the agent confirm before scheduling (`TIER_2_CONFIRM` like emergent)? Or trust execute mode's existing HITL gate? (current: rely on execute mode `hitl_enabled: true`)

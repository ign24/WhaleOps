## Why

Users frequently ask the agent to perform recurring tasks ("analyze this repo every Monday", "run security scan nightly"). Today, the agent has no way to honor that request — every interaction is fire-and-forget. Adding cron scheduling as a first-class tool lets the agent become genuinely autonomous for routine workflows.

## What Changes

- New tool `schedule_task` registered in `config.yml` and `register.py` — exposes create / list / cancel actions to the agent
- New module `src/cognitive_code_agent/tools/cron_tools.py` — tool implementation + APScheduler init + module-level job runner
- Monkey-patch of NAT's FastAPI lifespan in `register.py` to start/stop `AsyncIOScheduler` alongside the server
- Scheduled jobs persist in Redis via APScheduler's `RedisJobStore` (Redis already in stack)
- Jobs are dispatched in-process: `stream_fn` called directly under session id `"cron:scheduled"` — no HTTP roundtrip
- `apscheduler>=3.10` added as a direct dependency in `pyproject.toml`

## Capabilities

### New Capabilities

- `cron-scheduler`: Agent-callable tool for managing recurring scheduled tasks. Supports create (cron expression + prompt), list, and cancel. Schedules persist in Redis across restarts. Jobs fire via in-process dispatch on the running asyncio event loop.
- `cron-job-runner`: Background AsyncIOScheduler lifecycle — starts at server startup via NAT lifespan monkey-patch, stops on shutdown. Module-level pickleable job function with injected callback singleton, required by APScheduler's Redis serialization.

### Modified Capabilities

## Impact

- **New dep**: `apscheduler>=3.10` (brings `APScheduler` with `RedisJobStore` support; no new infra required)
- **`register.py`**: One additional monkey-patch for NAT lifespan startup/shutdown
- **`config.yml`**: New `schedule_task` function entry; added to `execute` mode `tool_names`
- **`pyproject.toml`**: New dependency entry
- **Redis**: New key namespace `cgn:apscheduler:*` for APScheduler job store
- **No breaking changes**: all existing tools and modes unaffected

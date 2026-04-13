## 1. Dependencies & Setup

- [x] 1.1 Add `apscheduler>=3.10` to `pyproject.toml` dependencies and run `uv sync`
- [x] 1.2 Verify `RedisJobStore` import works: `from apscheduler.jobstores.redis import RedisJobStore`

## 2. Core Scheduler Module

- [x] 2.1 Create `src/cognitive_code_agent/tools/cron_tools.py` with module-level `_cron_callback` singleton and `_run_cron_job(prompt: str)` coroutine (must be module-level, not a closure)
- [x] 2.2 Implement `init_scheduler(redis_url: str, run_callback) -> AsyncIOScheduler` — configures `"default"` RedisJobStore (`cgn:apscheduler`) and `"volatile"` MemoryJobStore, sets `_cron_callback` singleton
- [x] 2.3 Add `BLOCKED_TOKENS` safety check in `_create_job()`: reject prompts containing `rm `, `kill `, `sudo `, `drop `, `delete `, `format `

## 3. `schedule_task` Tool

- [x] 3.1 Implement `schedule_task(action, cron_expr, prompt, description, job_id)` NAT tool with three action branches: `create`, `list`, `cancel`
- [x] 3.2 `create` branch: validate cron expression with `CronTrigger.from_crontab()`, run safety check, call `scheduler.add_job()` with `misfire_grace_time=60`, return job_id
- [x] 3.3 `list` branch: call `scheduler.get_jobs()`, format each job as `id | description | cron | next_run_time`, handle empty list case
- [x] 3.4 `cancel` branch: call `scheduler.remove_job(job_id)`, handle `JobLookupError` and return appropriate error message
- [x] 3.5 Register `schedule_task` with `@register_function` decorator

## 4. NAT Lifespan Integration

- [x] 4.1 In `register.py`, add monkey-patch of `FastApiFrontEndPluginWorker.configure` (after existing patches) that wraps the original `configure` to call `scheduler.start()` post-configure and schedules `scheduler.shutdown()` on lifespan exit
- [x] 4.2 Pass `REDIS_URL` from environment to `init_scheduler()` inside the lifespan patch (read from `os.environ` with fallback `"redis://localhost:6379/0"`)

## 5. Configuration

- [x] 5.1 Add `schedule_task` entry to `config.yml` under `functions:` with `_type: schedule_task` and description
- [x] 5.2 Add `schedule_task` to `execute` mode `tool_names` list in `config.yml`
- [x] 5.3 Add `schedule_task` to `register.py` imports and `__all__`

## 6. Tests

- [x] 6.1 Unit test `_create_job()` — valid cron, invalid cron expression, blocked token rejection
- [x] 6.2 Unit test `schedule_task` tool — mock scheduler, assert `add_job` / `get_jobs` / `remove_job` called correctly for each action
- [x] 6.3 Unit test `_run_cron_job` — verify it calls `_cron_callback` with the correct prompt
- [x] 6.4 Integration test: `init_scheduler` with real Redis — add a job, verify it appears in `get_jobs()`, remove it, verify gone
- [x] 6.5 Unit test lifespan patch — mock `configure`, verify scheduler `start()` called on entry and `shutdown()` called on exit

## 7. Documentation

- [x] 7.1 Update `ARCHITECTURE.md` — add cron scheduler to component table and note `cgn:apscheduler:*` Redis namespace
- [x] 7.2 Update `.env.example` if any new env var is introduced (none expected — reuses `REDIS_URL`)

## ADDED Requirements

### Requirement: Scheduler starts with the NAT server
The `AsyncIOScheduler` SHALL be started during NAT's FastAPI lifespan startup, via a monkey-patch of `FastAPIFrontEndPluginWorker.configure`. The scheduler SHALL be fully running before the first HTTP request is accepted.

#### Scenario: Scheduler starts on server boot
- **WHEN** the NAT server starts via `nat serve`
- **THEN** the `AsyncIOScheduler` SHALL be running with `RedisJobStore` connected and all persisted jobs loaded

#### Scenario: Scheduler stops on server shutdown
- **WHEN** the NAT server shuts down (lifespan context exits)
- **THEN** the scheduler SHALL be stopped gracefully (no running jobs left orphaned)

---

### Requirement: Jobs fire in-process via asyncio
When a scheduled job's cron time arrives, the system SHALL invoke the agent workflow directly in-process by calling the registered `stream_fn` callable on the running asyncio event loop. No HTTP request SHALL be issued.

#### Scenario: Job fires at scheduled time
- **WHEN** a job's next run time is reached
- **THEN** the system SHALL call `stream_fn` with the job's prompt under session `"cron:scheduled"` within the same asyncio event loop

#### Scenario: Job result is traceable
- **WHEN** a scheduled job fires and completes
- **THEN** a trace entry SHALL appear in the JSONL trace file with `session_id="cron:scheduled"` and the job's prompt

---

### Requirement: Job function is module-level and pickleable
The APScheduler job function (`_run_cron_job`) SHALL be defined at module level in `cron_tools.py`. It SHALL NOT be a closure or lambda. The workflow callback SHALL be injected via a module-level singleton (`_cron_callback`) set during `init_scheduler()`, not captured in the function signature.

#### Scenario: Job survives Redis serialization round-trip
- **WHEN** a job is added to the `RedisJobStore` and the scheduler is restarted
- **THEN** APScheduler SHALL deserialize and re-register the job function without `PicklingError`

---

### Requirement: Missed fires are skipped, not replayed
The scheduler SHALL configure `misfire_grace_time=60` seconds. Jobs that were missed during a server downtime window longer than 60 seconds SHALL be skipped on next startup. They SHALL NOT be executed retroactively.

#### Scenario: Job missed during long downtime
- **WHEN** a job was scheduled to fire while the server was down for more than 60 seconds
- **THEN** the job SHALL NOT fire on restart; next fire SHALL be at the next cron-calculated time

#### Scenario: Job missed during brief restart
- **WHEN** a job was scheduled to fire while the server was restarting and the delay is under 60 seconds
- **THEN** the job SHALL fire immediately on scheduler start

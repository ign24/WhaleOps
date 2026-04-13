## ADDED Requirements

### Requirement: Cron callback dispatches prompt to NAT workflow
When a scheduled job fires, the cron callback SHALL invoke the NAT agent workflow in-process using the captured `stream_fn` callable. The callback SHALL pass the job's prompt string and a fixed session ID `"cron:scheduled"`.

#### Scenario: Scheduled job triggers full agent run
- **WHEN** APScheduler fires a job with prompt `"Generate daily report"`
- **THEN** the system SHALL call `stream_fn` with that prompt and `session_id="cron:scheduled"`, executing the full agent graph (tool selection, memory, tracing)

#### Scenario: Callback handles stream_fn failure gracefully
- **WHEN** `stream_fn` raises an exception during a cron-triggered run
- **THEN** the system SHALL log the error with the job ID and prompt, and SHALL NOT crash the scheduler or affect other scheduled jobs

#### Scenario: Callback is a no-op when stream_fn is not captured
- **WHEN** a job fires but `stream_fn` was not captured during lifespan startup (e.g., builder did not expose it)
- **THEN** the system SHALL log a warning and return without error

---

### Requirement: stream_fn is captured during lifespan startup
The `_patched_configure` function in `register.py` SHALL extract `stream_fn` from the NAT builder after `original_configure` completes and pass it to `init_scheduler` as the `run_callback`.

#### Scenario: stream_fn is available after configure
- **WHEN** the NAT server starts and `original_configure` completes successfully
- **THEN** `stream_fn` SHALL be extracted from the builder and set as the cron callback via `init_scheduler(run_callback=...)`

#### Scenario: stream_fn is not available on builder
- **WHEN** the NAT builder does not expose `stream_fn` (e.g., API change)
- **THEN** the system SHALL log a warning, fall back to the log-only callback, and continue startup without crashing

---

### Requirement: Cron-triggered runs are traceable
All agent runs triggered by the cron scheduler SHALL produce trace entries distinguishable from interactive sessions.

#### Scenario: Trace entry includes cron session ID
- **WHEN** a cron-triggered agent run completes
- **THEN** the JSONL trace file SHALL contain entries with `session_id="cron:scheduled"` and the job's prompt

#### Scenario: Cron run appears in episodic memory
- **WHEN** a cron-triggered agent run completes and episodic memory is enabled
- **THEN** a session summary SHALL be persisted to Redis with `session_id="cron:scheduled"`

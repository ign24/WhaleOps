## MODIFIED Requirements

### Requirement: Jobs fire in-process via asyncio
When a scheduled job's cron time arrives, the system SHALL invoke the agent workflow directly in-process by calling the registered `stream_fn` callable on the running asyncio event loop. No HTTP request SHALL be issued. The callback SHALL be a real workflow dispatcher, not a log-only stub.

#### Scenario: Job fires at scheduled time
- **WHEN** a job's next run time is reached
- **THEN** the system SHALL call `stream_fn` with the job's prompt under session `"cron:scheduled"` within the same asyncio event loop

#### Scenario: Job result is traceable
- **WHEN** a scheduled job fires and completes
- **THEN** a trace entry SHALL appear in the JSONL trace file with `session_id="cron:scheduled"` and the job's prompt

#### Scenario: Callback is not a stub
- **WHEN** the scheduler is initialized during server startup
- **THEN** the `run_callback` passed to `init_scheduler` SHALL invoke the NAT workflow graph, not merely log the prompt

## ADDED Requirements

### Requirement: Agent can schedule a recurring task
The system SHALL expose a `schedule_task` tool that the agent can invoke to create a recurring scheduled job. The tool SHALL accept a standard 5-field cron expression, a prompt string (the message to send to the agent when the job fires), and a human-readable description. The tool SHALL return the assigned job ID.

#### Scenario: Create a valid schedule
- **WHEN** the agent calls `schedule_task` with action `"create"`, a valid cron expression (e.g. `"0 9 * * 1"`), a non-empty prompt, and a description
- **THEN** the system SHALL persist the job in Redis and return a job ID and confirmation message

#### Scenario: Reject invalid cron expression
- **WHEN** the agent calls `schedule_task` with action `"create"` and a malformed cron expression (e.g. `"not-a-cron"`)
- **THEN** the system SHALL return an error message describing the invalid expression and SHALL NOT create a job

#### Scenario: Reject dangerous prompt
- **WHEN** the agent calls `schedule_task` with a prompt containing shell-destructive tokens (`rm `, `kill `, `sudo `, `drop `)
- **THEN** the system SHALL return an error and SHALL NOT persist the job

---

### Requirement: Agent can list active schedules
The system SHALL allow the agent to retrieve all currently active scheduled jobs via `schedule_task` with action `"list"`. The response SHALL include job ID, description, cron expression, and next scheduled run time for each job.

#### Scenario: List when schedules exist
- **WHEN** the agent calls `schedule_task` with action `"list"` and at least one job is scheduled
- **THEN** the system SHALL return a formatted list with job ID, description, cron expression, and next run time

#### Scenario: List when no schedules exist
- **WHEN** the agent calls `schedule_task` with action `"list"` and no jobs are scheduled
- **THEN** the system SHALL return a message indicating no active schedules

---

### Requirement: Agent can cancel a scheduled task
The system SHALL allow the agent to cancel an existing scheduled job by job ID via `schedule_task` with action `"cancel"`.

#### Scenario: Cancel existing job
- **WHEN** the agent calls `schedule_task` with action `"cancel"` and a valid job ID
- **THEN** the system SHALL remove the job from Redis and return a confirmation message

#### Scenario: Cancel non-existent job
- **WHEN** the agent calls `schedule_task` with action `"cancel"` and a job ID that does not exist
- **THEN** the system SHALL return an error message indicating the job was not found

---

### Requirement: Schedules persist across server restarts
The system SHALL store all scheduled jobs in Redis via APScheduler's `RedisJobStore` under the namespace `cgn:apscheduler`. Jobs SHALL be automatically restored and resume firing after a server restart without any manual intervention.

#### Scenario: Job survives restart
- **WHEN** a job is created, the server is restarted, and the next scheduled time arrives
- **THEN** the job SHALL fire as if no restart occurred

---

### Requirement: `schedule_task` is available only in execute mode
The `schedule_task` tool SHALL appear in `execute` mode `tool_names` only. It SHALL NOT be available in `analyze`, `chat`, or any read-only mode.

#### Scenario: Tool available in execute mode
- **WHEN** the agent runs in `execute` mode
- **THEN** `schedule_task` SHALL be in the active tool set

#### Scenario: Tool not available in analyze mode
- **WHEN** the agent runs in `analyze` mode
- **THEN** `schedule_task` SHALL NOT be callable

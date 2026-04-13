## ADDED Requirements

### Requirement: List cron jobs via REST API
The system SHALL expose `GET /api/jobs/cron` returning a JSON array of all active APScheduler jobs. Each item SHALL include: `id`, `description`, `cron_expr`, `next_run` (ISO-8601 or null), and `status` (`"active"` or `"paused"`). The endpoint SHALL require authentication. If the scheduler is not initialized, it SHALL return HTTP 503 with a JSON error body.

#### Scenario: Jobs exist
- **WHEN** an authenticated client sends `GET /api/jobs/cron` and at least one job is scheduled
- **THEN** the system SHALL return HTTP 200 with a JSON array, each item containing `id`, `description`, `cron_expr`, `next_run`, and `status`

#### Scenario: No jobs scheduled
- **WHEN** an authenticated client sends `GET /api/jobs/cron` and no jobs are scheduled
- **THEN** the system SHALL return HTTP 200 with an empty JSON array `[]`

#### Scenario: Scheduler not initialized
- **WHEN** an authenticated client sends `GET /api/jobs/cron` and `cron_tools._scheduler` is `None`
- **THEN** the system SHALL return HTTP 503 with `{ "error": "scheduler not initialized" }`

#### Scenario: Unauthenticated request
- **WHEN** a client sends `GET /api/jobs/cron` without a valid session cookie
- **THEN** the system SHALL return HTTP 401

---

### Requirement: Create cron job via REST API
The system SHALL expose `POST /api/jobs/cron` accepting a JSON body with `cron_expr`, `prompt`, and `description`. It SHALL validate the cron expression and prompt using the same rules as `cron_tools._validate_cron` and `cron_tools._validate_prompt`. On success it SHALL return HTTP 201 with the created job's `id`, `description`, `cron_expr`, and `next_run`.

#### Scenario: Valid job creation
- **WHEN** an authenticated client sends `POST /api/jobs/cron` with valid `cron_expr`, non-empty `prompt`, and `description`
- **THEN** the system SHALL persist the job in APScheduler and return HTTP 201 with `id`, `description`, `cron_expr`, and `next_run`

#### Scenario: Invalid cron expression
- **WHEN** an authenticated client sends `POST /api/jobs/cron` with a malformed `cron_expr` (e.g. `"not-a-cron"`)
- **THEN** the system SHALL return HTTP 422 with `{ "error": "<description of invalid cron>" }` and SHALL NOT create a job

#### Scenario: Dangerous prompt
- **WHEN** an authenticated client sends `POST /api/jobs/cron` with a prompt containing a blocked token (e.g. `"rm "`)
- **THEN** the system SHALL return HTTP 422 with `{ "error": "<safety rejection reason>" }` and SHALL NOT create a job

#### Scenario: Missing required fields
- **WHEN** an authenticated client sends `POST /api/jobs/cron` with any of `cron_expr`, `prompt`, or `description` absent or empty
- **THEN** the system SHALL return HTTP 422

---

### Requirement: Cancel cron job via REST API
The system SHALL expose `DELETE /api/jobs/cron/{job_id}` that removes the specified job from APScheduler. On success it SHALL return HTTP 200 with `{ "cancelled": true, "id": "<job_id>" }`. If the job does not exist it SHALL return HTTP 404.

#### Scenario: Cancel existing job
- **WHEN** an authenticated client sends `DELETE /api/jobs/cron/{job_id}` with an existing job ID
- **THEN** the system SHALL remove the job from APScheduler and return HTTP 200 with `{ "cancelled": true, "id": "<job_id>" }`

#### Scenario: Cancel non-existent job
- **WHEN** an authenticated client sends `DELETE /api/jobs/cron/{job_id}` with a job ID that does not exist
- **THEN** the system SHALL return HTTP 404 with `{ "error": "job not found" }`

#### Scenario: Unauthenticated cancel
- **WHEN** a client sends `DELETE /api/jobs/cron/{job_id}` without a valid session cookie
- **THEN** the system SHALL return HTTP 401

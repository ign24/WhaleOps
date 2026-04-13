## ADDED Requirements

### Requirement: clone_repository accepts shallow parameter
The `clone_repository` tool SHALL accept an optional `shallow` boolean parameter (default `False`). When `shallow=True`, the clone SHALL use `--depth 1 --filter=blob:none` to perform a blobless shallow clone, fetching only the latest commit tree without full object history.

#### Scenario: Shallow clone on large repo
- **WHEN** the agent calls `clone_repository` with `shallow=True`
- **THEN** git runs with `--depth 1 --filter=blob:none`
- **THEN** the response includes `"clone_type": "shallow"` in the payload

#### Scenario: Full clone when shallow not specified
- **WHEN** the agent calls `clone_repository` without the `shallow` parameter
- **THEN** git runs a standard full clone (existing behavior unchanged)
- **THEN** the response includes `"clone_type": "full"` in the payload

### Requirement: clone_repository accepts timeout_seconds parameter
The `clone_repository` tool SHALL accept an optional `timeout_seconds` integer parameter (default `120`). The effective timeout SHALL be `min(timeout_seconds, 600)` to enforce a hard upper cap. The tool description string SHALL document this parameter so the LLM sees it in the tool schema.

#### Scenario: Agent sets higher timeout for large repo
- **WHEN** the agent calls `clone_repository` with `timeout_seconds=300`
- **THEN** the subprocess timeout is set to 300 seconds
- **THEN** the clone succeeds if it completes within 300 seconds

#### Scenario: timeout_seconds capped at 600
- **WHEN** the agent calls `clone_repository` with `timeout_seconds=700`
- **THEN** the effective timeout is capped at 600 seconds

#### Scenario: Default timeout preserved when not specified
- **WHEN** the agent calls `clone_repository` without `timeout_seconds`
- **THEN** the subprocess timeout is 120 seconds (existing behavior)

### Requirement: Timeout error response includes recovery hint
When a clone times out, the error response SHALL include a `hint` field with actionable guidance for the agent to self-correct on retry.

#### Scenario: Clone timeout produces hint
- **WHEN** a `clone_repository` call times out
- **THEN** the response payload includes `"hint": "consider shallow=true for large repos or increase timeout_seconds"`
- **THEN** `"retryable": true` remains in the payload

## MODIFIED Requirements

### Requirement: tool-control-output-filtering — timeout payload shape
The `clone_repository` timeout response payload MUST include the `hint` field in addition to the existing fields (`status`, `message`, `repo_path`, `source_url`, `retryable`).

#### Scenario: Timeout payload structure
- **WHEN** `clone_repository` times out
- **THEN** response contains: `status=timeout`, `message`, `repo_path`, `source_url`, `retryable=true`, `hint`

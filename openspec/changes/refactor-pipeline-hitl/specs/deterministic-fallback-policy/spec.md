## ADDED Requirements

### Requirement: HITL timeout is classified as a distinct failure class
The workflow SHALL classify interrupt timeouts as `HITL_TIMEOUT` failure class when a user does not respond to a write confirmation prompt within the configured timeout.

#### Scenario: Interrupt timeout classification
- **WHEN** a write tool's `interrupt()` call times out without user response
- **THEN** the workflow SHALL classify the event as `HITL_TIMEOUT`
- **AND** the policy SHALL be: `retryable: false`, `partial_finalize: false`, `action: "skip_and_continue"`

#### Scenario: Agent continues after HITL timeout
- **WHEN** a write is rejected due to `HITL_TIMEOUT`
- **THEN** the agent receives a rejection message and proceeds to the next file in the execution plan without retrying the same write

### Requirement: Write denial in analyze mode is classified as a distinct failure class
The workflow SHALL classify blocked write attempts in analyze mode as `WRITE_DENIED` failure class.

#### Scenario: Write denied classification
- **WHEN** a write tool is blocked by the analyze-mode write guard
- **THEN** the workflow SHALL classify the event as `WRITE_DENIED`
- **AND** the policy SHALL be: `retryable: false`, `partial_finalize: false`, `action: "replan_without_write"`

#### Scenario: Agent replans after write denial
- **WHEN** the agent in analyze mode receives a `WRITE_DENIED` error
- **THEN** it SHALL adjust its approach to use read-only tools and not re-attempt write operations

### Requirement: Rate limiting is classified as retryable
The workflow SHALL classify LLM rate limit errors (HTTP 429) as `RATE_LIMITED` failure class with bounded exponential backoff retry.

#### Scenario: Rate limit classification
- **WHEN** the LLM returns a 429 rate limit error
- **THEN** the workflow SHALL classify the event as `RATE_LIMITED`
- **AND** the policy SHALL be: `retryable: true`, `partial_finalize: true`, `action: "exponential_backoff_retry"`

#### Scenario: Rate limit retry with backoff
- **WHEN** a `RATE_LIMITED` failure occurs
- **THEN** the workflow SHALL wait with exponential backoff (base 2s, max 30s) before retrying, with at most 2 retry attempts

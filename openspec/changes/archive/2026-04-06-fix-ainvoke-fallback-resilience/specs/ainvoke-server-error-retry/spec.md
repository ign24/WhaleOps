## ADDED Requirements

### Requirement: ainvoke fallback SHALL retry on transient server errors
When the ainvoke fallback is invoked after a streaming failure and the ainvoke call itself raises a `SERVER_ERROR` or `RATE_LIMITED` exception, the agent SHALL retry with exponential backoff up to `_RATE_LIMIT_MAX_RETRIES` attempts before yielding a partial response. Non-retryable failure classes (e.g., `RECURSION_LIMIT`, `UNKNOWN_RUNTIME`) SHALL NOT trigger retry.

#### Scenario: ainvoke fails with 500 on first attempt then succeeds
- **WHEN** the ainvoke fallback is called after a stream failure
- **AND** the first ainvoke attempt raises a `SERVER_ERROR` exception
- **AND** the second attempt succeeds
- **THEN** the agent SHALL yield the successful response content
- **THEN** no partial response SHALL be emitted

#### Scenario: ainvoke fails with 500 on all attempts
- **WHEN** all `_RATE_LIMIT_MAX_RETRIES` ainvoke attempts raise `SERVER_ERROR`
- **THEN** the agent SHALL yield a partial response after the final attempt
- **THEN** the partial response SHALL include the `SERVER_ERROR` failure class in `blocked_by`

#### Scenario: ainvoke fails with non-retryable error — no retry
- **WHEN** the ainvoke fallback raises `UNKNOWN_RUNTIME` or `TOOL_CALL_ID_MISMATCH`
- **THEN** the agent SHALL yield a partial response immediately (no retry)
- **THEN** no backoff delay SHALL be applied

#### Scenario: retry emits backoff trace event per attempt
- **WHEN** a retryable ainvoke failure triggers a retry
- **THEN** a `rate_limit_backoff` trace event SHALL be emitted with `attempt`, `delay_s`, and `mode` fields before each sleep

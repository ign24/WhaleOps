## ADDED Requirements

### Requirement: DEGRADED stream failure SHALL attempt a single ainvoke probe
When the streaming path fails with `FailureClass.DEGRADED_FUNCTION`, the agent SHALL attempt exactly one ainvoke call before returning a structured partial response. This probe tests whether the remote function has recovered between the stream failure and the ainvoke attempt.

#### Scenario: Stream DEGRADED but ainvoke succeeds (function recovered)
- **WHEN** streaming fails with DEGRADED_FUNCTION
- **AND** the subsequent ainvoke probe succeeds
- **THEN** the agent SHALL use the ainvoke result as the response
- **AND** emit a trace event `degraded_probe_recovered` with the function ID

#### Scenario: Stream DEGRADED and ainvoke probe also fails
- **WHEN** streaming fails with DEGRADED_FUNCTION
- **AND** the subsequent ainvoke probe also fails with DEGRADED_FUNCTION
- **THEN** the agent SHALL return a structured partial response with `blocked_by` listing the degraded function IDs
- **AND** emit a trace event `degraded_probe_failed`

#### Scenario: Stream DEGRADED and ainvoke probe fails with different error
- **WHEN** streaming fails with DEGRADED_FUNCTION
- **AND** the subsequent ainvoke probe fails with a different failure class (e.g., SERVER_ERROR)
- **THEN** the agent SHALL classify the new failure and apply its corresponding policy
- **AND** the DEGRADED function ID SHALL remain in the request blacklist

### Requirement: DEGRADED ainvoke probe SHALL be bounded
The ainvoke probe SHALL execute exactly once with no backoff delay. It SHALL NOT retry on failure. The probe SHALL use the same `invoke_state` and `invoke_cfg` as the normal ainvoke fallback path.

#### Scenario: Probe executes exactly once
- **WHEN** streaming fails with DEGRADED_FUNCTION
- **THEN** the agent SHALL execute exactly one ainvoke call (not zero, not two)
- **AND** the total added latency is bounded to one HTTP round-trip

#### Scenario: Probe uses recovery invoke state
- **WHEN** the ainvoke probe is executed
- **THEN** it SHALL use `_build_recovery_invoke_state` with `failure_label="degraded_probe"`
- **AND** include the accumulated `recovery_notes` from the stream failure

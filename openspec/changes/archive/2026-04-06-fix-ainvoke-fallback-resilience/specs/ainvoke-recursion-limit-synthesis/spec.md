## ADDED Requirements

### Requirement: ainvoke fallback SHALL use synthesis-only mode after recursion-limit stream failure
When `recovery_notes` indicates the stream failed due to `RECURSION_LIMIT`, the ainvoke fallback SHALL use a synthesis-only invoke state with a capped recursion limit instead of re-running the full analysis task from scratch.

#### Scenario: synthesis state used when stream exhausted recursion budget
- **WHEN** `recovery_notes` contains the recursion-limit stream failure marker
- **AND** the ainvoke fallback is invoked
- **THEN** the invoke state SHALL include a synthesis instruction directing the model to summarize partial findings without re-running tools
- **THEN** the `recursion_limit` for the ainvoke call SHALL be capped at 12 (not the original streaming budget)

#### Scenario: full-task ainvoke used when stream failed for other reasons
- **WHEN** `recovery_notes` does NOT contain the recursion-limit stream failure marker
- **THEN** the ainvoke fallback SHALL use the normal recovery state (existing behavior unchanged)
- **THEN** the original `recursion_cfg` SHALL be used

#### Scenario: synthesis ainvoke produces best-effort output
- **WHEN** the synthesis-only ainvoke succeeds
- **THEN** the agent SHALL yield the synthesis response content regardless of length
- **THEN** the response MAY be brief or partial — this is acceptable

#### Scenario: synthesis ainvoke also fails — partial response emitted
- **WHEN** the synthesis-only ainvoke fails (any exception)
- **THEN** the agent SHALL yield a partial response with `failure_class=RECURSION_LIMIT`
- **THEN** `blocked_by` SHALL indicate both the stream recursion limit and the synthesis failure

### Requirement: recursion-limit stream failure marker SHALL be a module-level constant
The string used to detect a recursion-limit stream failure in `recovery_notes` SHALL be defined as a module-level constant `_STREAM_FAILURE_RECURSION` in `safe_tool_calling_agent.py`, co-located with the code that writes it.

#### Scenario: constant is used at both write and read sites
- **WHEN** the stream failure is appended to `recovery_notes` after a `RECURSION_LIMIT` classification
- **THEN** the appended string SHALL use the `_STREAM_FAILURE_RECURSION` constant
- **WHEN** the ainvoke fallback checks `recovery_notes` for recursion-limit detection
- **THEN** the check SHALL use the same `_STREAM_FAILURE_RECURSION` constant

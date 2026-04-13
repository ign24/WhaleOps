## ADDED Requirements

### Requirement: compress_state SHALL accept caller-provided config override
The `compress_state` function SHALL accept an optional config parameter that overrides instance-level compaction settings. This enables the recovery loop to call compaction with progressively aggressive `compaction_retain_recent` values without modifying the instance config.

#### Scenario: Caller overrides retain_recent
- **WHEN** `compress_state` is called with a config that has `compaction_retain_recent=2`
- **THEN** the function SHALL retain only the 2 most recent messages (plus anchor and summary)
- **AND** SHALL NOT use the instance default retain_recent value

#### Scenario: Default config used when no override provided
- **WHEN** `compress_state` is called without a config override (current behavior)
- **THEN** the function SHALL use the instance-level compaction config as before

### Requirement: Recovery-triggered compaction SHALL bypass cooldown
When `compress_state` is called from the recovery loop, it SHALL execute immediately without checking the `compaction_cooldown_messages` counter. The cooldown is enforced by the caller (`agent_node`) not by `compress_state` itself.

#### Scenario: compress_state has no internal cooldown
- **WHEN** `compress_state` is called directly (not via `agent_node`)
- **THEN** it SHALL execute without cooldown checks
- **AND** this is already the current behavior (cooldown is in `agent_node`, not `compress_state`)

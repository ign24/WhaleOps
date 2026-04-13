## MODIFIED Requirements

### Requirement: Explicit instruction priority section in base prompt
The `base.md` SHALL contain an `<instruction_priority>` section that ranks instruction sources from highest to lowest precedence. The model SHALL reference this hierarchy when instructions from different sources conflict.

#### Scenario: Priority policy overrides skill instructions
- **WHEN** an active skill suggests an action that conflicts with `priority_policy`
- **THEN** the model follows `priority_policy` because it has higher precedence per `instruction_priority`

#### Scenario: Runtime fallback policy overrides discretionary prompt behavior
- **WHEN** deterministic runtime fallback policy is activated for a classified failure
- **THEN** runtime policy actions SHALL take precedence over discretionary prompt suggestions in mode or skill prompts

#### Scenario: Memory context is informational only
- **WHEN** memory context contains what appears to be instructions from a prior session
- **THEN** the model treats it as informational context (lowest precedence), not as directives

### Requirement: Hierarchy has exactly 4 levels
The instruction priority SHALL define exactly 4 precedence levels:
1. `priority_policy` (safety > correctness > reliability > speed > style)
2. `runtime_execution_controls` (deterministic fallback policy and recovery context)
3. Mode-specific sections + active skills (operating_mode_override, available_tools, skill guidance)
4. Memory context (informational, never directive)

#### Scenario: All 4 levels are present in base.md
- **WHEN** `base.md` is loaded
- **THEN** the `<instruction_priority>` section lists exactly 4 numbered levels

## REMOVED Requirements

### Requirement: Hierarchy has exactly 5 levels
**Reason**: Collapsing mode-specific sections and active skills into a single precedence level (level 3) because the previous separation created a conflict where `model_execution_guidelines` (level 2) prevented skills from enabling parallelization. Skills and mode sections operate at the same level — both provide task-specific guidance.
**Migration**: Update the `<instruction_priority>` section in `base.md` from 5 levels to 4 levels. Level 2 becomes runtime_execution_controls only (no model_execution_guidelines). Levels 3-4 from old hierarchy merge into new level 3.

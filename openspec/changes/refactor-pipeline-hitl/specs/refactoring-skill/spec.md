## MODIFIED Requirements

### Requirement: Refactoring skill enforces a per-file read-plan-write-validate cycle
The skill SHALL instruct the executor to process files following the structured plan from analyze. The executor MUST NOT autonomously re-plan. The cycle is: load plan, execute per-file, validate.

#### Scenario: Execute loads plan before acting
- **WHEN** the refactoring skill is activated in execute mode
- **THEN** the executor SHALL first call `query_findings(finding_type="refactoring_plan")` to load the structured plan and process files in `execution_order`

#### Scenario: Single file execution cycle (plan-driven)
- **WHEN** the executor processes a file from the loaded plan
- **THEN** it SHALL: (1) read the file content, (2) package a structured query with project context + plan entry for this file + file content + relevant expert guidelines, (3) call `refactor_gen`, (4) write the result with `write_file` (triggering HITL gate if enabled), (5) run the validation command specified in the plan entry

#### Scenario: Devstral adjusts the plan
- **WHEN** `refactor_gen` returns code that differs from the original plan (e.g., devstral found an issue the plan missed)
- **THEN** the executor SHALL accept the adjustment and note it in the final manifest

#### Scenario: Validation failure
- **WHEN** a linter reports errors after writing a refactored file
- **THEN** the executor SHALL re-invoke `refactor_gen` with the error output appended to the query, up to 2 retry attempts per file

#### Scenario: No plan available — freeform fallback
- **WHEN** no `refactoring_plan` finding exists and the user provides explicit instructions
- **THEN** the executor SHALL operate in freeform mode: detect stack, plan from user instructions, then execute the per-file cycle

### Requirement: Refactoring skill activates in execute mode, not refactor mode
The skill SHALL be loaded when the user enters execute mode with a refactoring-related task. The refactor mode no longer exists.

#### Scenario: Skill activation in execute mode
- **WHEN** the user enters `/execute` and the task description matches refactoring triggers
- **THEN** the `refactoring` skill SHALL be activated in execute mode context

#### Scenario: /refactor alias
- **WHEN** the user enters `/refactor`
- **THEN** the system SHALL route to execute mode and emit a deprecation notice: "Note: /refactor is now /execute."

## REMOVED Requirements

### Requirement: Refactored files are written on the cloned repo
**Reason**: Execute mode operates on any workspace, not exclusively cloned repos. The workspace policy is defined by the execute prompt, not the skill.
**Migration**: Write paths are determined by the execution plan's file paths. `/tmp/analysis` and `/app/workspace` semantics are inherited from the execute mode prompt.

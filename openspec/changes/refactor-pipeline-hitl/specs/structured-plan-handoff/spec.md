## ADDED Requirements

### Requirement: Analyze mode persists a structured execution plan
When analyze mode completes a task that produces actionable findings (refactoring, fixes, improvements), it SHALL persist a structured execution plan as a `FindingRecord` with `finding_type: "refactoring_plan"` in the existing Milvus collection.

#### Scenario: Analyze produces plan after full analysis
- **WHEN** analyze mode completes an analysis that identifies actionable code changes
- **THEN** it persists a finding with `finding_type: "refactoring_plan"` containing a JSON plan with fields: `plan_version`, `stack`, `goals`, `files` (array of {path, priority, changes, validation}), `execution_order`, `constraints`

#### Scenario: Plan contains file-level granularity
- **WHEN** a refactoring plan is persisted
- **THEN** each entry in `files` array SHALL include `path` (relative file path), `priority` (P0/P1/P2), `changes` (description of intended transformation), and `validation` (command to run after modification)

#### Scenario: Analyze with no actionable findings
- **WHEN** analyze completes but finds no code changes needed
- **THEN** no refactoring_plan finding is persisted; only diagnostic findings are stored

### Requirement: Execute mode loads plan before acting
Execute mode SHALL query for a structured plan as its first action. If a plan exists, execute follows it. If not, it asks the user for explicit instructions.

#### Scenario: Plan exists from prior analyze
- **WHEN** user enters `/execute` and a `refactoring_plan` finding exists for the current repo
- **THEN** execute loads the plan and processes files in `execution_order` without autonomous re-planning

#### Scenario: No plan available
- **WHEN** user enters `/execute` and no `refactoring_plan` finding exists
- **THEN** execute informs the user and asks for explicit instructions or suggests running `/analyze` first

#### Scenario: Plan with mixed priorities
- **WHEN** a plan contains P0, P1, and P2 files
- **THEN** execute processes P0 files first, then P1, then P2, following `execution_order` within each priority tier

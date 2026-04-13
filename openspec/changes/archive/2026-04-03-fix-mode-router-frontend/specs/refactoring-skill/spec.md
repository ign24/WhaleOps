## MODIFIED Requirements

### Requirement: Refactoring skill enforces a per-file read-plan-write-validate cycle
The skill SHALL instruct the orchestrator to process files one at a time following a mandatory cycle. The orchestrator MUST NOT stop at showing snippets or proposing changes. If a validation tool fails with "No such file or directory" or "Connection refused", the orchestrator SHALL NOT retry that tool. It SHALL record the failure and continue with the next file.

#### Scenario: Single file refactoring cycle
- **WHEN** the orchestrator processes a file from the refactoring plan
- **THEN** it SHALL: (1) read the file content, (2) package a structured query with project context + plan for this file + file content + relevant expert guidelines, (3) call `refactor_gen`, (4) write the result to the cloned repo with `write_file`, (5) run the appropriate linter

#### Scenario: Devstral adjusts the plan
- **WHEN** `refactor_gen` returns code that differs from the original plan (e.g., devstral found an issue the plan missed)
- **THEN** the orchestrator SHALL accept the adjustment and note it in the final manifest

#### Scenario: Validation failure
- **WHEN** a linter reports errors after writing a refactored file
- **THEN** the orchestrator SHALL re-invoke `refactor_gen` with the error output appended to the query, up to 2 retry attempts per file

#### Scenario: Validation tool not available
- **WHEN** a linter or validation tool fails with "No such file or directory" or "Connection refused"
- **THEN** the orchestrator SHALL NOT retry the tool, SHALL record that validation was skipped for that file, and SHALL continue to the next file in the plan

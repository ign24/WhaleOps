## MODIFIED Requirements

### Requirement: Refactoring skill enforces a per-file read-plan-write-validate cycle
The skill SHALL instruct the orchestrator to process files one at a time following a mandatory cycle. The orchestrator MUST NOT stop at showing snippets or proposing changes. **When existing tests are detected, the orchestrator SHALL verify they pass before starting any refactoring (safety net), and verify they still pass after completing each file.**

#### Scenario: Single file refactoring cycle
- **WHEN** the orchestrator processes a file from the refactoring plan
- **THEN** it SHALL: (1) read the file content, (2) package a structured query with project context + plan for this file + file content + relevant expert guidelines, (3) call `refactor_gen`, (4) write the result to the cloned repo with `write_file`, (5) run the appropriate linter

#### Scenario: Devstral adjusts the plan
- **WHEN** `refactor_gen` returns code that differs from the original plan (e.g., devstral found an issue the plan missed)
- **THEN** the orchestrator SHALL accept the adjustment and note it in the final manifest

#### Scenario: Validation failure
- **WHEN** a linter reports errors after writing a refactored file
- **THEN** the orchestrator SHALL re-invoke `refactor_gen` with the error output appended to the query, up to 2 retry attempts per file

#### Scenario: Test safety net before refactoring
- **WHEN** the orchestrator detects an existing test suite in the project (pytest, jest, or equivalent)
- **THEN** it SHALL run the test suite before beginning any file modifications to establish a GREEN baseline

#### Scenario: Test safety net after each file
- **WHEN** the orchestrator completes the write-validate cycle for a refactored file and a test suite exists
- **THEN** it SHALL run the relevant tests to verify the refactoring did not introduce regressions

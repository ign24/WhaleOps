## ADDED Requirements

### Requirement: TDD skill registered in skill registry
The system SHALL register a `tdd` skill in `registry.yml` with category `correctness`, priority `12`, required tools `run_pytest` and `run_jest`, and a dedicated skill file at `prompts/skills/tdd.md`.

#### Scenario: Skill registration with correct metadata
- **WHEN** the skill registry is loaded
- **THEN** the `tdd` skill SHALL be present with `enabled: true`, `category: correctness`, `priority: 12`, and `file` pointing to `src/cognitive_code_agent/prompts/skills/tdd.md`

#### Scenario: Required tools gate activation
- **WHEN** the runtime does not have `run_pytest` or `run_jest` available
- **THEN** the `tdd` skill SHALL NOT be activated for that request

### Requirement: TDD skill activates on implementation-related messages
The system SHALL activate the `tdd` skill when the user message contains implementation-related keywords, in both English and Spanish.

#### Scenario: English implementation triggers
- **WHEN** the user sends a message containing "implement", "feature", "new function", "fix bug", "write code", "add", "create", or "build"
- **THEN** the `tdd` skill SHALL be a candidate for activation (subject to priority ranking and budget)

#### Scenario: Spanish implementation triggers
- **WHEN** the user sends a message containing "implementar", "crear", "construir", or "agregar"
- **THEN** the `tdd` skill SHALL be a candidate for activation

#### Scenario: TDD does not compete with senior-qa triggers
- **WHEN** the user sends a message containing only QA-specific keywords ("test", "qa", "coverage", "flaky")
- **THEN** the `tdd` skill SHALL NOT activate; `senior-qa` SHALL activate instead

### Requirement: TDD skill content provides RED-GREEN-REFACTOR methodology
The skill file SHALL contain the RED-GREEN-REFACTOR cycle adapted to the agent's tool constraints, with clear guidance on when to apply and when to skip.

#### Scenario: Skill teaches the full cycle
- **WHEN** the `tdd` skill is injected into the prompt
- **THEN** the skill content SHALL describe: (1) write a failing test using the project's test framework, (2) run the test to verify it fails (RED), (3) write minimal code to make the test pass, (4) run the test to verify it passes (GREEN), (5) refactor while keeping tests green

#### Scenario: Skill provides skip criteria
- **WHEN** the `tdd` skill is injected into the prompt
- **THEN** the skill content SHALL list cases where TDD should be skipped: shell/git operations, configuration changes, infrastructure tasks, single-line patches, and projects with no test framework detected

#### Scenario: Skill advises test framework detection
- **WHEN** the `tdd` skill is injected into the prompt
- **THEN** the skill content SHALL instruct the agent to detect the project's test framework before writing tests (check for `pytest.ini`, `pyproject.toml [tool.pytest]`, `jest.config.*`, `tests/` directory, `__tests__/` directory)

#### Scenario: Skill fits within budget
- **WHEN** the `tdd` skill content is loaded
- **THEN** the content SHALL be under 4000 characters to leave budget room for a second active skill

### Requirement: Execute prompt references TDD availability
The `execute.md` system prompt SHALL include a single line in the Code Writing Policy section acknowledging that TDD is available as a skill for new code and bug fixes.

#### Scenario: TDD reference in execute prompt
- **WHEN** the execute mode prompt is composed
- **THEN** the Code Writing Policy section SHALL contain a line stating that TDD (write a failing test first) is available as a strategy when writing new code or fixing bugs

#### Scenario: Reference does not teach TDD
- **WHEN** the execute mode prompt is composed without the TDD skill activated
- **THEN** the reference line SHALL NOT contain the full TDD methodology — only a pointer that the capability exists

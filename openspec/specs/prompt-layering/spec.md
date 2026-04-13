## ADDED Requirements

### Requirement: Base prompt contains only global sections
The `base.md` file SHALL contain exclusively global sections that apply to all modes: `identity`, `priority_policy`, `workflow_policy`, `operating_mode`, `model_execution_guidelines`, `memory_policy`, `instruction_priority`, and `skills_runtime`. It SHALL NOT contain mode-specific sections (`full_analysis_protocol`, `code_writing_policy`, `output_contract`).

#### Scenario: Base prompt does not contain full_analysis_protocol
- **WHEN** `base.md` is loaded
- **THEN** it SHALL NOT contain a `<full_analysis_protocol>` section

#### Scenario: Base prompt does not contain code_writing_policy
- **WHEN** `base.md` is loaded
- **THEN** it SHALL NOT contain a `<code_writing_policy>` section

### Requirement: Mode prompts contain only mode-specific sections
Each mode prompt (`analyze.md`, `refactor.md`, `execute.md`) SHALL contain only sections specific to that mode. No section that exists in `base.md` SHALL be duplicated in a mode prompt, except `operating_mode_override` which appends mode-specific behavioral constraints.

#### Scenario: Analyze prompt has no duplicated global sections
- **WHEN** `analyze.md` is loaded
- **THEN** it SHALL NOT contain `<identity>`, `<priority_policy>`, `<workflow_policy>`, `<model_execution_guidelines>`, `<memory_policy>`, or `<skills_runtime>` sections

#### Scenario: Refactor prompt has no duplicated global sections
- **WHEN** `refactor.md` is loaded
- **THEN** it SHALL NOT contain `<identity>`, `<priority_policy>`, `<workflow_policy>`, `<model_execution_guidelines>`, `<memory_policy>`, or `<skills_runtime>` sections

#### Scenario: Execute prompt has no duplicated global sections
- **WHEN** `execute.md` is loaded
- **THEN** it SHALL NOT contain `<identity>`, `<priority_policy>`, `<workflow_policy>`, `<model_execution_guidelines>`, or `<skills_runtime>` sections

### Requirement: Full analysis protocol lives in analyze mode only
The `full_analysis_protocol` section SHALL exist only in `analyze.md`. It SHALL NOT appear in `base.md`, `refactor.md`, or `execute.md`.

#### Scenario: Full analysis protocol is in analyze.md
- **WHEN** a full analysis is requested
- **THEN** the `full_analysis_protocol` is available because it is part of `analyze.md`

#### Scenario: Refactor mode does not load full_analysis_protocol
- **WHEN** the agent operates in refactor mode
- **THEN** the system prompt SHALL NOT contain `full_analysis_protocol`

### Requirement: Code writing policy lives in refactor mode only
The `code_writing_policy` section SHALL exist only in `refactor.md`.

#### Scenario: Code writing policy is in refactor.md
- **WHEN** the agent operates in refactor mode
- **THEN** `code_writing_policy` is available in the system prompt

#### Scenario: Analyze mode does not load code_writing_policy
- **WHEN** the agent operates in analyze mode
- **THEN** the system prompt SHALL NOT contain `code_writing_policy`

### Requirement: Reader agent has directory_tree constraints
The `reader_agent` configuration in `config.yml` SHALL include a `system_prompt` field containing the `directory_tree_policy` (mandatory excludePatterns) and preference for `list_directory` + `read_text_file` over `directory_tree`.

#### Scenario: Reader agent uses excludePatterns on directory_tree
- **WHEN** `reader_agent` calls `directory_tree`
- **THEN** its system prompt instructs it to ALWAYS include excludePatterns: `[".git", "node_modules", "__pycache__", ".venv", "dist", "build", ".next", ".tox", "vendor", ".mypy_cache", ".ruff_cache", "coverage", ".pytest_cache"]`

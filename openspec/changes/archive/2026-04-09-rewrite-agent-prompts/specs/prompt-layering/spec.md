## MODIFIED Requirements

### Requirement: Base prompt contains only global sections
The `base.md` file SHALL contain exclusively global sections that apply to all modes: `identity`, `environment`, `priority_policy`, `operating_principles`, `memory_policy`, and `skills_runtime`. It SHALL NOT contain mode-specific sections (`full_analysis_protocol`, `code_writing_policy`, `output_contract`) or prescriptive execution guidelines (`model_execution_guidelines`).

#### Scenario: Base prompt does not contain full_analysis_protocol
- **WHEN** `base.md` is loaded
- **THEN** it SHALL NOT contain a `<full_analysis_protocol>` section

#### Scenario: Base prompt does not contain code_writing_policy
- **WHEN** `base.md` is loaded
- **THEN** it SHALL NOT contain a `<code_writing_policy>` section

#### Scenario: Base prompt does not contain model_execution_guidelines
- **WHEN** `base.md` is loaded
- **THEN** it SHALL NOT contain a `<model_execution_guidelines>` section

#### Scenario: Base prompt contains environment section
- **WHEN** `base.md` is loaded
- **THEN** it SHALL contain an `<environment>` section describing the runtime context

### Requirement: Mode prompts contain only mode-specific sections
Each mode prompt (`analyze.md`, `execute.md`, `chat.md`) SHALL contain only sections specific to that mode: `operating_mode_override`, mode-specific tool guidance, and output guidelines. No section that exists in `base.md` SHALL be duplicated in a mode prompt.

#### Scenario: Analyze prompt has no duplicated global sections
- **WHEN** `analyze.md` is loaded
- **THEN** it SHALL NOT contain `<identity>`, `<priority_policy>`, `<environment>`, `<memory_policy>`, or `<skills_runtime>` sections

#### Scenario: Execute prompt has no duplicated global sections
- **WHEN** `execute.md` is loaded
- **THEN** it SHALL NOT contain `<identity>`, `<priority_policy>`, `<environment>`, `<memory_policy>`, or `<skills_runtime>` sections

#### Scenario: No policy is duplicated across mode prompts
- **WHEN** `analyze.md` and `execute.md` are both loaded
- **THEN** no policy section (e.g., directory_tree_policy) SHALL appear in both files

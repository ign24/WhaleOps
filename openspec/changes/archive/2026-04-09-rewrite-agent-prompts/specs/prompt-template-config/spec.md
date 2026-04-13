## ADDED Requirements

### Requirement: config.yml contains a prompt_config section with team-adjustable variables
The `config.yml` SHALL contain a `prompt_config` section with key-value pairs that control agent identity, behavior, and presentation. Each key SHALL have a sensible default value.

#### Scenario: Default config produces working agent
- **WHEN** `prompt_config` section uses all default values
- **THEN** the agent operates with a neutral code intelligence identity, structured output, high autonomy, and no emojis

#### Scenario: Team customizes agent identity
- **WHEN** a team sets `agent_name: "SecBot"` and `identity: "A security-focused code auditor"` in prompt_config
- **THEN** the base prompt renders with that identity instead of the default

#### Scenario: Team sets emoji communication style
- **WHEN** a team sets `emoji_set: "..."` with specific emoji characters in prompt_config
- **THEN** the agent's prompt includes guidance to use those emojis in its responses

#### Scenario: Team adjusts output style
- **WHEN** a team sets `output_style: "minimal"` in prompt_config
- **THEN** the output guidelines in mode prompts reflect a preference for minimal, concise responses

### Requirement: Prompt files use {{variable}} placeholders
All system prompt files (base.md and mode prompts) SHALL use `{{variable_name}}` syntax for team-configurable content. The variable names SHALL match keys in `prompt_config`.

#### Scenario: base.md uses identity placeholder
- **WHEN** base.md is read from disk
- **THEN** it contains `{{identity}}` in the identity section, not hardcoded text

#### Scenario: Unresolved placeholder renders as empty with warning
- **WHEN** a prompt file contains `{{unknown_var}}` that has no matching key in prompt_config
- **THEN** the placeholder is replaced with an empty string and a warning is logged

### Requirement: composer.py renders templates before returning prompts
The `load_base_prompt` function (or a new `render_template` function it calls) SHALL replace all `{{variable}}` placeholders in prompt text with values from prompt_config before returning the composed prompt.

#### Scenario: Rendering happens at load time
- **WHEN** `load_base_prompt("base.md")` is called
- **THEN** the returned string contains resolved values, not `{{placeholder}}` syntax

#### Scenario: Mode prompts are also rendered
- **WHEN** a mode prompt (analyze.md, execute.md, chat.md) is loaded
- **THEN** any `{{variable}}` placeholders in that file are also resolved from prompt_config

### Requirement: prompt_config variables have documented defaults
Each variable in `prompt_config` SHALL have a comment in config.yml explaining what it controls and what values are valid.

#### Scenario: New team member reads config
- **WHEN** a developer opens config.yml and reads the prompt_config section
- **THEN** each variable has a YAML comment explaining its purpose and valid values

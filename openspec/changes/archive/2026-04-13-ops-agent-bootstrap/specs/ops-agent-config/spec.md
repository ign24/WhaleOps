## ADDED Requirements

### Requirement: ops mode defined in config.yml
The system SHALL define an `ops` mode in `config.yml` under `workflow.modes` with: `llm_name: devstral`, `prompt_path: src/cognitive_code_agent/prompts/system/ops.md`, `max_iterations: 20`, `max_history: 8`, `tool_call_timeout_seconds: 30`, and `tool_names: [vps_status, list_services, get_logs, query_findings, schedule_task]`.

#### Scenario: ops mode boots without error
- **WHEN** the agent starts with `default_mode: ops`
- **THEN** the ops mode graph compiles successfully with the listed tools and no startup errors

#### Scenario: ops mode excludes all code-agent tools
- **WHEN** the agent is in ops mode
- **THEN** no code-review, SAST, clone, refactor, or code-execution tools are available to the LLM

### Requirement: default_mode set to ops
The system SHALL set `workflow.default_mode: ops` in `config.yml`.

#### Scenario: Agent defaults to ops mode
- **WHEN** a user message arrives without a mode prefix
- **THEN** the Tier 0 classifier or `resolve_mode()` resolves to `ops` (or `chat` for greetings)

### Requirement: chat mode retained with ops identity
The system SHALL retain the `chat` mode with `llm_name: kimi_reader`, updated `prompt_path: src/cognitive_code_agent/prompts/system/chat.md` (ops version), `max_iterations: 3`, `max_history: 4`, and `tool_names: [query_findings]`.

#### Scenario: chat mode triggers on greeting
- **WHEN** a user sends "hello" or a capability question
- **THEN** Tier 0 routes to chat mode and the agent responds without calling ops tools

### Requirement: analyze and execute modes removed from config
The system SHALL remove the `analyze` and `execute` entries from `workflow.modes` in `config.yml`.

#### Scenario: No analyze or execute mode available
- **WHEN** the agent starts
- **THEN** attempting to invoke `/analyze` or `/execute` prefix falls through to ops or chat rather than loading the old code-agent modes

### Requirement: Code-agent function groups removed from active tool_names
The system SHALL remove all code-specific function groups (`fs_tools_write` writes, `github_tools`, `context7_tools`, `run_semgrep`, `run_trivy`, `run_gitleaks`, `run_bandit`, `run_ruff`, `run_eslint`, `run_pytest`, `run_jest`, `analyze_complexity`, `analyze_docstrings`, `analyze_api_docs`, `code_gen`, `refactor_gen`, `code_exec`, `clone_repository`, `spawn_agent`, `generate_report`) from all active mode tool_names.

#### Scenario: Code tools not bound at startup
- **WHEN** the agent boots with the updated config
- **THEN** code-analysis tool names do not appear in any active mode's tool list

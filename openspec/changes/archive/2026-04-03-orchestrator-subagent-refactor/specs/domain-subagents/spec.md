## ADDED Requirements

### Requirement: Four domain sub-agents defined in config.yml
The system SHALL define `security_agent`, `qa_agent`, `review_agent`, and `docs_agent` as `_type: tool_calling_agent` in `config.yml`, each with a focused toolset, a dedicated prompt path, `max_iterations: 8`, and a description that tells the orchestrator when to use it.

#### Scenario: security_agent exposes only security tools
- **WHEN** the analyze orchestrator calls `security_agent`
- **THEN** the sub-agent has access to exactly: `run_semgrep`, `run_trivy`, `run_gitleaks`, `run_bandit` — and no other tools

#### Scenario: qa_agent exposes only QA tools
- **WHEN** the analyze orchestrator calls `qa_agent`
- **THEN** the sub-agent has access to exactly: `run_pytest`, `run_jest`, `analyze_test_coverage`, `query_qa_knowledge`

#### Scenario: review_agent exposes only code review tools
- **WHEN** the analyze orchestrator calls `review_agent`
- **THEN** the sub-agent has access to exactly: `run_ruff`, `run_eslint`, `analyze_complexity`, `get_diff`

#### Scenario: docs_agent exposes only documentation tools
- **WHEN** the analyze orchestrator calls `docs_agent`
- **THEN** the sub-agent has access to exactly: `analyze_docstrings`, `check_readme`, `analyze_api_docs`

### Requirement: Analyze orchestrator exposes exactly 8 tools
The analyze mode SHALL list exactly these tool_names: `security_agent`, `qa_agent`, `review_agent`, `docs_agent`, `reader_agent`, `clone_repository`, `persist_findings`, `query_findings`.

#### Scenario: Analyze mode tool count
- **WHEN** the analyze mode runtime is built
- **THEN** the log line `Built mode 'analyze': llm=... tools=8` is emitted

#### Scenario: No direct domain tools at orchestrator level
- **WHEN** the analyze orchestrator receives a security-related request
- **THEN** it calls `security_agent` with a question string — it does NOT call `run_semgrep` directly

### Requirement: Sub-agent prompts are domain-focused and under 30 lines
Each sub-agent SHALL have a system prompt that describes only its domain role, its tools, and its output format. No tool listings from other domains, no multi-phase protocols, no skill injection.

#### Scenario: security_agent prompt covers its domain
- **WHEN** `security_agent.md` is read
- **THEN** it contains instructions about vulnerability scanning, severity classification, and findings format — nothing about tests or documentation

#### Scenario: Orchestrator prompt has no tool inventory
- **WHEN** a user asks "how do you work" and the agent is in analyze mode
- **THEN** the response describes delegation behavior, not a list of tools with descriptions

### Requirement: Skill injection disabled for analyze mode
The `build_active_skills_block` call SHALL be skipped when `mode == "analyze"`. The condition `if mode != "chat"` SHALL be changed to `if mode not in ("chat", "analyze")`.

#### Scenario: No skill text injected for analyze requests
- **WHEN** a user sends an analyze request containing trigger words like "security" or "tests"
- **THEN** no skill block is prepended to the system messages — the sub-agents handle domain behavior

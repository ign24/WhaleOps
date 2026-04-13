## ADDED Requirements

### Requirement: sub-agents assess context before selecting tools
Each domain sub-agent (security_agent, qa_agent, review_agent, docs_agent) SHALL include a `<context_assessment>` section that instructs it to infer repository language, stack, and request focus from available signals before choosing which tools to invoke. The agent SHALL NOT follow a fixed execution order.

#### Scenario: Python-only repo security scan
- **WHEN** security_agent receives a request referencing a Python repo
- **THEN** it invokes run_bandit (Python SAST) rather than run_semgrep (JS/TS SAST)
- **THEN** it does NOT invoke run_semgrep unless the repo also contains JS/TS files

#### Scenario: JS/TS-only repo security scan
- **WHEN** security_agent receives a request referencing a JS/TS repo
- **THEN** it invokes run_semgrep and skips run_bandit
- **THEN** it still invokes run_gitleaks since that tool is language-agnostic

#### Scenario: Unknown language — security fallback
- **WHEN** security_agent cannot infer language from the task message
- **THEN** it starts with run_gitleaks as an orientation step
- **THEN** it uses findings or absence of findings to decide whether a language scanner is warranted

#### Scenario: Focused coverage request to qa_agent
- **WHEN** qa_agent receives a request specifically about test coverage gaps (not about running tests)
- **THEN** it invokes analyze_test_coverage directly without running the full test suite first

#### Scenario: PR diff review to review_agent
- **WHEN** review_agent receives a request referencing a branch or PR ref
- **THEN** it invokes get_diff as its first tool to establish change scope
- **THEN** it scopes linting and complexity analysis to touched files

#### Scenario: README-only request to docs_agent
- **WHEN** docs_agent receives a request about README completeness only
- **THEN** it invokes check_readme and does not invoke analyze_api_docs or analyze_docstrings unless the findings indicate a broader gap

### Requirement: sub-agent available tools are listed without implied order
Each sub-agent prompt SHALL contain an `<available_tools>` section listing its tools as a flat inventory. The prompt SHALL explicitly state that not all tools need to be run on every request.

#### Scenario: Sub-agent skips irrelevant tool
- **WHEN** a sub-agent determines a tool is not relevant to the current repo or request
- **THEN** it skips that tool without reporting an error or gap
- **THEN** it proceeds with the tools that are relevant

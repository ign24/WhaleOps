## ADDED Requirements

### Requirement: analyze orchestrator applies planning policy before cloning
The `analyze.md` system prompt SHALL include a `<planning_policy>` section that gives Devstral decision criteria for clone strategy and sub-agent selection. The agent SHALL assess the task before calling any tool and choose parameters accordingly. The policy SHALL use principles and examples, not exhaustive keyword rules.

#### Scenario: Security scan on large well-known repo
- **WHEN** the agent receives a security analysis request on a large public repo (e.g. Django, Rails)
- **THEN** the agent selects `shallow=True` and `timeout_seconds >= 180` before cloning
- **THEN** the agent invokes only `security_agent`, not all four sub-agents

#### Scenario: Documentation-only request
- **WHEN** the agent receives a request about README quality, docstrings, or API docs
- **THEN** the agent invokes only `docs_agent`
- **THEN** the agent uses `shallow=True` since docs tooling does not need git history

#### Scenario: Full analysis request
- **WHEN** the user explicitly asks for a full analysis or complete review
- **THEN** the agent invokes all four sub-agents in sequence
- **THEN** the agent uses `shallow=True` unless git history is explicitly part of the request

#### Scenario: Clone times out and agent self-corrects
- **WHEN** a clone times out and the response includes a `hint` field
- **THEN** the agent retries with `shallow=True` on the next attempt

### Requirement: reader_agent applies evidence-based stopping criteria
The `reader_agent` system prompt SHALL include explicit criteria for when to stop reading files, tied to task type and evidence state. The agent SHALL NOT read files beyond what is needed to answer the question.

#### Scenario: Security-focused file reading
- **WHEN** reader_agent is asked to explore a repo for security context
- **THEN** it prioritizes: entry points, auth modules, config files, dependency manifests
- **THEN** it stops reading once those files are covered, without reading test fixtures or vendored code

#### Scenario: Architecture overview file reading
- **WHEN** reader_agent is asked for an architecture overview
- **THEN** it reads: main module, routes/controllers, models, top-level config
- **THEN** it stops after covering the primary structural files

#### Scenario: Evidence sufficiency check
- **WHEN** reader_agent has read enough files to answer the delegated question
- **THEN** it stops reading and returns its findings, even if more files exist
- **THEN** it does NOT read generated files, test fixtures, or vendored directories regardless of task type

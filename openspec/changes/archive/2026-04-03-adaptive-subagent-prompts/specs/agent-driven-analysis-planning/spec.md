## MODIFIED Requirements

### Requirement: analyze orchestrator applies planning policy before cloning
The `analyze.md` system prompt SHALL include a `<planning_policy>` section that gives Devstral decision criteria for clone strategy and sub-agent selection. The agent SHALL assess the task before calling any tool and choose parameters accordingly. The policy SHALL use principles and examples, not exhaustive keyword rules.

The orchestrator SHALL also include an `<adaptive_delegation>` section that instructs it to pass sufficient context to sub-agents (repo path, language if known, specific concern) but SHALL NOT prescribe which tools the sub-agent should use. Tool selection is the sub-agent's responsibility.

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

#### Scenario: Orchestrator delegates with context, not tool prescription
- **WHEN** the orchestrator delegates to a sub-agent
- **THEN** the delegation message includes repo path, language if known, and the specific concern
- **THEN** the delegation message does NOT specify which tools the sub-agent should run
- **THEN** the orchestrator accepts absence of findings as a valid result, not a failure

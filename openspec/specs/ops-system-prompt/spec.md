## ADDED Requirements

### Requirement: Operator base identity
The system SHALL provide a `base.md` prompt that establishes the agent as an infrastructure operations assistant for Cognitive LATAM LLC, identifying its primary function as monitoring and querying the D03 server, its read-only constraint in this version, and its escalation policy (report findings; do not attempt destructive actions).

#### Scenario: Base prompt defines operator identity
- **WHEN** the agent boots and loads `base.md`
- **THEN** the system prompt contains the operator identity, the D03 target reference, and the Tier 0 read-only constraint statement

### Requirement: Ops mode prompt
The system SHALL provide an `ops.md` prompt for the primary ops mode that instructs the agent to: (1) use `vps_status`, `get_logs`, and `list_services` tools to answer infrastructure queries; (2) present results in structured plain-text tables or bullet lists; (3) escalate anomalies with a severity label (INFO / WARN / CRIT); (4) not attempt write operations.

#### Scenario: Ops prompt guides tool selection
- **WHEN** a user asks about the status of a service on D03
- **THEN** the agent selects `vps_status` or `list_services` and formats the response with a severity label

#### Scenario: Ops prompt enforces read-only constraint
- **WHEN** a user asks the agent to restart a service
- **THEN** the agent declines, explains the Tier 0 read-only constraint, and suggests the user perform the action manually

### Requirement: Chat mode prompt updated for ops identity
The system SHALL update `chat.md` to replace code-agent identity references with ops-agent identity while retaining the lightweight fast-path intent (greetings, capability questions, affirmations).

#### Scenario: Chat mode reflects ops identity
- **WHEN** a user asks "what can you do?"
- **THEN** the agent describes its infra monitoring capabilities, not code analysis capabilities

### Requirement: Code-agent prompts removed from active path
The system SHALL remove `analyze.md` and `execute.md` from the active prompt path by ensuring no mode in `config.yml` references them.

#### Scenario: No mode loads analyze.md or execute.md
- **WHEN** the agent starts with the updated `config.yml`
- **THEN** neither `analyze.md` nor `execute.md` is loaded by any active mode

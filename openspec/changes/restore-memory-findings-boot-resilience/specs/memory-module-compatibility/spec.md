## ADDED Requirements

### Requirement: Findings memory dependencies MUST resolve with startup-safe compatibility
The system SHALL resolve findings memory providers through a startup-safe compatibility layer that does not raise fatal import errors when optional memory modules are absent.

#### Scenario: Memory module is present
- **WHEN** startup resolves findings memory dependencies and `cognitive_code_agent.memory` is available
- **THEN** the compatibility layer binds the concrete provider implementation
- **AND** findings tools operate in normal mode

#### Scenario: Memory module is missing
- **WHEN** startup resolves findings memory dependencies and `cognitive_code_agent.memory` is not importable
- **THEN** the compatibility layer returns a deterministic degraded provider
- **AND** service boot continues without crashing

### Requirement: Compatibility layer MUST expose machine-readable availability cause
The compatibility layer SHALL expose a stable availability cause so callers can distinguish `module_missing` from backend/runtime failures.

#### Scenario: Missing module cause is propagated
- **WHEN** a memory import fails during provider resolution
- **THEN** the returned availability state includes `cause=module_missing`
- **AND** consuming tools can map it to a degraded response without throwing

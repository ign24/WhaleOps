## ADDED Requirements

### Requirement: Reference-Validated UI Cleanup
The system SHALL remove workspace-related frontend artifacts only after reference validation confirms they are not used by runtime-critical routes, active feature paths, or mandatory test coverage.

#### Scenario: Remove confirmed dead workspace artifact
- **WHEN** a component, hook, utility, or route reference is absent from runtime imports, route bindings, and active tests
- **THEN** the artifact is eligible for deletion in this change

#### Scenario: Keep critical-flow behavior unchanged
- **WHEN** cleanup changes are applied
- **THEN** login, chat streaming, sessions, ops, and admin flows SHALL remain behaviorally equivalent

### Requirement: Defer-on-Uncertainty Policy
The system MUST classify uncertain deletion candidates as deferred instead of deleting them.

#### Scenario: Unknown external or indirect usage
- **WHEN** usage cannot be confidently ruled out (for example via dynamic imports, script coupling, or undocumented integrations)
- **THEN** the artifact is marked as `defer` with rationale and follow-up note

### Requirement: Workspace Endpoint Orphan Removal
The system SHALL remove orphan UI references to deprecated `/api/workspace/*` endpoints, including tests and stubs, when no supported runtime dependency exists.

#### Scenario: Remove orphan `/api/workspace/*` UI call
- **WHEN** a UI request path under `/api/workspace/*` has no active runtime owner
- **THEN** corresponding call sites, stubs, and orphan tests are removed together

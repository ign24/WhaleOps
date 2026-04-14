## MODIFIED Requirements

### Requirement: Memory backend readiness is evaluated before memory-dependent operations
The system SHALL evaluate readiness for episodic, findings, and semantic sources before retrieval/persistence paths run. Readiness evaluation SHALL include provider-module availability in addition to backend connectivity.

#### Scenario: Semantic backend unavailable
- **WHEN** readiness evaluation runs and semantic backend/collection is unavailable
- **THEN** semantic operations are marked unavailable
- **AND** semantic retrieval/extraction paths are skipped deterministically
- **AND** a structured warning is emitted

#### Scenario: Findings provider module missing at startup
- **WHEN** readiness evaluation runs and findings provider module cannot be imported
- **THEN** findings readiness is marked unavailable with `cause=module_missing`
- **AND** memory-dependent findings operations are deterministically degraded
- **AND** service startup continues without fatal error

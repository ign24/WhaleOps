## MODIFIED Requirements

### Requirement: Memory backend readiness is evaluated before memory-dependent operations
The system SHALL evaluate readiness for episodic, findings, and semantic sources before retrieval/persistence paths run.

#### Scenario: Semantic backend unavailable
- **WHEN** readiness evaluation runs and semantic backend/collection is unavailable
- **THEN** semantic operations are marked unavailable
- **AND** semantic retrieval/extraction paths are skipped deterministically
- **AND** a structured warning is emitted

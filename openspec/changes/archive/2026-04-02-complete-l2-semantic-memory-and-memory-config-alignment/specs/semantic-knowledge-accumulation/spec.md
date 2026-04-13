## MODIFIED Requirements

### Requirement: Extract generalizable knowledge from findings
The system SHALL extract domain-general knowledge from findings after a `persist_findings` call succeeds with 3 or more findings, and persist it in `domain_knowledge` using a non-blocking async flow.

#### Scenario: Async extraction does not block tool response
- **WHEN** `persist_findings` succeeds with 3 or more findings
- **THEN** the semantic extraction pipeline starts asynchronously
- **AND** `persist_findings` returns immediately with its normal response contract

#### Scenario: Semantic memory disabled
- **WHEN** semantic memory is disabled in memory config
- **THEN** no extraction pipeline is triggered regardless of finding count

### Requirement: Domain knowledge is searchable by vector similarity
Domain knowledge retrieval SHALL be available to auto-retrieval when semantic memory is enabled and backend readiness is true.

#### Scenario: Semantic source enabled and ready
- **WHEN** semantic retrieval is enabled and readiness passes
- **THEN** top N semantic knowledge items are returned for memory context composition

#### Scenario: Semantic source unready
- **WHEN** semantic retrieval is enabled but backend readiness fails
- **THEN** semantic retrieval is skipped for that request
- **AND** a degraded-memory diagnostic is logged

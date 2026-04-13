## ADDED Requirements

### Requirement: Extract generalizable knowledge from findings
The system SHALL extract domain-general knowledge from findings after a `persist_findings` call succeeds with 3 or more findings, and persist it in a dedicated Milvus collection `domain_knowledge`.

#### Scenario: Knowledge extraction after multi-finding persist
- **WHEN** `persist_findings` successfully upserts 3 or more findings in a single call
- **THEN** the system passes the findings to the LLM with an extraction prompt
- **AND** the LLM produces 1-3 generalizable knowledge statements
- **AND** each statement is embedded and upserted into the `domain_knowledge` Milvus collection

#### Scenario: Single or dual finding does not trigger extraction
- **WHEN** `persist_findings` upserts fewer than 3 findings
- **THEN** no knowledge extraction occurs

#### Scenario: Extraction failure does not block persist
- **WHEN** the knowledge extraction LLM call or Milvus upsert fails
- **THEN** the original `persist_findings` response is returned unchanged
- **AND** a warning is logged with the extraction error

### Requirement: Knowledge items have confidence scores
Each knowledge item SHALL have a `confidence` field (FLOAT, 0.0-1.0) that increases when multiple independent findings corroborate the same knowledge.

#### Scenario: New knowledge starts with base confidence
- **WHEN** a new knowledge item is created from a single analysis session
- **THEN** its confidence is set to 0.3

#### Scenario: Corroborated knowledge increases confidence
- **WHEN** a newly extracted knowledge statement has cosine similarity >= 0.85 with an existing knowledge item
- **THEN** the existing item's confidence is increased by 0.2 (capped at 1.0)
- **AND** the new finding IDs are appended to `source_finding_ids`
- **AND** `updated_at` is refreshed

### Requirement: Domain knowledge is searchable by vector similarity
The system SHALL support querying `domain_knowledge` by semantic similarity with optional domain filter.

#### Scenario: Query returns relevant domain knowledge
- **WHEN** the auto-retrieval system queries domain knowledge with a text query
- **THEN** the system returns the top N items ordered by similarity (N controlled by `memory.semantic.max_knowledge_retrieved`)
- **AND** only items with confidence >= 0.3 are returned

### Requirement: Knowledge collection uses explicit Milvus schema
The `domain_knowledge` collection SHALL use an explicit schema with fields: `id` (VARCHAR PK), `knowledge_text` (VARCHAR), `source_finding_ids` (VARCHAR), `domain` (VARCHAR), `confidence` (FLOAT), `created_at` (INT64), `updated_at` (INT64), `embedding` (FLOAT_VECTOR dim=2048).

#### Scenario: Collection is created on first use
- **WHEN** the first knowledge extraction runs and the collection does not exist
- **THEN** the system creates it with the explicit schema and AUTOINDEX on the embedding field

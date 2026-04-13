## MODIFIED Requirements

### Requirement: persist_findings triggers semantic knowledge extraction
The existing `persist_findings` tool SHALL trigger semantic extraction only when semantic memory is enabled by configuration and the extraction preconditions are met.

#### Scenario: Semantic enabled and threshold met
- **WHEN** `persist_findings` upserts 3 or more findings and semantic memory is enabled
- **THEN** the system launches semantic extraction asynchronously

#### Scenario: Semantic disabled by configuration
- **WHEN** semantic memory is disabled
- **THEN** `persist_findings` does not launch semantic extraction
- **AND** tool behavior remains unchanged

## MODIFIED Requirements

### Requirement: persist_findings triggers semantic knowledge extraction
The existing `persist_findings` tool SHALL invoke the semantic knowledge extraction pipeline after a successful upsert of 3 or more findings. The extraction runs asynchronously and does not affect the tool's response to the agent.

#### Scenario: Successful persist with 3+ findings triggers extraction
- **WHEN** `persist_findings` successfully upserts 3 or more findings
- **THEN** the system launches knowledge extraction as a fire-and-forget async task
- **AND** the tool returns its normal `status: ok` response immediately without waiting for extraction

#### Scenario: Successful persist with fewer than 3 findings skips extraction
- **WHEN** `persist_findings` successfully upserts 1 or 2 findings
- **THEN** no knowledge extraction is triggered
- **AND** the tool response is unchanged from current behavior

#### Scenario: Extraction is skipped when semantic memory is disabled
- **WHEN** `memory.semantic.enabled` is `false` in config
- **THEN** `persist_findings` does not trigger knowledge extraction regardless of finding count

## ADDED Requirements

### Requirement: Findings tools MUST register with deterministic degraded behavior
`persist_findings` and `query_findings` SHALL be registered at startup even when memory providers are unavailable, and SHALL return a machine-readable degraded response instead of causing startup failure.

#### Scenario: Startup without memory provider
- **WHEN** tool registration runs and findings memory provider is unavailable
- **THEN** both `persist_findings` and `query_findings` are registered successfully
- **AND** each tool returns `status=degraded` with a stable cause field when invoked

#### Scenario: Startup with memory provider
- **WHEN** tool registration runs and findings memory provider is available
- **THEN** both tools are registered with normal operational behavior

## MODIFIED Requirements

### Requirement: persist_findings triggers semantic knowledge extraction
The existing `persist_findings` tool SHALL invoke the semantic knowledge extraction pipeline after a successful upsert of 3 or more findings. The extraction runs asynchronously and does not affect the tool's response to the agent. If findings memory is degraded or unavailable, the tool SHALL skip upsert/extraction and return a deterministic degraded payload.

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

#### Scenario: Persist degrades when findings memory is unavailable
- **WHEN** `persist_findings` is invoked while findings memory provider is unavailable
- **THEN** no upsert or extraction is attempted
- **AND** the tool returns a deterministic degraded payload with availability cause

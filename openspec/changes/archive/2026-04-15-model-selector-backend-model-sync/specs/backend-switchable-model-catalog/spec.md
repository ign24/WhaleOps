## ADDED Requirements

### Requirement: Backend config SHALL declare canonical switchable models
`src/cognitive_code_agent/configs/config.yml` SHALL define LLM entries for `qwen_3_5_122b_a10b`, `qwen_3_5_397b_a17b`, `nemotron_3_super_120b_a12b`, and `mistral_small_4_119b_2603` under `llms`.

#### Scenario: llm entries exist
- **WHEN** config is loaded from `config.yml`
- **THEN** each canonical key exists in `llms`
- **AND** each entry contains `_type: nim` and `model_name`

### Requirement: Runtime modes SHALL expose switchable_models list
Each active workflow mode used by chat requests SHALL include `switchable_models` with canonical keys that UI can request.

#### Scenario: ops mode allows canonical model keys
- **WHEN** backend initializes runtimes for `workflow.modes.ops`
- **THEN** it builds runtimes for all keys listed in `switchable_models`
- **AND** a request with one of those keys does not fallback for missing runtime key

#### Scenario: chat mode allows canonical model keys
- **WHEN** backend initializes runtimes for `workflow.modes.chat`
- **THEN** it builds runtimes for all keys listed in `switchable_models`

### Requirement: Legacy model aliases SHALL resolve to canonical keys in UI
UI model resolution SHALL keep backwards compatibility for historical/session payloads by mapping legacy provider/internal names to new canonical keys.

#### Scenario: legacy alias resolves to canonical key
- **WHEN** `resolveModelKey()` receives a legacy provider name from old session metadata
- **THEN** it returns one of the canonical 4 model keys

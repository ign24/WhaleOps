## ADDED Requirements

### Requirement: Frontend registry SHALL include runtime-switchable models

`ui-cognitive/lib/model-registry.ts` SHALL contain model entries for runtime-switchable models used by the backend workflow modes.

#### Scenario: switchable model parity
- **WHEN** frontend `MODEL_REGISTRY` is loaded
- **THEN** it includes `devstral`, `qwen_coder`, `deepseek_v3`, `glm_4_7`, `step_3_5_flash`, `kimi_reader`, `kimi_thinking`, `nemotron_super`, `gemma_4_31b_it`

### Requirement: Vision-capable model SHALL be available in frontend registry

Frontend SHALL expose at least one vision-capable model entry to support multimodal image flows.

#### Scenario: default vision model exists
- **WHEN** `getDefaultVisionModel()` is called
- **THEN** it returns a model entry with `supportsVision=true`
- **AND** canonical key `gemma_4_31b_it`

### Requirement: Documentation SHALL reflect effective model catalog

Operational docs SHALL describe backend full model catalog and frontend visible subset clearly.

#### Scenario: docs parity
- **WHEN** operators read `README.md` and `ui-cognitive/README.md`
- **THEN** model catalog entries are consistent with configured runtime models and UI exposure rules

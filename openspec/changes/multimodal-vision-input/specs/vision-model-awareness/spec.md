## ADDED Requirements

### Requirement: Frontend model registry vision flag
Each entry in `MODEL_REGISTRY` SHALL include a `supportsVision: boolean` field indicating whether the model accepts image input.

#### Scenario: Vision model entry
- **WHEN** a model entry has `supportsVision: true`
- **THEN** the UI SHALL allow image attachments without showing a model-switch suggestion

#### Scenario: Non-vision model entry
- **WHEN** a model entry has `supportsVision: false`
- **THEN** the UI SHALL show a model-switch suggestion when an image is attached

### Requirement: Backend config vision flag
Each LLM entry in `config.yml` MAY include a `vision: true` field. When absent, vision defaults to `false`.

#### Scenario: Config entry with vision true
- **WHEN** a model config has `vision: true`
- **THEN** the backend SHALL allow content arrays with `image_url` blocks to pass through to the NIM API

#### Scenario: Config entry without vision field
- **WHEN** a model config has no `vision` field
- **THEN** the backend SHALL treat it as `vision: false` and strip any `image_url` blocks

### Requirement: Inline model-switch suggestion
When the user attaches an image and the selected model lacks vision support, the chat input area SHALL display an inline suggestion to switch to a vision-capable model.

#### Scenario: Image attached with non-vision model
- **WHEN** user attaches an image and the current model has `supportsVision: false`
- **THEN** an inline banner SHALL appear below the file preview strip with text "[ModelName] no soporta imagenes. Cambiar a [VisionModelName]?" and a clickable action

#### Scenario: User clicks switch action
- **WHEN** user clicks the switch action in the inline banner
- **THEN** the model selector SHALL switch to the first available model with `supportsVision: true`
- **AND** the banner SHALL disappear

#### Scenario: Image removed while banner is visible
- **WHEN** user removes the attached image while the model-switch banner is visible
- **THEN** the banner SHALL disappear immediately

#### Scenario: User switches to vision model manually
- **WHEN** user manually selects a vision-capable model while the banner is visible
- **THEN** the banner SHALL disappear immediately

### Requirement: Default vision model resolution
The system SHALL expose a helper to find the first vision-capable model in the registry, used as the suggestion target.

#### Scenario: At least one vision model exists
- **WHEN** `MODEL_REGISTRY` contains entries with `supportsVision: true`
- **THEN** `getDefaultVisionModel()` SHALL return the first such entry

#### Scenario: No vision models exist
- **WHEN** no entries in `MODEL_REGISTRY` have `supportsVision: true`
- **THEN** `getDefaultVisionModel()` SHALL return `undefined`
- **AND** the inline model-switch banner SHALL NOT appear (no target to suggest)

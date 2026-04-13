## ADDED Requirements

### Requirement: Content array construction for image attachments
When a user message includes an image attachment and the resolved model supports vision, the system SHALL construct the message content as an array of content blocks instead of a plain string.

#### Scenario: User sends text with image on vision model
- **WHEN** user submits a message with text "describe this" and an attached image (base64 data URI) and the selected model has `supportsVision: true`
- **THEN** the outbound message content SHALL be `[{type: "text", text: "describe this"}, {type: "image_url", image_url: {url: "data:image/png;base64,..."}}]`

#### Scenario: User sends image only (no text) on vision model
- **WHEN** user submits a message with no text and an attached image and the selected model has `supportsVision: true`
- **THEN** the outbound message content SHALL be `[{type: "image_url", image_url: {url: "data:image/png;base64,..."}}]`

#### Scenario: User sends text with image on non-vision model
- **WHEN** user submits a message with text and an attached image and the selected model has `supportsVision: false`
- **THEN** the outbound message content SHALL be the text string only
- **AND** the system SHALL append a notice: "(Imagen omitida — modelo actual no soporta vision)"

#### Scenario: User sends text without image
- **WHEN** user submits a message with text and no image attachment
- **THEN** the outbound message content SHALL remain a plain string regardless of model vision capability

### Requirement: Backend text extraction from content arrays
The backend SHALL extract text from content arrays for all operations that require the user message as a string (mode resolution, intent classification, memory retrieval).

#### Scenario: Content array reaches backend
- **WHEN** a message with `content` as `list[ContentBlock]` reaches the agent
- **THEN** the system SHALL extract and concatenate all `text`-type blocks to produce the string used for mode resolution, intent classification, and memory retrieval

#### Scenario: Plain string content reaches backend
- **WHEN** a message with `content` as `str` reaches the agent
- **THEN** the system SHALL use the string directly (no change from current behavior)

### Requirement: Backend safety net for non-vision models
The backend SHALL strip `image_url` blocks from content arrays when the resolved model does not support vision.

#### Scenario: Image content array sent to non-vision model
- **WHEN** a message with content array containing `image_url` blocks is routed to a model with `vision: false` in config
- **THEN** the system SHALL remove all `image_url` blocks, keeping only `text` blocks
- **AND** the system SHALL log a warning with the model name and number of stripped images

### Requirement: GatewayChatMessage type widening
The `GatewayChatMessage` type SHALL accept `content` as either `string` or `ContentBlock[]`.

#### Scenario: TypeScript compilation with string content
- **WHEN** code constructs a `GatewayChatMessage` with `content: "hello"`
- **THEN** compilation SHALL succeed

#### Scenario: TypeScript compilation with content array
- **WHEN** code constructs a `GatewayChatMessage` with `content: [{type: "text", text: "hello"}, {type: "image_url", image_url: {url: "data:..."}}]`
- **THEN** compilation SHALL succeed

## Why

The frontend already accepts image attachments (drag/drop, paste, file picker) but embeds them as markdown `![name](data:image/png;base64,...)` inside `content: string`. The model receives a wall of base64 text instead of actual visual input. Meanwhile, `google/gemma-4-31b-it` — already configured in `config.yml` — supports native multimodal vision via the standard OpenAI `image_url` content block format. The image attachment UX exists but produces zero vision value.

## What Changes

- Parse image data URIs from user messages and convert to OpenAI-compatible content arrays (`text` + `image_url` blocks) instead of embedding as markdown.
- Add `supportsVision` flag to the frontend model registry and backend model config so the system knows which models can receive image input.
- When a user attaches an image and the selected model lacks vision support, show an inline suggestion to switch to a vision-capable model (non-blocking — user keeps control).
- Backend gateway accepts `content` as `string | ContentBlock[]` and forwards the structured format to NIM API unchanged.
- Backend validates: if content array contains `image_url` blocks but the resolved model lacks vision, strip images and log a warning (safety net, not primary path).

## Capabilities

### New Capabilities
- `vision-content-transform`: Parsing image data URIs from message content and converting to OpenAI-compatible multimodal content arrays for vision-capable models.
- `vision-model-awareness`: Model registry flag (`supportsVision`) on both frontend and backend, with UI affordances (inline switch suggestion) when attachment type and model capability mismatch.

### Modified Capabilities
- `split-chat-layout`: Chat input submission must produce structured content arrays instead of markdown-embedded images when vision model is active.
- `message-markdown`: Rendering of user messages with image attachments should display the image visually (already works via data URI), but outbound serialization changes.

## Impact

- **Frontend** (`ui-cognitive`): `model-registry.ts`, `chat-panel.tsx` (submission logic + model mismatch warning), `types/chat.ts` (GatewayChatMessage content type).
- **Backend**: Gateway route that receives chat messages, NIM client that forwards to API. Message type must accept `content: string | list[ContentBlock]`.
- **Config**: `config.yml` LLM entries gain an optional `vision: true` field. Frontend registry entries gain `supportsVision: boolean`.
- **No breaking changes**: Non-vision models continue receiving `content: string` as before. The content array path only activates when images are present and model supports vision.

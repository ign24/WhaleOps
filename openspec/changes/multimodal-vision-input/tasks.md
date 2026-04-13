## 1. Type Foundation

- [x] 1.1 Add `ContentBlock` types (`TextBlock`, `ImageUrlBlock`) to `ui-cognitive/types/chat.ts` and widen `GatewayChatMessage.content` to `string | ContentBlock[]`
- [x] 1.2 Add `supportsVision: boolean` field to `ModelEntry` in `ui-cognitive/lib/model-registry.ts` (default `false`, set `true` for `gemma_4_31b_it`)
- [x] 1.3 Add `getDefaultVisionModel()` helper to `model-registry.ts` that returns the first `supportsVision: true` entry
- [x] 1.4 Add `vision: true` to `gemma_4_31b_it` in `src/cognitive_code_agent/configs/config.yml`

## 2. Frontend Content Transform

- [ ] 2.1 Refactor `onSubmit` in `chat-panel.tsx`: when image attached + vision model, build content array `[{type: "text", ...}, {type: "image_url", ...}]` instead of markdown embedding
- [ ] 2.2 When image attached + non-vision model, strip image from outbound content and append notice text "(Imagen omitida — modelo actual no soporta vision)"
- [ ] 2.3 Update `truncateMessages` and `estimateTokensFromMessages` to handle `content: ContentBlock[]` (extract text blocks for estimation)

## 3. Vision Model Suggestion UI

- [ ] 3.1 Create `VisionModelBanner` inline component that shows "[ModelName] no soporta imagenes. Cambiar a [VisionModel]?" with a clickable switch action
- [ ] 3.2 Integrate banner in `chat-panel.tsx` input area: show when `attachedFile?.type === "image"` and `!currentModel.supportsVision`, hide on image removal or model change
- [ ] 3.3 Wire switch action to `useInferencePrefs` to update model selection

## 4. Backend Content Array Handling

- [ ] 4.1 Update `last_user_message` extraction in `safe_tool_calling_agent.py` `_response_fn` to handle `content` as `list[dict]` by joining text blocks
- [ ] 4.2 Add vision safety net: before constructing `HumanMessage`, if resolved model config has `vision: false` and content is array with `image_url` blocks, strip them and log warning
- [ ] 4.3 Verify NAT `ChatRequest` accepts content arrays — if Pydantic rejects, add adapter to serialize content before passing to NIM

## 5. Message Display

- [ ] 5.1 Update user message rendering in `chat-panel.tsx` to handle `content: ContentBlock[]` — render `image_url` blocks as `<img>` and `text` blocks as markdown
- [ ] 5.2 Update `parseHistory` in session loading to normalize both `string` and `ContentBlock[]` content formats

## 6. API Route Passthrough

- [ ] 6.1 Update `/api/chat/route.ts` to pass `content: string | ContentBlock[]` through to `nat-client.ts` without stringifying arrays
- [ ] 6.2 Update `normalizeIntentText` in route to extract text from content arrays for small-talk fast-path detection
- [ ] 6.3 Update `appendSessionMessages` to persist content arrays as-is

## 7. Tests

- [ ] 7.1 Unit test: `validateAttachment` + `ContentBlock` type construction for image files
- [x] 7.2 Unit test: `getDefaultVisionModel()` returns correct entry, returns `undefined` when no vision models
- [ ] 7.3 Unit test: backend text extraction from content arrays (string passthrough, array join, mixed blocks)
- [ ] 7.4 Unit test: backend vision safety net strips `image_url` blocks for non-vision models
- [ ] 7.5 Unit test: `VisionModelBanner` renders with correct model names, hides on removal
- [ ] 7.6 Integration test: full round-trip — image attachment → content array → API route → nat-client payload contains `image_url` block

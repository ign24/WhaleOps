## Context

The frontend (`ui-cognitive`) accepts image attachments via drag/drop, paste, and file picker. It reads images as base64 data URIs (`readAsDataURL`) and embeds them as markdown `![name](data:image/png;base64,...)` inside the message `content: string`. The backend (NAT framework) receives this as a plain string — the model never "sees" the image.

The NIM API supports multimodal input via the OpenAI-compatible content array format: `content: [{type: "text", text: "..."}, {type: "image_url", image_url: {url: "data:..."}}]`. At least one configured model (`google/gemma-4-31b-it`) supports this natively. The data flow touches four layers:

```
chat-panel.tsx → /api/chat/route.ts → nat-client.ts → NAT /chat/stream → NIM API
     (1)              (2)                  (3)              (4)           (5)
```

### Current message type

```typescript
// types/chat.ts
type GatewayChatMessage = { role: ChatRole; content: string };
```

```python
# NAT ChatRequest — messages[].content is str
last_user_message = str(item.get("content", ""))
```

## Goals / Non-Goals

**Goals:**
- Image attachments reach vision-capable models as proper `image_url` content blocks, not base64 text.
- Model registry (frontend + backend config) knows which models support vision.
- User gets a non-blocking suggestion to switch to a vision model when attaching an image with a non-vision model selected.
- Non-vision models continue receiving `content: string` — zero regression.

**Non-Goals:**
- Video input (frame extraction, transcription) — future change.
- Adding new vision models to `config.yml` — this change enables the plumbing; model additions are config-only.
- Multi-image support in a single message (one image per message is sufficient for v1).
- Image generation or editing — this is input only.

## Decisions

### D1: Content transformation happens in the frontend, not the backend

The frontend already holds the base64 data URI and knows the attachment type. It will construct the content array directly in `onSubmit` instead of embedding markdown.

**Alternative considered**: Parse data URIs server-side from markdown. Rejected because it requires fragile regex parsing and the frontend already has the structured data.

**Implication**: `GatewayChatMessage.content` becomes `string | ContentBlock[]`. All layers must accept both.

### D2: Type widening with a discriminated union

```typescript
type TextBlock = { type: "text"; text: string };
type ImageUrlBlock = { type: "image_url"; image_url: { url: string } };
type ContentBlock = TextBlock | ImageUrlBlock;

type GatewayChatMessage = {
  role: ChatRole;
  content: string | ContentBlock[];
};
```

When no image is attached, `content` stays `string` — nothing changes for the common case.

### D3: Model mismatch UX — inline suggestion, not a blocker

When the user attaches an image and the current model lacks `supportsVision`:
1. An inline banner appears below the attachment strip: _"[ModelName] no soporta imagenes. Cambiar a Gemma 4?"_ with a **[Cambiar]** button.
2. Clicking switches to the default vision model.
3. If the user ignores it and sends, the image is **stripped** and a warning appended: _"(Imagen omitida — modelo actual no soporta vision)"_.

**Alternative considered**: Auto-switch silently. Rejected because changing the model without consent breaks the user's intent.
**Alternative considered**: Block send entirely. Rejected because it's overly restrictive — the text portion of the message is still valid.

### D4: `supportsVision` flag on both frontend registry and backend config

```typescript
// model-registry.ts
{ key: "gemma_4_31b_it", ..., supportsVision: true }
```

```yaml
# config.yml
gemma_4_31b_it:
  vision: true
```

The frontend flag drives UI affordances (suggestion banner). The backend flag drives defensive stripping (safety net if frontend is bypassed).

### D5: Backend safety net — strip images for non-vision models

In `safe_tool_calling_agent.py`, before constructing the LangChain `HumanMessage`:
- If the resolved model's config has `vision: false` (default) and `content` is an array containing `image_url` blocks, strip them and keep only `text` blocks.
- Log a warning when stripping.

This ensures no base64 blobs reach text-only models even if the frontend has a bug.

### D6: NAT message handling — content array passthrough

NAT's `ChatRequest` serializes `messages[].content` as-is into the NIM API call. The NIM API already accepts the OpenAI content array format. The key change: `last_user_message` extraction (used for mode resolution, intent classification, memory retrieval) must handle `content` being a list by extracting only the `text` blocks.

```python
# Before
last_user_message = str(item.get("content", ""))

# After
raw_content = item.get("content", "")
if isinstance(raw_content, list):
    last_user_message = " ".join(
        block["text"] for block in raw_content
        if isinstance(block, dict) and block.get("type") == "text"
    )
else:
    last_user_message = str(raw_content)
```

## Risks / Trade-offs

**[Token budget]** A 2 MB image encoded as base64 is ~2.7M characters / ~675K tokens. NIM vision models have their own visual token budgets (e.g., Gemma 4: 70-1120 visual tokens). The NIM API handles image tokenization internally — base64 size does not map linearly to token cost. However, the 2 MB frontend limit is adequate.
→ Mitigation: Keep the existing 2 MB `MAX_IMAGE_BYTES` limit. Monitor token usage on vision calls.

**[NAT ChatRequest schema]** NAT may enforce `content: str` at the Pydantic level. If so, the content array would need to be serialized differently.
→ Mitigation: Test with a minimal vision call first. If NAT rejects array content, add a thin adapter that serializes content arrays to the NIM API directly, bypassing NAT's message schema.

**[Model availability]** Gemma 4 is tier B (chat-optimized). It may underperform on code analysis tasks that also include images.
→ Mitigation: When adding more vision models later (Llama 4 Maverick, Mistral Small 4), users will have tier-appropriate choices. For v1, Gemma 4 covers the use case.

**[Backward compatibility]** Persisted sessions store `content: string`. Messages with image attachments will now have `content: ContentBlock[]` in session storage.
→ Mitigation: Session loading must handle both formats. The `parseHistory` normalizer already processes raw payloads — extend it.

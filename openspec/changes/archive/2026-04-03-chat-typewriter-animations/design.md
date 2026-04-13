## Context

The chat frontend connects to the backend via WebSocket. The backend uses LangGraph `stream_mode="updates"` which emits one event per completed graph node — not per token. In practice, a single-turn response arrives as **one large `system_response_message`** with the full text in `content.text`. The frontend (`Chat.tsx` → `processSystemResponseMessage`) appends this text immediately to the message state, causing `MemoizedReactMarkdown` to render the entire response in a single React pass.

Current animation inventory in `tailwind.config.js`:
- 2 used: `blink` (caret), `loadingBar` (intermediate steps progress bar)  
- 6 unused: `flicker`, `glitch`, `ghost`, `flash`, `crack`/`crack1`, `darken`

The `MemoizedChatMessage` memo compares only `message`, `messageIndex`, and `onEdit` — it does NOT currently include `messageIsStreaming`, meaning the active streaming message doesn't re-render when streaming state changes (stale cursor behavior).

## Goals / Non-Goals

**Goals:**
- Create the visual illusion of the agent "writing" by revealing content word-by-word
- Animate block-level markdown elements (paragraphs, headings, code blocks, tables) on appearance during streaming
- Add blinking cursor ▍ at the end of in-progress content, matching ChatLoader's existing pattern
- Remove 6 dead keyframes to reduce bundle noise
- Zero backend changes, zero new npm dependencies

**Non-Goals:**
- True token-level streaming from the backend (separate concern, carries regression risk)
- Animating historical/already-rendered messages
- Per-character typewriting (markdown-unsafe, causes raw-tag flicker)
- Animating user messages

## Decisions

### D1: Word-queue simulation over character-queue

**Decision:** Drain content word-by-word (split on spaces), not character-by-character.

**Why:** Character-by-character with `ReactMarkdown` causes visible flicker — partial markdown syntax like `**bold` renders as raw text before `**bold**` becomes `<strong>`. Splitting on words means markdown delimiters stay grouped or become visible in one step. Combined with CSS animations on block elements, the result is natural without raw-tag artifacts.

**Alternative considered:** Line-by-line. More markdown-safe but feels choppy on short single-line responses.

---

### D2: Adaptive drain speed

**Decision:** `useTypewriter` adjusts words-per-frame based on queue depth:
- Queue ≤ 30 words → 1 word per 40ms (natural human pace)
- Queue 31–150 words → 3 words per 16ms frame
- Queue > 150 words → 10 words per 16ms frame

**Why:** A 100-word response should feel like writing (~3–4s). A 2000-word analysis should not take 80 seconds. Adaptive speed keeps the UX honest for both cases.

**Alternative considered:** Fixed speed with a max cap. Simpler but either too slow for long responses or too fast for short ones.

---

### D3: CSS class injection on container, not per-element

**Decision:** Apply `.message-streaming` class to the assistant message container div. CSS rules under this selector target child elements (`p`, `pre`, `h1`-`h3`, etc.). No changes to `CustomComponents.tsx`.

**Why:** `CustomComponents.tsx` is memoized and touched only when the component tree first renders. Injecting animation props would require memo-busting. CSS inheritance avoids this entirely — elements animate purely based on their position in the DOM hierarchy.

**Alternative considered:** Passing `isStreaming` prop into `CustomComponents` via context. Works but adds coupling between rendering and streaming state.

---

### D4: `useTypewriter` as a standalone hook, not inline in `ChatMessage`

**Decision:** Extract the queue + rAF logic into `hooks/useTypewriter.ts`. `ChatMessage` calls it with the incoming `content` and `isStreaming` flag and renders `displayedContent` from the hook.

**Why:** Keeps `ChatMessage` focused on rendering. The hook is independently testable. The hook handles the edge case where streaming ends before the queue drains (continues draining at fast speed, then settles).

---

### D5: Extend `MemoizedChatMessage` memo to include `messageIsStreaming`

**Decision:** Add `messageIsStreaming` (from `HomeContext`) as a prop to `MemoizedChatMessage` and include it in the `isEqual` comparator.

**Why:** Without this, when `messageIsStreaming` flips to `false` (stream ends), the last message does not re-render — so the cursor ▍ never disappears and `displayedContent` may not flush. The prop must be present for the memo to correctly diff streaming state changes.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| rAF loop not cancelled on unmount causes memory leak | `useTypewriter` returns cleanup in `useEffect` — cancel rAF ID on unmount |
| Queue drains past response end (extra chars) | Track `queueRef.length === 0 && !isStreaming` → stop loop |
| `MemoizedReactMarkdown` re-renders 60x/sec during fast drain | Re-renders are cheap (markdown→HTML only); verified acceptable with short content; cap at 60fps via rAF |
| Partial markdown at word boundaries (e.g., `**` alone) | Acceptable at word granularity — `**` alone is rare and resolves within 1–2 words |
| Animation re-fires if `message.id` key changes | Keys in `Chat.tsx` are stable (`message.id ?? index`) — no issue |

## Migration Plan

1. Remove dead keyframes from `tailwind.config.js` (safe, nothing uses them)
2. Add new keyframes and CSS rules
3. Add `useTypewriter` hook
4. Wire `isStreaming` prop into `ChatMessage` and `MemoizedChatMessage`
5. No rollback complexity — CSS classes are additive, removing them returns to current behavior

## Open Questions

- Should the adaptive speed thresholds be configurable (e.g., via a user setting)? → Out of scope for this change, can be added later as a settings flag.
- Should streaming animation be disabled on `prefers-reduced-motion`? → Yes — add `@media (prefers-reduced-motion: reduce)` to override `stream-reveal` and `stream-fade` to `opacity: 1; transform: none; animation: none`.

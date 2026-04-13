## 1. Cleanup: Remove dead keyframes

- [x] 1.1 Remove keyframes `flicker`, `glitch`, `ghost`, `flash`, `crack`, `crack1`, `darken` from `tailwind.config.js` keyframes block
- [x] 1.2 Remove corresponding animation entries (`flicker`, `glitch`, `ghost`, `flash`, `crack`, `darken`) from `tailwind.config.js` animation block
- [x] 1.3 Verify no component references any of the removed animation classes (grep for `animate-flicker`, `animate-glitch`, `animate-ghost`, `animate-flash`, `animate-crack`, `animate-darken`)

## 2. New keyframes and CSS rules

- [x] 2.1 Add `streamReveal` keyframe to `tailwind.config.js`: `0% { opacity: 0, translateY(4px) }` → `100% { opacity: 1, translateY(0) }`
- [x] 2.2 Add `streamFade` keyframe to `tailwind.config.js`: `0% { opacity: 0 }` → `100% { opacity: 1 }`
- [x] 2.3 Add `stream-reveal` and `stream-fade` animation entries to `tailwind.config.js` animation block
- [x] 2.4 Add `.message-streaming` CSS rules to `globals.css` for: `p` (280ms), `h1/h2/h3` (220ms), `pre` (400ms), `blockquote` (300ms), `ul/ol` (250ms), `table` (350ms)
- [x] 2.5 Add `@media (prefers-reduced-motion: reduce)` override in `globals.css` that disables `stream-reveal` and `stream-fade` animations

## 3. useTypewriter hook

- [x] 3.1 Create `ui/hooks/useTypewriter.ts` with signature `useTypewriter(content: string, isStreaming: boolean): { displayedContent: string; isDraining: boolean }`
- [x] 3.2 Implement word-split queue using `useRef` (not state) to avoid re-renders on queue changes
- [x] 3.3 Implement `requestAnimationFrame` drain loop with adaptive speed: ≤30 words → 1 word/40ms, 31–150 → 3 words/frame, >150 → 10 words/frame
- [x] 3.4 Implement queue continuation after `isStreaming` flips false: drain remaining words at fast speed then stop
- [x] 3.5 Implement reset logic: when `content` resets to `""`, clear queue and reset `displayedContent` to `""`
- [x] 3.6 Implement cleanup: cancel active rAF ID in `useEffect` return function

## 4. ChatMessage: wire isStreaming prop and cursor

- [x] 4.1 Add `isStreaming?: boolean` prop to `ChatMessage` component interface
- [x] 4.2 Call `useTypewriter(message.content, isStreaming ?? false)` inside `ChatMessage`
- [x] 4.3 Replace `message.content` with `displayedContent` in the response content `MemoizedReactMarkdown` render
- [x] 4.4 Add conditional `message-streaming` class to the assistant message container div when `isStreaming` is true
- [x] 4.5 Render `<span className="text-[#76b900] animate-blink">▍</span>` after the response markdown when `(isStreaming || isDraining)` is true

## 5. MemoizedChatMessage: fix memo comparator

- [x] 5.1 Add `messageIsStreaming?: boolean` prop to `MemoizedChatMessage` props interface
- [x] 5.2 Update memo comparator to include `prevProps.messageIsStreaming === nextProps.messageIsStreaming`
- [x] 5.3 Pass `messageIsStreaming` prop through to `ChatMessage`

## 6. Chat.tsx: pass isStreaming to last message

- [x] 6.1 In the `selectedConversation.messages.map` render loop, compute `isLastMessage = index === selectedConversation.messages.length - 1`
- [x] 6.2 Pass `messageIsStreaming={messageIsStreaming && isLastMessage}` to each `MemoizedChatMessage`

## 7. Verification

- [x] 7.1 Run `bun run lint` — no new lint errors introduced (pre-existing failures unrelated to this change)
- [x] 7.2 Run `bun run build` — builds without errors
- [ ] 7.3 Manual test: send a message, verify word-by-word reveal with cursor ▍ visible during streaming
- [ ] 7.4 Manual test: verify historical messages have no streaming animation on page load
- [ ] 7.5 Manual test: verify cursor disappears after streaming ends
- [ ] 7.6 Manual test: verify code blocks, headings, and tables animate in during streaming

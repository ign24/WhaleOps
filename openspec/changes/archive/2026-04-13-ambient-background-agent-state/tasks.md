## 1. Types and Context

- [x] 1.1 Add `AgentMood` type (`"idle" | "thinking" | "executing" | "agitated"`) to `ui-cognitive/types/chat.ts`
- [x] 1.2 Create `AgentMoodContext` with provider and `useAgentMood()` hook in `ui-cognitive/contexts/agent-mood-context.tsx`
- [x] 1.3 Add `AgentMoodProvider` to the root layout in `ui-cognitive/app/layout.tsx`

## 2. Mood Publishing

- [x] 2.1 Add `setAgentMood` to the context and consume it in `chat-session-layout.tsx` to wire mood updates from chat-panel
- [x] 2.2 Publish mood from `chat-panel.tsx`: call `setAgentMood` when `resolveStreamingMood` result changes during streaming
- [x] 2.3 Reset mood to `"idle"` when streaming ends (completion, error, or abort)

## 3. Canvas Dynamics

- [x] 3.1 Define `MOOD_PARAMS` constant map with per-mood parameter presets (speedMultiplier, connectionDistance, dotOpacity, lineOpacityMultiplier, pulseAmplitude)
- [x] 3.2 Consume `useAgentMood()` in `DotGridBackground` and store mood in a ref for the animation loop
- [x] 3.3 Add lerp interpolation: maintain `currentParams` that interpolate toward `targetParams` each frame (factor ~0.03)
- [x] 3.4 Replace hardcoded velocity, connection distance, and opacity in the draw loop with interpolated values
- [x] 3.5 Implement sinusoidal pulse effect for agitated mood (modulate dot opacity and line width by `sin(time * 4) * pulseAmplitude`)

## 4. Verification

- [x] 4.1 Visual test: confirm idle state shows calm, slow-moving particles
- [x] 4.2 Visual test: trigger a streaming request and verify transitions through thinking -> executing -> idle
- [ ] 4.3 Verify dark mode and light mode both work correctly with all mood states
- [ ] 4.4 Check devtools Performance panel for frame drops during mood transitions
- [x] 4.5 Run `bun run lint && bun run build` to verify no type or build errors

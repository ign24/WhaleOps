## Why

The particle canvas background runs with fixed animation parameters regardless of what the agent is doing. Connecting background dynamics to agent state creates an ambient feedback layer — users perceive system activity without reading status text. This is a low-cost, high-impact UX enhancement: the mood derivation logic already exists (`resolveStreamingMood` in chat-panel.tsx), it just needs to reach the canvas.

## What Changes

- Add an `"idle"` mood for when no streaming is active (currently only thinking/executing/agitated exist during streaming)
- Create a React context to broadcast the current agent mood app-wide
- Parametrize `DotGridBackground` canvas animation by mood: particle speed, connection distance, dot opacity, and optional pulse effect
- Implement smooth interpolation (lerp) between mood parameter sets so transitions feel organic
- No new dependencies — pure Canvas API + requestAnimationFrame

## Capabilities

### New Capabilities

- `agent-mood-context`: React context that exposes the current agent mood (idle | thinking | executing | agitated) to any component in the tree
- `ambient-canvas-dynamics`: Canvas animation parameters driven by agent mood with smooth lerp transitions between states

### Modified Capabilities

_(none — existing streaming line animations and activity dots remain unchanged)_

## Impact

- **ui-cognitive/components/layout/dot-grid-background.tsx** — main target: consumes mood context, parametrizes animation loop
- **ui-cognitive/components/chat/chat-panel.tsx** — mood source: already computes `StreamingMood`, will also publish to context
- **ui-cognitive/components/chat/chat-session-layout.tsx** — wiring: provider placement
- **ui-cognitive/app/layout.tsx** — provider wrapping at root level
- **ui-cognitive/types/chat.ts** — extended mood type with `"idle"`
- No backend changes. No new dependencies. No breaking changes.

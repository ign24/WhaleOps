## Context

`DotGridBackground` renders 90 particles on a fixed canvas with hardcoded velocity (0.6), connection distance (260px), and opacity. The `resolveStreamingMood` function in `chat-panel.tsx` already classifies agent activity into `thinking | executing | agitated` during streaming, but this mood is only used for CSS classes on the streaming line indicator. The canvas and the mood system are completely disconnected.

The background canvas lives in `layout.tsx` (root), while mood is computed deep in the chat panel component tree. A bridging mechanism is needed.

## Goals / Non-Goals

**Goals:**
- Expose agent mood (idle, thinking, executing, agitated) via React context accessible app-wide
- Drive canvas particle dynamics (speed, connection distance, opacity, pulse) from the current mood
- Smooth transitions between mood states using frame-by-frame lerp interpolation
- Maintain 60fps performance with zero perceptible frame drops

**Non-Goals:**
- Changing the particle count, shapes, or color palette
- Adding new visual elements (glow effects, bloom, shaders)
- Modifying the existing streaming line CSS animations
- Supporting user-configurable animation parameters

## Decisions

### 1. React context over prop drilling

**Choice**: `AgentMoodContext` at the layout root level.

**Why**: `DotGridBackground` is mounted in `layout.tsx` and the mood is computed in `chat-panel.tsx` — these are far apart in the tree. A context provider in `chat-session-layout.tsx` (or layout) with a consumer in the canvas is the cleanest path. Prop drilling would require threading through 3+ intermediate components that have no use for the value.

**Alternative considered**: Global event emitter / zustand store. Overkill for a single derived value that already lives in React state.

### 2. Lerp interpolation in the animation loop

**Choice**: Store target parameter set per mood. Each frame, lerp current values toward target at a fixed rate (e.g., `current += (target - current) * 0.03`).

**Why**: Abrupt parameter jumps would be visually jarring — particles suddenly speeding up or slowing down breaks the ambient feel. A lerp factor of 0.03 gives ~1-2 second transitions which feels organic.

**Alternative considered**: CSS transitions on a wrapper element. Not applicable — these are Canvas API draw parameters, not CSS properties.

### 3. Mood parameter presets as a static map

**Choice**: A `MOOD_PARAMS` constant mapping each mood to `{ speedMultiplier, connectionDistance, dotOpacity, lineOpacityMultiplier, pulseAmplitude }`.

**Why**: Easy to tune, easy to read, no runtime computation for determining targets. When mood changes, just look up the new target set.

| Param | idle | thinking | executing | agitated |
|---|---|---|---|---|
| speedMultiplier | 0.3 | 1.0 | 1.5 | 2.5 |
| connectionDistance | 260 | 300 | 220 | 350 |
| dotOpacity | 0.4 | 0.7 | 0.85 | 0.9 |
| lineOpacityMultiplier | 0.5 | 0.8 | 1.0 | 1.2 |
| pulseAmplitude | 0 | 0 | 0 | 0.15 |

### 4. Idle state derivation

**Choice**: The mood context defaults to `"idle"`. During streaming, `resolveStreamingMood` publishes the active mood. When streaming ends, it resets to `"idle"`.

**Why**: Currently `resolveStreamingMood` only runs during streaming. Rather than modifying that function, the context provider simply uses `"idle"` as default and only overrides during active streaming — keeping the existing logic untouched.

### 5. Pulse effect for agitated state

**Choice**: Sinusoidal oscillation on dot opacity and line width during `agitated` mood: `value + sin(time * 4) * pulseAmplitude`.

**Why**: Gives the agitated state a breathing/pulsing quality that visually distinguishes it from executing without adding new particle behaviors. Amplitude of 0.15 is subtle enough to not be distracting.

## Risks / Trade-offs

- **[Perf] O(n^2) connection loop with variable distance** → Distance is already checked per-frame. Widening from 260 to 350 in agitated mode draws ~80% more lines. Mitigation: 90 particles keeps the absolute count manageable (~4000 pairs). Monitor with devtools if needed.
- **[UX] Transitions too slow/fast** → Lerp factor is a single constant, easy to tune post-implementation. Start with 0.03, adjust by feel.
- **[Theme] Opacity multipliers may clash with light mode** → Keep base opacity values theme-aware (as they are now). Mood multipliers scale relative to the base, not absolute.
- **[Context re-renders] Mood changes trigger re-renders** → The canvas reads mood via `useContext` inside a `useEffect`, so re-renders only update a ref — the animation loop reads from the ref, not from render. No wasted renders.

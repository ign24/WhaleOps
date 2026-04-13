## ADDED Requirements

### Requirement: Typewriter bypass during active token streaming

The `useTypewriter` hook SHALL bypass its word-queue animation and append incoming content directly to `displayedContent` when `isStreaming === true` AND the incoming content delta is a short token-sized fragment (≤ 40 characters). The queue path SHALL remain active when `isStreaming === false` (drain phase) or when the delta is a large block (≥ 40 characters, indicating a non-streaming fallback such as ainvoke synthesis).

#### Scenario: Short token delta bypasses the queue

- **WHEN** `isStreaming` is `true` and a new content delta of 8 characters arrives
- **THEN** those 8 characters SHALL appear in `displayedContent` immediately on the next render
- **AND** the word-queue animation SHALL NOT introduce per-word frame delays for this delta

#### Scenario: Large block uses queue

- **WHEN** a single content delta of 800 characters arrives (e.g. from ainvoke fallback)
- **THEN** the characters SHALL be enqueued and drained via the existing word-pacing logic

#### Scenario: Drain completes after streaming ends

- **WHEN** `isStreaming` flips from `true` to `false` with words still queued
- **THEN** the queue SHALL continue draining at the fast-drain rate until empty
- **AND** `isVisualStreaming` SHALL remain `true` until the queue is empty

#### Scenario: Reduced motion still respected

- **WHEN** the user has `prefers-reduced-motion: reduce`
- **THEN** bypass behavior SHALL be identical (no animation applied in either path)

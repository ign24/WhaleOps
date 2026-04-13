## 1. Baseline and scope guardrails

- [x] 1.1 Confirm current activity/event flow in `ui-cognitive/lib/nat-client.ts`, `ui-cognitive/app/api/chat/route.ts`, and `ui-cognitive/components/chat/chat-panel.tsx` to document where duplicate appends occur.
- [x] 1.2 Inventory all user-facing activity-related strings in scoped UI files (`session-meta.ts`, `inline-activity-summary.tsx`, and optional step cards) and mark English copy to translate.

## 2. Safe localization pass (no behavior changes)

- [x] 2.1 Introduce a centralized Spanish copy map/constants for activity labels and summaries used by session meta + inline summary.
- [x] 2.2 Update `ui-cognitive/components/activity/session-meta.ts` and `ui-cognitive/components/chat/inline-activity-summary.tsx` to consume the Spanish copy map.
- [x] 2.3 Apply consistency updates in `agent-step-card.tsx` and `tool-call-card.tsx` only if they expose user-visible activity labels.
- [x] 2.4 Verify manually that all activity notifications/labels in active chat and panel views render in Spanish.

## 3. Streaming dedup implementation

- [x] 3.1 Define normalized activity event identity (`dedupeKey`) in the streaming client pipeline (nat-client + route adapter) using stable fallbacks.
- [x] 3.2 Add append guard in `chat-panel.tsx` live activity state updates so events with seen identities are ignored within one assistant stream.
- [x] 3.3 Reset dedup state deterministically when a new assistant response stream starts.
- [x] 3.4 Ensure historical `intermediateSteps` rendering path remains unchanged and dedup applies only to live stream appends.

## 4. Regression checks and acceptance criteria

- [x] 4.1 Add/adjust tests (or deterministic harness checks) validating duplicate event suppression and non-suppression for truly distinct repeated tool calls.
- [x] 4.2 Validate acceptance criterion A: every scoped user-facing activity label/notification is in Spanish.
- [x] 4.3 Validate acceptance criterion B: duplicated streaming events no longer produce duplicate timeline rows, tool counts, or duration inflation.
- [x] 4.4 Validate acceptance criterion C: switching between historical and live activity views preserves expected counts and does not mutate historical entries.

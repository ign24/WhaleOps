## 1. Types and shared interfaces

- [x] 1.1 Add `SessionMeta` type to `types/chat.ts` with fields: toolCount, totalDuration, activeToolCount, failedCount, model, isLive
- [x] 1.2 Define `ActivityPanelProps`, `ChatSessionLayoutProps`, and updated `ChatPanelProps` interfaces in their respective component files

## 2. Layout structure (ChatSessionLayout)

- [x] 2.1 Create `components/chat/chat-session-layout.tsx` with CSS grid split: `grid-cols-[1fr_380px]` on desktop, single column below 1024px. Own `activityLog`, `activeTool`, `isActivityOpen` state. Persist panel open/closed to localStorage
- [x] 2.2 Update `app/(app)/chat/[sessionKey]/page.tsx` to render `ChatSessionLayout` wrapping `ChatPanel`
- [x] 2.3 Refactor `ChatPanel` to accept lifted state as props: `activityLog`, `onActivityEvent`, `activeTool`, `onActiveToolChange`, `onToggleActivity`. Remove internal `activityLog` and `activeTool` state declarations. SSE parsing calls the prop callbacks instead of local setters

## 3. Activity panel shell

- [x] 3.1 Create `components/activity/activity-panel.tsx` — container with header (SessionInfo), scrollable timeline area, and footer (SessionSummary). Accepts `ActivityPanelProps` (entries, activeTool, isLive, onClose)
- [x] 3.2 Create `components/activity/session-info.tsx` — displays model name (first entry with model field), tool count, and total duration from entries
- [x] 3.3 Create `components/activity/session-summary.tsx` — displays total entry count, completed/failed/running counts, and aggregate duration

## 4. Activity timeline

- [x] 4.1 Create `components/activity/activity-timeline.tsx` — vertical scrollable list of `TimelineEntry` components. Auto-scrolls to bottom during live mode. Shows placeholder when empty
- [x] 4.2 Create `components/activity/timeline-entry.tsx` — status icon (colored dot by status), humanized label, formatted timestamp (HH:MM:SS), duration. Collapsed by default, click to expand
- [x] 4.3 Create `components/activity/tool-call-card.tsx` — expanded view for tool entries: `toolArgs` as syntax-highlighted JSON, `toolResult` as rendered markdown via `MessageMarkdown`
- [x] 4.4 Create `components/activity/agent-step-card.tsx` — expanded view for agent/lifecycle entries: `detail` as rendered markdown. Show model name if present on the entry

## 5. Session meta bar and inline summary

- [x] 5.1 Create `components/chat/session-meta-bar.tsx` — compact bar above messages: tool count, duration, model name, active status indicator, and activity panel toggle button
- [x] 5.2 Create `components/chat/inline-activity-summary.tsx` — single-line component replacing ActivityTracker inside message bubbles: "{N} tools · {duration}" with a clickable arrow that opens the activity panel
- [x] 5.3 Update `ChatPanel` render section: replace `<ActivityTracker>` usage with `<InlineActivitySummary>`, add `<SessionMetaBar>` above the messages container

## 6. Historical activity viewing

- [x] 6.1 Add `panelMode: "live" | { messageId: string }` state to `ChatSessionLayout`. When inline summary of a past message is clicked, set mode to that message's ID and pass its `intermediateSteps` to the activity panel
- [x] 6.2 Add "back to live" button in the activity panel header that resets `panelMode` to "live". Auto-reset to live when a new streaming session begins

## 7. Responsive and polish

- [x] 7.1 Implement responsive behavior: overlay/slide-over panel below 1024px with backdrop, CSS transition (300ms ease) on grid column changes
- [x] 7.2 Add `React.memo` to `TimelineEntry` to prevent unnecessary re-renders during rapid event streaming
- [x] 7.3 Deprecate `components/chat/activity-tracker.tsx` — remove all imports, delete the file

## 8. Testing

- [x] 8.1 Unit tests for `SessionMeta` derivation logic (tool count, duration calculation, model extraction from ActivityEntry[])
- [x] 8.2 Unit tests for `InlineActivitySummary` rendering with various entry combinations (empty, tools only, mixed statuses)
- [x] 8.3 Integration test: verify `ChatSessionLayout` passes activity state correctly to both panels and that SSE activity events update both views
- [x] 8.4 Verify existing chat functionality is not broken: streaming, commands, feedback, history loading, error handling

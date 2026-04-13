## Why

The current UI renders agent activity (tool calls, status, timing) inside the assistant message bubble as a collapsed accordion. Users cannot see what the agent is doing in real-time without manually expanding each message. All the data already flows through SSE to the browser (`ActivityEntry[]` with tool names, args, results, timing, model) but the rendering is minimal and hidden. A split layout with a dedicated activity panel surfaces this information without backend changes, giving users full visibility into agent behavior during and after sessions.

## What Changes

- Introduce a split layout in the chat session page: chat panel (left) + activity panel (right, collapsible)
- Create a vertical timeline component that renders `ActivityEntry[]` with timestamps, status icons, expandable tool args/results, and model info
- Add a session metadata bar at the top of the chat showing mode, model, active tool count, and session duration
- Replace the inline `ActivityTracker` accordion with a compact one-line summary that links to the activity panel
- Lift `activityLog` state from `ChatPanel` to the new layout component so both panels share it
- Make the activity panel responsive: side panel on desktop, drawer/overlay on tablet, bottom sheet on mobile
- Deprecate the current `activity-tracker.tsx` component

## Capabilities

### New Capabilities
- `activity-panel`: Dedicated side panel with session timeline, tool call cards, session info header, and session summary footer
- `split-chat-layout`: Responsive split layout wrapper that orchestrates chat and activity panels with shared state
- `session-meta-bar`: Compact status bar showing session context (mode, model, tools used, timing)

### Modified Capabilities

## Impact

- **Components created**: ~8 new React components under `components/activity/` and `components/chat/`
- **Components modified**: `chat-panel.tsx` (extract state), `chat/[sessionKey]/page.tsx` (use new layout)
- **Components deprecated**: `activity-tracker.tsx` (replaced by timeline + inline summary)
- **State management**: `activityLog` and `sessionMeta` lifted from ChatPanel to ChatSessionLayout
- **Backend**: No changes required. All data already available in existing SSE stream
- **Types**: New `SessionMeta` type in `types/chat.ts`
- **Styling**: New CSS for split grid, timeline, responsive breakpoints
- **Dependencies**: No new packages required

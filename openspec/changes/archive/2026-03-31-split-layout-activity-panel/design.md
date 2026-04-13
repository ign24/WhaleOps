## Context

The `ui-cognitive` frontend is a Next.js 16 app (React 19, Tailwind v4) that communicates with a NAT backend via SSE. The current chat page (`app/(app)/chat/[sessionKey]/page.tsx`) renders a single `ChatPanel` component that owns all state: messages, activity log, input, and streaming logic.

During streaming, NAT sends `intermediate_data:` SSE lines containing tool call events. The BFF (`/api/chat/route.ts`) re-emits these as `event: activity` SSE events. The `ChatPanel` parses them into `ActivityEntry[]` (up to 40 entries) with fields: label, kind, status, timing, model, toolArgs, toolResult. This data is rendered via `ActivityTracker` — a collapsible accordion inside the assistant message bubble that most users never expand.

The existing layout hierarchy is:
```
(app)/layout.tsx → Header + SidebarShell
  └─ SidebarShell → grid-cols-[280px_1fr] (sidebar | content)
       └─ chat/[sessionKey]/page.tsx → ChatPanel (full width of content area)
```

The `ChatPanel` component is ~1100 lines and manages: messages state, activity log state, SSE streaming, input handling, commands, feedback, and all rendering.

## Goals / Non-Goals

**Goals:**
- Surface agent activity (tool calls, timing, status) in a dedicated panel visible during streaming
- Show session context (mode, model, tool count) without expanding anything
- Keep the chat panel clean and focused on conversation
- Reuse 100% of existing data — no backend changes
- Maintain full functionality of historical activity (persisted in `intermediateSteps`)
- Responsive layout that works on desktop, tablet, and mobile

**Non-Goals:**
- Changing the SSE protocol or backend streaming logic
- Adding new event types (mode_selected, skills_activated) — that's a separate change
- Real-time token/cost tracking (requires backend changes)
- AG-UI protocol adoption (explored, deferred — current data is sufficient for v1)
- Modifying the observability dashboard
- Changing how activity events are persisted to session history

## Decisions

### 1. State lifting strategy

**Decision:** Lift `activityLog`, `isActivityCollapsed`, and `activeTool` from `ChatPanel` into a new `ChatSessionLayout` wrapper. Pass them as props to both `ChatPanel` and `ActivityPanel`.

**Why not context?** Three props is not enough to justify a context provider. Props are explicit, type-safe, and easier to trace. If more shared state emerges later, we can introduce context then.

**Why not keep state in ChatPanel and pass up via callback?** The activity panel needs to read `activityLog` directly. Lifting state to the common parent is the standard React pattern. The ChatPanel already has too many responsibilities — this is a step toward decomposition.

### 2. Component split boundary

**Decision:** The SSE parsing and streaming logic stays in `ChatPanel`. Only the activity state and its setters get lifted.

**Alternative considered:** Extract all streaming logic into a custom hook (`useChatStream`). Rejected for this change — it's a bigger refactor that should be its own change. The minimal lift is: `activityLog` + `setActivityLog` + `activeTool` + `setActiveTool` as props.

**Interface:**
```typescript
// ChatSessionLayout owns:
const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
const [activeTool, setActiveTool] = useState<string | null>(null);
const [isActivityOpen, setIsActivityOpen] = useState(true);

// ChatPanel receives:
type ChatPanelProps = {
  sessionKey: string;
  activityLog: ActivityEntry[];
  onActivityEvent: (entry: ActivityEntry[]) => void;  // wraps setActivityLog
  activeTool: string | null;
  onActiveToolChange: (tool: string | null) => void;
  onToggleActivity: () => void;
};

// ActivityPanel receives:
type ActivityPanelProps = {
  entries: ActivityEntry[];
  activeTool: string | null;
  isLive: boolean;
  onClose: () => void;
};
```

### 3. Layout grid structure

**Decision:** Nest the split inside the existing `SidebarShell` content area. The chat page renders `ChatSessionLayout` which manages a CSS grid split.

```
SidebarShell grid: [sidebar | content]
                              │
                    ChatSessionLayout grid: [chat | activity]
```

**Grid definitions:**
```css
/* Desktop (>= 1280px) */
grid-template-columns: 1fr 380px;

/* Large tablet (1024-1279px) */
grid-template-columns: 1fr 320px;

/* Below 1024px — panel hidden, toggle opens overlay */
grid-template-columns: 1fr;
```

**Why not a resizable splitter?** Added complexity (drag handle, min/max widths, persistence) for marginal UX gain. A fixed width with collapse toggle is simpler and covers the use case. Can add resizing later if users request it.

### 4. Activity panel component hierarchy

```
ActivityPanel
├── SessionInfo          — mode, model, run duration, tool count
├── ActivityTimeline     — scrollable list of TimelineEntry
│   └── TimelineEntry    — single entry with status icon, label, timing
│       ├── ToolCallCard — expandable: args (JSON) + result (markdown)
│       └── AgentStepCard — expandable: detail text
└── SessionSummary       — totals: duration, tool count, success/fail counts
```

**Decision:** Each entry type gets its own card component instead of a generic expandable. Tool calls need JSON args + markdown results. Agent steps need detail text. Lifecycle events need minimal rendering.

### 5. Inline activity summary (replaces ActivityTracker)

**Decision:** Replace the full `ActivityTracker` inside message bubbles with `InlineActivitySummary` — a single non-expanding line:

```
[3 tools · 7.6s · completed]  →
```

The arrow is a button that: (a) opens the activity panel if closed, and (b) scrolls to the relevant entries. For historical messages, clicking shows that message's `intermediateSteps` in the panel.

**Why keep anything inline?** Without it, there's no visual cue in the chat that the agent did work. The one-liner connects conversation flow to the activity panel.

### 6. Historical vs live activity

**Decision:** The activity panel shows two modes:

- **Live mode** (during streaming): Renders `activityLog` state directly. Entries animate in as they arrive. Auto-scrolls to latest.
- **Historical mode** (after streaming or on page load): When user clicks an inline summary on a past message, the panel shows that message's `intermediateSteps`. A "back to live" button returns to current activity.

State: `panelMode: "live" | { messageId: string }` in `ChatSessionLayout`.

### 7. SessionMeta data source

**Decision:** Derive `SessionMeta` from existing data, no new events needed:

```typescript
type SessionMeta = {
  toolCount: number;        // activityLog.filter(e => e.kind === "tool").length
  totalDuration: number;    // sum of entry durations
  activeToolCount: number;  // entries with status "running"
  failedCount: number;      // entries with status "failed"
  model: string | null;     // first entry with .model set
  isLive: boolean;          // isSending from ChatPanel
};
```

All derived from `activityLog`. No new data source required. The `model` field is already captured in `ActivityEntry` but never displayed — now it surfaces in `SessionInfo` and `SessionMetaBar`.

### 8. Responsive behavior

| Breakpoint | Activity Panel | Toggle |
|---|---|---|
| >= 1024px | Side panel (grid column) | Button in SessionMetaBar |
| 768-1023px | Slide-over overlay from right | Same button |
| < 768px | Bottom sheet (50vh max) | Same button |

**Implementation:** The panel is always rendered but conditionally positioned via CSS. On mobile/tablet, it overlays with a backdrop. The toggle button lives in `SessionMetaBar` and is always visible.

## Risks / Trade-offs

**[Chat panel refactor scope]** Lifting state out of ChatPanel touches a 1100-line component. Risk of breaking existing streaming logic.
  → Mitigation: Only move state declarations and their setters. SSE parsing stays untouched. Test streaming before and after.

**[ActivityEntry data completeness]** NAT's `intermediate_data:` events may not always include all fields (model, toolArgs, toolResult). Some entries may render with missing info.
  → Mitigation: All UI components handle missing fields gracefully (already do in current ActivityTracker). Show "—" for missing durations, skip empty sections.

**[Performance with many entries]** The 40-entry limit in `mergeActivityEntry` prevents memory issues, but rapid tool calls during streaming could cause frequent re-renders.
  → Mitigation: Keep the slice(-40) limit. Use `React.memo` on `TimelineEntry`. The panel scroll container isolates layout recalculations.

**[Layout shift]** Opening/closing the activity panel resizes the chat area, potentially causing layout shift in the message list.
  → Mitigation: CSS transition on grid-template-columns (300ms ease). Chat panel uses min-width: 0 to prevent overflow.

## ADDED Requirements

### Requirement: OpsSessionContext component replaces SessionWorkspace
The system SHALL render an `OpsSessionContext` component at the bottom of the `ActivityPanel` in place of `SessionWorkspace`. The component SHALL be collapsible and show a summary of ops resources referenced during the session.

#### Scenario: Panel is hidden when session has no ops tool calls
- **WHEN** no ActivityEntry in the session contains a call to `list_containers`, `get_container_logs`, `inspect_container`, `save_note`, `get_notes`, or `schedule_task`
- **THEN** the `OpsSessionContext` panel is not rendered

#### Scenario: Panel shows containers referenced
- **WHEN** the session contains tool calls with `container_name` or `container_id` args
- **THEN** the panel lists each unique container name/id under "Containers consultados"

#### Scenario: Panel shows log fetches
- **WHEN** the session contains `get_container_logs` tool calls
- **THEN** the panel lists each container name and the number of lines requested under "Logs obtenidos"

#### Scenario: Panel shows saved notes
- **WHEN** the session contains `save_note` tool calls
- **THEN** the panel lists each saved note with its type and associated container (if any) under "Notas guardadas"

#### Scenario: Panel shows created schedules
- **WHEN** the session contains `schedule_task` tool calls with action "create"
- **THEN** the panel lists each schedule name and cron expression under "Tareas programadas"

#### Scenario: Panel collapses when total items exceed 10
- **WHEN** the total count of items across all sections exceeds 10
- **THEN** the panel renders in collapsed state by default

### Requirement: deriveOpsSnapshot pure function
The system SHALL export a `deriveOpsSnapshot(entries: ActivityEntry[]): OpsSnapshot` pure function from `components/activity/ops-session-context.tsx` (or a co-located module). The function SHALL be deterministic and have no side effects.

#### Scenario: Returns empty snapshot for empty entries
- **WHEN** called with an empty array
- **THEN** returns `{ containersReferenced: [], logsFetched: [], notesSaved: [], schedulesCreated: [], isEmpty: true }`

#### Scenario: Deduplicates container names
- **WHEN** multiple entries reference the same container_name
- **THEN** the container appears only once in `containersReferenced`

#### Scenario: Extracts log fetch metadata
- **WHEN** an entry has tool name `get_container_logs` with args `container_name` and `lines`
- **THEN** `logsFetched` includes `{ container: string, lines: number }`

#### Scenario: Marks snapshot as non-empty when any section has items
- **WHEN** at least one ops tool call is present in entries
- **THEN** `isEmpty` is false

### Requirement: ContextChips shows container chip instead of sandboxPath
The `ContextChips` sub-component of `ToolCallCard` SHALL remove the `sandboxPath` prop and instead accept a `containerRef` optional prop. When `containerRef` is present, it SHALL render a chip styled identically to the existing sandbox chip.

#### Scenario: Container chip rendered when containerRef provided
- **WHEN** a tool call has `container_name` or `container_id` in its args and the parent passes `containerRef`
- **THEN** a chip with the container reference is rendered in the context chips row

#### Scenario: sandboxPath chip no longer rendered
- **WHEN** any tool call is rendered via ToolCallCard
- **THEN** no chip with `sandboxPath` content is rendered

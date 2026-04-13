## ADDED Requirements

### Requirement: Write tools pause for user confirmation via LangGraph interrupt
Write tool functions (`write_file`, `edit_file`) SHALL call `langgraph.types.interrupt()` before executing the write operation when `hitl_enabled` is true for the current mode.

#### Scenario: User approves write
- **WHEN** execute mode calls `write_file` with a file path and content
- **THEN** the graph pauses, the user receives a confirmation prompt with file path and content preview (first 500 chars), and the write executes only after the user selects "Approve"

#### Scenario: User rejects write
- **WHEN** the user selects "Reject" on the write confirmation prompt
- **THEN** the tool returns a rejection message to the agent, the file is NOT written, and the agent continues with the next planned action

#### Scenario: Interrupt timeout
- **WHEN** the user does not respond within `interrupt_timeout_seconds`
- **THEN** the write is auto-rejected (safe default) and the agent receives a timeout rejection message

### Requirement: Read tools execute without interruption
Read-only tools (read_text_file, directory_tree, list_directory, search_files) SHALL NOT trigger an interrupt regardless of mode or HITL configuration.

#### Scenario: Read tool in execute mode with HITL enabled
- **WHEN** execute mode calls `read_text_file` with `hitl_enabled: true`
- **THEN** the tool executes immediately without pausing for user confirmation

### Requirement: Interrupt payload contains actionable preview
The interrupt payload sent to the UI SHALL contain sufficient information for the user to make an informed approve/reject decision.

#### Scenario: Write file interrupt payload
- **WHEN** `write_file` triggers an interrupt
- **THEN** the payload includes: `action` ("write_file"), `path` (target file), `preview` (first 500 characters of content), and `size` (total content length in characters)

#### Scenario: Edit file interrupt payload
- **WHEN** `edit_file` triggers an interrupt
- **THEN** the payload includes: `action` ("edit_file"), `path` (target file), `preview` (the edit diff or replacement content), and `size` (content length)

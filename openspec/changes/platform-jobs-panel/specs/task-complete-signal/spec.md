## ADDED Requirements

### Requirement: Agent emits task_complete SSE event on graph exit
The system SHALL emit a `task_complete` SSE event after the LangGraph graph finishes streaming (i.e., after `astream_events` is exhausted in `safe_tool_calling_agent.py`). The event payload SHALL be `{ "type": "task_complete", "success": true }` if the graph exited without exception, or `{ "type": "task_complete", "success": false }` if an exception was raised. The event SHALL be emitted via the same `intermediate_data` channel used by `tool_start` / `tool_end` events.

#### Scenario: Successful task completion
- **WHEN** the LangGraph graph reaches `__end__` without raising an exception
- **THEN** the agent SHALL emit `{ "type": "task_complete", "success": true }` as the final SSE event of the turn

#### Scenario: Task fails with exception
- **WHEN** the `astream_events` loop exits due to an unhandled exception
- **THEN** the agent SHALL emit `{ "type": "task_complete", "success": false }` before propagating the error

#### Scenario: Event is emitted exactly once per turn
- **WHEN** the agent completes any turn (regardless of how many tools were called)
- **THEN** exactly one `task_complete` event SHALL be emitted at the end of that turn

---

### Requirement: Chat UI renders a Done / Failed badge after the last message
The system SHALL parse the `task_complete` SSE event in the chat panel. Upon receiving it, the frontend SHALL append a compact status badge below the last agent message. The badge SHALL display "Done" in `--success` color when `success: true`, and "Failed" in `--error` color when `success: false`. The chat input SHALL be re-enabled when `task_complete` is received (regardless of `success` value).

#### Scenario: Done badge rendered
- **WHEN** the chat panel receives `{ "type": "task_complete", "success": true }` via SSE
- **THEN** a "Done" badge in `--success` color SHALL appear below the last agent message

#### Scenario: Failed badge rendered
- **WHEN** the chat panel receives `{ "type": "task_complete", "success": false }` via SSE
- **THEN** a "Failed" badge in `--error` color SHALL appear below the last agent message

#### Scenario: Input re-enabled on completion
- **WHEN** the chat panel receives any `task_complete` event
- **THEN** the chat input field SHALL be re-enabled and the user SHALL be able to type a new message

#### Scenario: Badge is not rendered for intermediate events
- **WHEN** the chat panel receives `tool_start` or `tool_end` events
- **THEN** no `task_complete` badge SHALL be rendered (the badge only appears for `task_complete` events)

#### Scenario: No badge rendered if task_complete is never received
- **WHEN** the SSE stream ends without a `task_complete` event (e.g. connection drop)
- **THEN** no badge SHALL be rendered and the existing streaming-timeout behavior SHALL re-enable the input

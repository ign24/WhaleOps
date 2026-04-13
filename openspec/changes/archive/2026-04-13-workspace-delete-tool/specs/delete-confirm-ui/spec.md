## ADDED Requirements

### Requirement: chat-panel SHALL detect awaiting_ui_confirmation tool result and render PIN modal
When a tool result in the stream contains `status="awaiting_ui_confirmation"`, the chat panel SHALL render a `DeleteConfirmModal` component instead of (or alongside) the normal tool result card.

#### Scenario: Modal shown on awaiting_ui_confirmation
- **WHEN** the tool result stream contains `{status: "awaiting_ui_confirmation", confirmation_token, target_path, size_mb}`
- **THEN** the `DeleteConfirmModal` SHALL be rendered
- **AND** the modal SHALL display the `target_path` and `size_mb`
- **AND** a masked PIN input field SHALL be present
- **AND** a Cancel button and a Confirm button SHALL be present

#### Scenario: PIN never appears in chat history
- **WHEN** the user enters a PIN in the modal and confirms
- **THEN** the PIN value SHALL NOT appear in the chat message list
- **AND** the PIN SHALL NOT be sent to the agent or the LLM

### Requirement: DeleteConfirmModal SHALL submit PIN to confirm endpoint and display result
On submit, the modal SHALL POST `{token, pin}` to `/api/workspace/delete/confirm` and handle all response codes.

#### Scenario: Successful confirmation closes modal and shows success message in chat
- **WHEN** the user enters the correct PIN and clicks Confirm
- **THEN** the modal SHALL close
- **AND** a success message SHALL appear in the chat: "Workspace deleted: <target_path> (<size_freed_mb> MB freed)"
- **AND** the agent loop SHALL NOT be restarted

#### Scenario: Wrong PIN keeps modal open with error message
- **WHEN** the user enters an incorrect PIN and clicks Confirm
- **THEN** the modal SHALL remain open
- **AND** an inline error message SHALL appear: "PIN incorrecto, intentá de nuevo"
- **AND** the PIN input SHALL be cleared
- **AND** the token SHALL remain valid

#### Scenario: Token expired shows expiry message and closes modal
- **WHEN** the confirm endpoint returns 410 (token expired)
- **THEN** the modal SHALL close
- **AND** a message SHALL appear in chat: "La confirmación expiró. Pedile al agente que lo intente de nuevo."

#### Scenario: Cancel closes modal without deleting
- **WHEN** the user clicks Cancel
- **THEN** the modal SHALL close
- **AND** NO request SHALL be sent to the confirm endpoint
- **AND** a message SHALL appear in chat: "Eliminación cancelada"

### Requirement: PIN input SHALL be masked and have no autocomplete
The PIN input SHALL have `type="password"` and `autoComplete="off"` to prevent browser autofill and visual exposure.

#### Scenario: PIN input is masked
- **WHEN** the user types in the PIN field
- **THEN** the characters SHALL be displayed as bullets or asterisks
- **AND** the value SHALL NOT be readable in the DOM as plaintext

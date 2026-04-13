## ADDED Requirements

### Requirement: Deterministic session ID derivation from chat ID
The system SHALL derive the agent `session_id` for a Telegram chat using the formula `f"telegram:{chat_id}"`. No external storage or lookup SHALL be required for the default session ID.

#### Scenario: New chat sends first message
- **WHEN** a message arrives from a `chat_id` with no prior session override
- **THEN** the system SHALL compute `session_id = f"telegram:{chat_id}"` and use it for the agent call

#### Scenario: Same chat sends subsequent messages
- **WHEN** the same `chat_id` sends another message without a `/reset` in between
- **THEN** the system SHALL use the same `session_id`, enabling memory continuity across messages

### Requirement: Session override after /reset
After a `/reset` command, the system SHALL generate a new unique `session_id` for the chat and store it in an in-memory mapping. Subsequent messages from that chat SHALL use the overridden `session_id` until the process restarts or another `/reset` is issued.

#### Scenario: /reset generates new session
- **WHEN** a user sends `/reset`
- **THEN** the system SHALL generate `session_id = f"telegram:{chat_id}:{uuid4().hex[:8]}"` and store it in the per-process override map

#### Scenario: Message after /reset uses new session
- **WHEN** a message arrives from a chat that previously issued `/reset`
- **THEN** the system SHALL use the overridden `session_id` from the override map, not the default derived ID

#### Scenario: Process restart clears overrides
- **WHEN** the server restarts
- **THEN** all session overrides are cleared and chats return to the deterministic default `session_id`; this is acceptable and expected

### Requirement: Allowlist validation
The session bridge SHALL expose a function `is_allowed(chat_id: int) -> bool` that checks membership in the parsed `TELEGRAM_ALLOWED_CHAT_IDS` set. This set SHALL be parsed once at module import time.

#### Scenario: chat_id in allowlist
- **WHEN** `is_allowed(chat_id)` is called with an ID present in `TELEGRAM_ALLOWED_CHAT_IDS`
- **THEN** it SHALL return `True`

#### Scenario: chat_id not in allowlist
- **WHEN** `is_allowed(chat_id)` is called with an ID absent from `TELEGRAM_ALLOWED_CHAT_IDS`
- **THEN** it SHALL return `False`

#### Scenario: Malformed allowlist entry
- **WHEN** `TELEGRAM_ALLOWED_CHAT_IDS` contains a non-integer token (e.g. `"abc"`)
- **THEN** the system SHALL skip that token, log a warning, and continue parsing the rest

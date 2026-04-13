## ADDED Requirements

### Requirement: Webhook endpoint receives Telegram updates
The system SHALL expose a POST `/telegram/webhook` endpoint on the existing FastAPI app. On receipt of a valid Telegram Update payload, it SHALL parse the update, validate the secret token header, and dispatch to the message handler.

#### Scenario: Valid update with secret token
- **WHEN** a POST arrives at `/telegram/webhook` with the correct `X-Telegram-Bot-Api-Secret-Token` header and a valid JSON Telegram Update body
- **THEN** the system SHALL parse the update, extract the message, and dispatch to the agent pipeline

#### Scenario: Missing or incorrect secret token
- **WHEN** a POST arrives at `/telegram/webhook` with a missing or incorrect `X-Telegram-Bot-Api-Secret-Token` header
- **THEN** the system SHALL return HTTP 403 and take no further action

#### Scenario: Non-message update types
- **WHEN** the update contains no `message` field (e.g. edited_message, callback_query)
- **THEN** the system SHALL return HTTP 200 and take no further action

### Requirement: Private chat restriction
The system SHALL only process messages from private chats (`chat.type == "private"`). Messages from groups or channels SHALL be silently ignored.

#### Scenario: Private chat message
- **WHEN** a message arrives from a `chat.type == "private"` chat
- **THEN** the system SHALL proceed to allowlist check and agent dispatch

#### Scenario: Group chat message
- **WHEN** a message arrives from a `chat.type` other than `"private"`
- **THEN** the system SHALL return HTTP 200 without sending any reply

### Requirement: Access control via allowlist
The system SHALL reject requests from chat IDs not listed in `TELEGRAM_ALLOWED_CHAT_IDS`. Rejected messages SHALL receive no reply.

#### Scenario: Allowed chat ID
- **WHEN** a message arrives from a `chat_id` present in `TELEGRAM_ALLOWED_CHAT_IDS`
- **THEN** the system SHALL proceed to agent dispatch

#### Scenario: Disallowed chat ID
- **WHEN** a message arrives from a `chat_id` not in `TELEGRAM_ALLOWED_CHAT_IDS`
- **THEN** the system SHALL return HTTP 200 and send no Telegram reply

#### Scenario: Empty allowlist (TELEGRAM_ALLOWED_CHAT_IDS not set)
- **WHEN** `TELEGRAM_ALLOWED_CHAT_IDS` env var is absent or empty
- **THEN** the system SHALL reject all messages and log a warning on startup

### Requirement: Typing indicator during agent execution
The system SHALL send a `ChatAction.TYPING` action to the chat immediately after accepting a message, and SHALL re-send it every 4 seconds until the agent completes.

#### Scenario: Agent running
- **WHEN** the agent is processing a message
- **THEN** the user SHALL see the typing indicator in Telegram (refreshed before it expires every 5s)

### Requirement: Agent response delivery
The system SHALL send the agent's complete response as a single Telegram message once the agent finishes. Responses exceeding 4096 characters SHALL be truncated at 4000 chars with a `\n[...]` suffix.

#### Scenario: Normal response
- **WHEN** the agent returns a response under 4096 chars
- **THEN** the system SHALL send the full response as a Telegram message with `parse_mode=Markdown`

#### Scenario: Long response truncation
- **WHEN** the agent returns a response over 4000 chars
- **THEN** the system SHALL send the first 4000 chars followed by `\n[...]`

#### Scenario: Empty agent response
- **WHEN** the agent returns an empty string or whitespace-only response
- **THEN** the system SHALL send the message `"(no response)"` to indicate completion

### Requirement: Per-chat concurrency guard
The system SHALL process at most one agent request per chat at a time. If a new message arrives while the agent is still processing the previous one, the system SHALL reply with a busy message.

#### Scenario: Message while agent busy
- **WHEN** a new message arrives from a chat that has an in-flight agent request
- **THEN** the system SHALL reply with `"Working on your previous message, please wait..."` and not enqueue a new agent call

#### Scenario: Sequential messages
- **WHEN** a new message arrives after the previous agent call completes
- **THEN** the system SHALL process it normally

### Requirement: Webhook registration on startup
The system SHALL call `bot.set_webhook(url=TELEGRAM_WEBHOOK_URL, secret_token=TELEGRAM_WEBHOOK_SECRET)` during the FastAPI app startup lifespan. The result SHALL be logged at INFO level.

#### Scenario: Successful webhook registration
- **WHEN** the app starts and `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_URL` are set
- **THEN** the system SHALL register the webhook with Telegram and log `"Telegram webhook registered: <url>"`

#### Scenario: Missing bot token
- **WHEN** `TELEGRAM_BOT_TOKEN` is absent at startup
- **THEN** the system SHALL log a warning `"TELEGRAM_BOT_TOKEN not set — Telegram bot disabled"` and skip all Telegram initialization

### Requirement: /reset command clears session context
The system SHALL handle the `/reset` Telegram command by generating a new `session_id` for the chat, effectively starting a fresh conversation.

#### Scenario: User sends /reset
- **WHEN** a user sends `/reset` in a private allowed chat
- **THEN** the system SHALL assign a new `session_id` for that `chat_id` and reply with `"Session reset. Starting fresh."`

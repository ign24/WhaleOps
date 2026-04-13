## Why

The agent is only accessible via the web UI — there's no way to interact with it from a mobile device or trigger tasks without opening a browser. A Telegram bot provides a lightweight, always-available interface that fits the use case of quick queries, status checks, and kicking off agent tasks from anywhere.

## What Changes

- New `telegram/` module under `src/cognitive_code_agent/telegram/` implementing the bot lifecycle, webhook handler, and message routing.
- New FastAPI route registered in `register.py` to receive Telegram webhook POST requests — follows the same pattern as `register_workspace_routes`.
- Per-chat session isolation: each Telegram `chat_id` maps to a stable `session_id`, enabling multi-turn conversations with memory continuity.
- Agent responses streamed internally and delivered as a single formatted Telegram message (with typing action while the agent runs).
- Allowlist-based access control via `TELEGRAM_ALLOWED_CHAT_IDS` env var — only listed chat IDs can invoke the agent.
- Bot registration script to set the webhook URL against the Telegram Bot API on startup.

## Capabilities

### New Capabilities

- `telegram-bot-gateway`: Webhook endpoint that receives Telegram updates, validates requests, routes messages to the agent, and sends back responses. Manages bot lifecycle (webhook registration on startup).
- `telegram-session-bridge`: Maps Telegram `chat_id` values to stable agent `session_id` strings, enabling conversation continuity across messages. Enforces the chat allowlist.

### Modified Capabilities

*(none — no existing spec-level behavior changes)*

## Impact

- **New dependency**: `python-telegram-bot>=21` (async, webhook-native)
- **New env vars**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_URL`, `TELEGRAM_ALLOWED_CHAT_IDS` (comma-separated)
- **register.py**: gains a `_apply_telegram_patch()` call to register the webhook route, following the same lifespan pattern as cron
- **No changes** to agent logic, NAT integration, or existing tools
- **EasyPanel**: webhook URL must be a publicly reachable HTTPS endpoint — EasyPanel already handles TLS termination

## Context

The agent runs inside a NAT (NVIDIA Agent Toolkit) FastAPI application. Custom functionality is injected via `register.py` using lifespan patches on `FastApiFrontEndPluginWorker.configure` — this is the established pattern for adding routes and background tasks without modifying NAT internals.

The agent accepts prompts via `builder.stream_fn(prompt, session_id=...)` which runs the full agent loop and streams back events. This is the same path used by the web UI and cron jobs.

EasyPanel handles TLS termination and exposes a public HTTPS URL, making webhook mode viable.

## Goals / Non-Goals

**Goals:**
- Accept Telegram messages and route them through the agent
- Map each `chat_id` to a stable `session_id` for conversation continuity
- Enforce allowlist access control via env var
- Integrate cleanly into the existing FastAPI app without a separate service
- Register the Telegram webhook automatically on startup

**Non-Goals:**
- Multi-user auth beyond the chat_id allowlist (no OAuth, no user accounts)
- Inline message editing / streaming updates to Telegram (would require complex polling logic)
- Voice message transcription
- File/image sending to the agent (text-only for now)
- Telegram group chats (only private chats with `chat.type == "private"`)

## Decisions

### 1. Webhook vs polling

**Decision**: Webhook mode.

Polling requires a persistent loop and introduces latency (~1s). The server is always running and has a public HTTPS URL. Webhook delivers messages instantly with zero extra compute.

Alternatives: long-polling via `python-telegram-bot`'s `ApplicationBuilder.updater` — discarded, adds complexity for no benefit on a persistent server.

### 2. Integrated FastAPI route vs separate service

**Decision**: Integrate as a FastAPI route registered in the existing app.

Follows the established `register_workspace_routes` pattern. No additional Docker container, no service discovery, no extra port. The webhook endpoint lives at `/telegram/webhook`.

Alternatives: separate `telegram_service/` container — discarded, over-engineered for a single-user bot.

### 3. Response delivery: streaming vs collect-and-send

**Decision**: Collect the full agent response, then send as a single Telegram message.

Telegram's `editMessageText` approach (send placeholder, keep editing) works but requires tracking `message_id` and handling edit rate limits (max 1 edit/second). The agent runs for 10–60s — sending a single message after completion is simpler and more reliable.

Send `ChatAction.TYPING` while the agent runs to signal activity.

Alternatives: progressive edits — discarded, adds rate-limit complexity for marginal UX gain.

### 4. Session ID scheme

**Decision**: `session_id = f"telegram:{chat_id}"`.

Simple, stable, human-readable, unique per chat. Reuses existing session memory infrastructure without any new storage. Deterministic — no need to persist a mapping table.

### 5. Access control

**Decision**: `TELEGRAM_ALLOWED_CHAT_IDS` env var (comma-separated integers). Requests from unlisted chat IDs are silently ignored (no reply — prevents info leakage about bot existence).

Alternatives: no auth (too permissive for an autonomous code agent), token-based per-message auth (too complex for CLI-style UX).

### 6. Library choice

**Decision**: `python-telegram-bot>=21` — async-native, webhook support via `Application.run_webhook()` or manual `bot.set_webhook()` + raw update parsing.

Since we need to integrate into an existing FastAPI app (not take over the ASGI loop), we use the bot in **manual webhook mode**: call `bot.set_webhook(url)` on startup, parse incoming JSON payloads directly via `Update.de_json()`, and dispatch to a handler. This avoids `Application.run_webhook()` which would start its own server.

## Risks / Trade-offs

- **Telegram webhook secret token**: Without a `secret_token`, anyone who knows the URL can POST fake updates. Mitigation: set `X-Telegram-Bot-Api-Secret-Token` header validation via `TELEGRAM_WEBHOOK_SECRET` env var.
- **Agent response length**: Telegram messages are capped at 4096 chars. Mitigation: truncate with a `[truncated]` suffix and log the full response.
- **Concurrent messages from same chat**: If user sends a second message while agent is running, it queues behind the first. Mitigation: per-chat asyncio lock, reject concurrent messages with a "busy" reply.
- **Startup webhook registration failure**: If Telegram can't reach the webhook URL (misconfigured env), the bot silently doesn't work. Mitigation: log the `set_webhook` response clearly at startup.

## Migration Plan

1. Add `python-telegram-bot>=21` to `pyproject.toml`
2. Create `src/cognitive_code_agent/telegram/` module
3. Add `_apply_telegram_patch()` to `register.py`
4. Set env vars in EasyPanel: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_URL`, `TELEGRAM_ALLOWED_CHAT_IDS`, `TELEGRAM_WEBHOOK_SECRET`
5. Redeploy — webhook registers automatically on startup
6. Rollback: remove env vars + revert `register.py` import — no DB state to clean up

## Open Questions

- Should `/reset` command clear the session (useful for starting fresh context)?
- Should the bot support `/help` listing available commands?
- Max message length before truncation — 4096 (hard Telegram limit) or lower (e.g. 3000)?

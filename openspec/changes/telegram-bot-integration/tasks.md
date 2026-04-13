## 1. Dependencies & Module Scaffold

- [ ] 1.1 Add `python-telegram-bot>=21` to `pyproject.toml` dependencies
- [ ] 1.2 Create `src/cognitive_code_agent/telegram/` package with `__init__.py`
- [ ] 1.3 Create `src/cognitive_code_agent/telegram/session_bridge.py` (allowlist parsing + session ID derivation)
- [ ] 1.4 Create `src/cognitive_code_agent/telegram/bot.py` (bot instance + webhook handler)

## 2. Session Bridge (TDD)

- [ ] 2.1 Write tests for `is_allowed()`: allowed ID, disallowed ID, malformed entry skipped
- [ ] 2.2 Implement `is_allowed(chat_id: int) -> bool` using `TELEGRAM_ALLOWED_CHAT_IDS` env var
- [ ] 2.3 Write tests for `get_session_id()`: default derivation, post-reset override
- [ ] 2.4 Implement `get_session_id(chat_id: int) -> str` with in-memory override map
- [ ] 2.5 Implement `reset_session(chat_id: int) -> str` generating new suffixed session ID

## 3. Bot Gateway (TDD)

- [ ] 3.1 Write tests for webhook secret token validation: valid, missing, wrong token → 403
- [ ] 3.2 Write tests for private-chat filter: group chat ignored, private chat proceeds
- [ ] 3.3 Write tests for allowlist gate: allowed proceeds, disallowed → HTTP 200 no reply
- [ ] 3.4 Write tests for concurrency guard: second message while busy gets busy reply
- [ ] 3.5 Write tests for /reset command: new session ID assigned, confirmation reply sent
- [ ] 3.6 Write tests for response truncation: >4000 chars gets truncated with `\n[...]`
- [ ] 3.7 Implement `handle_update(request: Request) -> Response` FastAPI endpoint
- [ ] 3.8 Implement typing indicator loop (send every 4s while agent runs)
- [ ] 3.9 Implement agent dispatch via `builder_stream_fn(prompt, session_id=...)`
- [ ] 3.10 Implement response delivery with truncation and empty-response fallback

## 4. FastAPI Integration

- [ ] 4.1 Create `src/cognitive_code_agent/telegram/routes.py` with `register_telegram_routes(app, builder)` function
- [ ] 4.2 Implement startup webhook registration (`bot.set_webhook`) inside `register_telegram_routes`
- [ ] 4.3 Add `_apply_telegram_patch()` to `register.py` following cron lifespan pattern
- [ ] 4.4 Call `_apply_telegram_patch()` in `register.py` at module load time
- [ ] 4.5 Add `telegram` module to `__all__` in `register.py`

## 5. Configuration & Env Vars

- [ ] 5.1 Document required env vars in `README` or `AGENTS.md`: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_URL`, `TELEGRAM_ALLOWED_CHAT_IDS`, `TELEGRAM_WEBHOOK_SECRET`
- [ ] 5.2 Add env var stubs to `.env.example` (if it exists) or note in AGENTS.md

## 6. Verification

- [ ] 6.1 Run full test suite: `uv run pytest -x`
- [ ] 6.2 Run linter: `uv run ruff check . && uv run ruff format --check .`
- [ ] 6.3 Deploy to EasyPanel, set env vars, confirm webhook registered in startup logs
- [ ] 6.4 Send a test message from allowed chat ID and verify agent response arrives
- [ ] 6.5 Test /reset: confirm new session ID in logs, confirm fresh context in response
- [ ] 6.6 Test concurrency: send two rapid messages, confirm second gets busy reply

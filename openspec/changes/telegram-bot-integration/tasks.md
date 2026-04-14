## 1. Dependencies & Module Scaffold

- [x] 1.1 Add `python-telegram-bot>=21` to `pyproject.toml` dependencies
- [x] 1.2 Create `src/cognitive_code_agent/telegram/` package with `__init__.py`
- [x] 1.3 Create `src/cognitive_code_agent/telegram/session_bridge.py` (allowlist parsing + session ID derivation)
- [x] 1.4 Create `src/cognitive_code_agent/telegram/bot.py` (bot instance + webhook handler)

## 2. Session Bridge (TDD)

- [x] 2.1 Write tests for `is_allowed()`: allowed ID, disallowed ID, malformed entry skipped
- [x] 2.2 Implement `is_allowed(chat_id: int) -> bool` using `TELEGRAM_ALLOWED_CHAT_IDS` env var
- [x] 2.3 Write tests for `get_session_id()`: default derivation, post-reset override
- [x] 2.4 Implement `get_session_id(chat_id: int) -> str` with in-memory override map
- [x] 2.5 Implement `reset_session(chat_id: int) -> str` generating new suffixed session ID

## 3. Bot Gateway (TDD)

- [x] 3.1 Write tests for webhook secret token validation: valid, missing, wrong token → 403
- [x] 3.2 Write tests for private-chat filter: group chat ignored, private chat proceeds
- [x] 3.3 Write tests for allowlist gate: allowed proceeds, disallowed → HTTP 200 no reply
- [x] 3.4 Write tests for concurrency guard: second message while busy gets busy reply
- [x] 3.5 Write tests for /reset command: new session ID assigned, confirmation reply sent
- [x] 3.6 Write tests for response truncation: >4000 chars gets truncated with `\n[...]`
- [x] 3.7 Implement `handle_update(request: Request) -> Response` FastAPI endpoint
- [x] 3.8 Implement typing indicator loop (send every 4s while agent runs)
- [x] 3.9 Implement agent dispatch via `builder_stream_fn(prompt, session_id=...)`
- [x] 3.10 Implement response delivery with truncation and empty-response fallback

## 4. FastAPI Integration

- [x] 4.1 Create `src/cognitive_code_agent/telegram/routes.py` with `register_telegram_routes(app, builder)` function
- [x] 4.2 Implement startup webhook registration (`bot.set_webhook`) inside `register_telegram_routes`
- [x] 4.3 Add `_apply_telegram_patch()` to `register.py` following cron lifespan pattern
- [x] 4.4 Call `_apply_telegram_patch()` in `register.py` at module load time
- [x] 4.5 Add `telegram` module to `__all__` in `register.py`

## 5. Configuration & Env Vars

- [x] 5.1 Document required env vars in `README` or `AGENTS.md`: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_URL`, `TELEGRAM_ALLOWED_CHAT_IDS`, `TELEGRAM_WEBHOOK_SECRET`
- [x] 5.2 Add env var stubs to `.env.example` (if it exists) or note in AGENTS.md

## 6. Verification

- [ ] 6.1 Run full test suite: `uv run pytest -x`
- [ ] 6.2 Run linter: `uv run ruff check . && uv run ruff format --check .`
- [ ] 6.3 Deploy to EasyPanel, set env vars, confirm webhook registered in startup logs
- [ ] 6.4 Send a test message from allowed chat ID and verify agent response arrives
- [ ] 6.5 Test /reset: confirm new session ID in logs, confirm fresh context in response
- [ ] 6.6 Test concurrency: send two rapid messages, confirm second gets busy reply

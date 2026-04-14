"""FastAPI registration for Telegram webhook route and startup hook."""

from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import Request

from cognitive_code_agent.telegram.bot import TelegramGateway, build_telegram_bot

logger = logging.getLogger(__name__)


class _NoopBot:
    async def send_message(self, chat_id: int, text: str, parse_mode: str | None = None) -> None:
        return None

    async def send_chat_action(self, chat_id: int, action: str) -> None:
        return None


def register_telegram_routes(app: Any, builder: Any) -> None:
    if getattr(app.state, "cognitive_telegram_routes_registered", False):
        return

    stream_fn = getattr(builder, "stream_fn", None)
    if not callable(stream_fn):
        stream_fn = None

    bot = build_telegram_bot()
    gateway = TelegramGateway(
        bot=bot if bot is not None else _NoopBot(),
        builder_stream_fn=stream_fn,
        webhook_secret=os.environ.get("TELEGRAM_WEBHOOK_SECRET", ""),
    )

    @app.post("/telegram/webhook")
    async def telegram_webhook(request: Request):
        return await gateway.handle_update(request)

    async def _register_webhook_on_startup() -> None:
        webhook_url = os.environ.get("TELEGRAM_WEBHOOK_URL", "").strip()
        webhook_secret = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "").strip() or None

        if bot is None:
            logger.warning("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled")
            return
        if not webhook_url:
            logger.warning("TELEGRAM_WEBHOOK_URL not set — skipping Telegram webhook registration")
            return

        try:
            await bot.set_webhook(url=webhook_url, secret_token=webhook_secret)
            logger.info("Telegram webhook registered: %s", webhook_url)
        except Exception as exc:
            logger.warning("Telegram webhook registration failed: %s", exc)

    app.add_event_handler("startup", _register_webhook_on_startup)

    app.state.cognitive_telegram_routes_registered = True

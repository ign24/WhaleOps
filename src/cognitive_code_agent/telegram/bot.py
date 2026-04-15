"""Telegram webhook gateway for dispatching prompts to the agent."""

from __future__ import annotations

import asyncio
import inspect
import logging
import os
from collections.abc import AsyncIterator, Callable
from typing import Any

from fastapi import Request, Response
from fastapi.responses import JSONResponse

from cognitive_code_agent.telegram.session_bridge import get_session_id, is_allowed, reset_session

logger = logging.getLogger(__name__)
BUSY_MESSAGE = "Working on your previous message, please wait..."
RESET_MESSAGE = "Session reset. Starting fresh."


def _load_chat_action_typing() -> str:
    try:
        from telegram.constants import ChatAction

        return str(ChatAction.TYPING)
    except Exception:
        return "typing"


CHAT_ACTION_TYPING = _load_chat_action_typing()


def _truncate_response(text: str) -> str:
    if not text.strip():
        return "(no response)"
    if len(text) > 4000:
        return f"{text[:4000]}\n[...]"
    return text


def _extract_text_from_chunk(chunk: Any) -> str:
    def _extract_from_payload(payload: dict[str, Any]) -> str:
        # OpenAI/NAT-like streaming chunks:
        # {"choices":[{"delta":{"content":"..."}}]}
        # {"choices":[{"message":{"content":"..."}}]}
        choices = payload.get("choices")
        if isinstance(choices, list):
            parts: list[str] = []
            for choice in choices:
                if not isinstance(choice, dict):
                    continue

                delta = choice.get("delta")
                if isinstance(delta, dict):
                    content = delta.get("content")
                    if isinstance(content, str):
                        parts.append(content)

                message = choice.get("message")
                if isinstance(message, dict):
                    content = message.get("content")
                    if isinstance(content, str):
                        parts.append(content)

            if parts:
                return "".join(parts)

        for key in ("text", "content", "message", "response"):
            value = payload.get(key)
            if isinstance(value, str):
                return value
            if isinstance(value, list):
                parts = [item.get("text", "") for item in value if isinstance(item, dict)]
                return "".join(parts)
        return ""

    if chunk is None:
        return ""
    if isinstance(chunk, str):
        return chunk
    if hasattr(chunk, "model_dump"):
        try:
            dumped = chunk.model_dump(mode="json")
            if isinstance(dumped, dict):
                return _extract_from_payload(dumped)
        except Exception:
            return ""
    if isinstance(chunk, dict):
        return _extract_from_payload(chunk)
    return ""


async def _collect_agent_response(
    builder_stream_fn: Callable[..., Any],
    prompt: str,
    session_id: str,
) -> str:
    result = builder_stream_fn(prompt, session_id=session_id)
    if inspect.isawaitable(result):
        result = await result

    if isinstance(result, str):
        return result

    if (
        inspect.isasyncgen(result)
        or isinstance(result, AsyncIterator)
        or hasattr(result, "__aiter__")
    ):
        parts: list[str] = []
        async for chunk in result:
            text = _extract_text_from_chunk(chunk)
            if text:
                parts.append(text)
        return "".join(parts)

    if isinstance(result, list):
        return "".join(_extract_text_from_chunk(item) for item in result)

    return _extract_text_from_chunk(result)


def build_telegram_bot(token: str | None = None) -> Any:
    """Build a Telegram bot client."""
    bot_token = token or os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not bot_token:
        logger.warning("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled")
        return None

    from telegram import Bot

    return Bot(token=bot_token)


class TelegramGateway:
    """Webhook gateway handling Telegram updates."""

    def __init__(
        self,
        bot: Any,
        builder_stream_fn: Callable[..., Any] | None,
        webhook_secret: str,
    ) -> None:
        self.bot = bot
        self.builder_stream_fn = builder_stream_fn
        self.webhook_secret = webhook_secret
        self._locks: dict[int, asyncio.Lock] = {}

    async def _typing_loop(self, chat_id: int, stop_event: asyncio.Event) -> None:
        while not stop_event.is_set():
            await self.bot.send_chat_action(chat_id=chat_id, action=CHAT_ACTION_TYPING)
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=4)
            except TimeoutError:
                continue

    async def _send_message(self, chat_id: int, text: str) -> None:
        await self.bot.send_message(chat_id=chat_id, text=text, parse_mode="Markdown")

    async def handle_update(self, request: Request) -> Response:
        """Handle a Telegram update POST request."""
        if self.webhook_secret:
            secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
            if secret != self.webhook_secret:
                return JSONResponse({"error": "forbidden"}, status_code=403)

        payload = await request.json()
        message = payload.get("message")
        if not isinstance(message, dict):
            return JSONResponse({"ok": True}, status_code=200)

        chat = message.get("chat") or {}
        if chat.get("type") != "private":
            return JSONResponse({"ok": True}, status_code=200)

        chat_id = int(chat.get("id", 0))
        if not is_allowed(chat_id):
            return JSONResponse({"ok": True}, status_code=200)

        text = (message.get("text") or "").strip()
        if not text:
            return JSONResponse({"ok": True}, status_code=200)

        if text == "/reset":
            reset_session(chat_id)
            await self._send_message(chat_id, RESET_MESSAGE)
            return JSONResponse({"ok": True}, status_code=200)

        lock = self._locks.setdefault(chat_id, asyncio.Lock())
        if lock.locked():
            await self._send_message(chat_id, BUSY_MESSAGE)
            return JSONResponse({"ok": True}, status_code=200)

        async with lock:
            if self.builder_stream_fn is None:
                await self._send_message(chat_id, "(no response)")
                return JSONResponse({"ok": True}, status_code=200)

            stop_typing = asyncio.Event()
            typing_task = asyncio.create_task(self._typing_loop(chat_id, stop_typing))
            try:
                session_id = get_session_id(chat_id)
                response_text = await _collect_agent_response(
                    self.builder_stream_fn, text, session_id
                )
            finally:
                stop_typing.set()
                await typing_task

            await self._send_message(chat_id, _truncate_response(response_text))
            return JSONResponse({"ok": True}, status_code=200)

"""Unit tests for Telegram webhook gateway."""

from __future__ import annotations

import asyncio

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from cognitive_code_agent.telegram.bot import TelegramGateway

pytestmark = pytest.mark.unit


class FakeBot:
    def __init__(self) -> None:
        self.messages: list[tuple[int, str, str | None]] = []
        self.actions: list[tuple[int, str]] = []

    async def send_message(self, chat_id: int, text: str, parse_mode: str | None = None) -> None:
        self.messages.append((chat_id, text, parse_mode))

    async def send_chat_action(self, chat_id: int, action: str) -> None:
        self.actions.append((chat_id, action))


def _message_update(chat_id: int = 123, text: str = "hola", chat_type: str = "private") -> dict:
    return {
        "update_id": 1,
        "message": {
            "message_id": 10,
            "date": 1710000000,
            "text": text,
            "chat": {"id": chat_id, "type": chat_type},
        },
    }


def _make_app(fake_bot: FakeBot, gateway: TelegramGateway) -> TestClient:
    app = FastAPI()

    @app.post("/telegram/webhook")
    async def telegram_webhook(request: Request):
        return await gateway.handle_update(request)

    return TestClient(app)


def test_webhook_rejects_missing_or_wrong_secret(monkeypatch: pytest.MonkeyPatch):
    async def _stream_fn(_prompt: str, session_id: str):
        return "ok"

    fake_bot = FakeBot()
    gateway = TelegramGateway(fake_bot, _stream_fn, webhook_secret="s3cr3t")
    client = _make_app(fake_bot, gateway)
    monkeypatch.setattr("cognitive_code_agent.telegram.bot.is_allowed", lambda _chat_id: True)

    missing = client.post("/telegram/webhook", json=_message_update())
    wrong = client.post(
        "/telegram/webhook",
        headers={"X-Telegram-Bot-Api-Secret-Token": "wrong"},
        json=_message_update(),
    )
    valid = client.post(
        "/telegram/webhook",
        headers={"X-Telegram-Bot-Api-Secret-Token": "s3cr3t"},
        json=_message_update(),
    )

    assert missing.status_code == 403
    assert wrong.status_code == 403
    assert valid.status_code == 200


def test_group_chat_is_ignored(monkeypatch: pytest.MonkeyPatch):
    async def _stream_fn(_prompt: str, session_id: str):
        return "ok"

    fake_bot = FakeBot()
    gateway = TelegramGateway(fake_bot, _stream_fn, webhook_secret="s3cr3t")
    client = _make_app(fake_bot, gateway)
    monkeypatch.setattr("cognitive_code_agent.telegram.bot.is_allowed", lambda _chat_id: True)

    response = client.post(
        "/telegram/webhook",
        headers={"X-Telegram-Bot-Api-Secret-Token": "s3cr3t"},
        json=_message_update(chat_type="group"),
    )

    assert response.status_code == 200
    assert fake_bot.messages == []


def test_disallowed_chat_is_ignored(monkeypatch: pytest.MonkeyPatch):
    async def _stream_fn(_prompt: str, session_id: str):
        return "ok"

    fake_bot = FakeBot()
    gateway = TelegramGateway(fake_bot, _stream_fn, webhook_secret="s3cr3t")
    client = _make_app(fake_bot, gateway)
    monkeypatch.setattr("cognitive_code_agent.telegram.bot.is_allowed", lambda _chat_id: False)

    response = client.post(
        "/telegram/webhook",
        headers={"X-Telegram-Bot-Api-Secret-Token": "s3cr3t"},
        json=_message_update(chat_id=999),
    )

    assert response.status_code == 200
    assert fake_bot.messages == []


def test_busy_message_when_chat_lock_is_already_held(monkeypatch: pytest.MonkeyPatch):
    async def _stream_fn(_prompt: str, session_id: str):
        return "ok"

    fake_bot = FakeBot()
    gateway = TelegramGateway(fake_bot, _stream_fn, webhook_secret="s3cr3t")
    client = _make_app(fake_bot, gateway)
    monkeypatch.setattr("cognitive_code_agent.telegram.bot.is_allowed", lambda _chat_id: True)
    monkeypatch.setattr(
        "cognitive_code_agent.telegram.bot.get_session_id", lambda _chat_id: "telegram:123"
    )

    lock = gateway._locks.setdefault(123, asyncio.Lock())
    asyncio.run(lock.acquire())
    try:
        response = client.post(
            "/telegram/webhook",
            headers={"X-Telegram-Bot-Api-Secret-Token": "s3cr3t"},
            json=_message_update(chat_id=123, text="primero"),
        )
    finally:
        lock.release()

    assert response.status_code == 200
    assert fake_bot.messages[-1][1] == "Working on your previous message, please wait..."


def test_reset_command_resets_session_and_confirms(monkeypatch: pytest.MonkeyPatch):
    async def _stream_fn(_prompt: str, session_id: str):
        return "ok"

    fake_bot = FakeBot()
    gateway = TelegramGateway(fake_bot, _stream_fn, webhook_secret="s3cr3t")
    client = _make_app(fake_bot, gateway)
    monkeypatch.setattr("cognitive_code_agent.telegram.bot.is_allowed", lambda _chat_id: True)

    called = {"value": False}

    def _reset(chat_id: int) -> str:
        called["value"] = True
        return f"telegram:{chat_id}:abcd1234"

    monkeypatch.setattr("cognitive_code_agent.telegram.bot.reset_session", _reset)

    response = client.post(
        "/telegram/webhook",
        headers={"X-Telegram-Bot-Api-Secret-Token": "s3cr3t"},
        json=_message_update(chat_id=123, text="/reset"),
    )

    assert response.status_code == 200
    assert called["value"] is True
    assert fake_bot.messages[-1][1] == "Session reset. Starting fresh."


def test_long_agent_response_is_truncated(monkeypatch: pytest.MonkeyPatch):
    async def _stream_fn(_prompt: str, session_id: str):
        return "x" * 4500

    fake_bot = FakeBot()
    gateway = TelegramGateway(fake_bot, _stream_fn, webhook_secret="s3cr3t")
    client = _make_app(fake_bot, gateway)
    monkeypatch.setattr("cognitive_code_agent.telegram.bot.is_allowed", lambda _chat_id: True)
    monkeypatch.setattr(
        "cognitive_code_agent.telegram.bot.get_session_id", lambda _chat_id: "telegram:123"
    )

    response = client.post(
        "/telegram/webhook",
        headers={"X-Telegram-Bot-Api-Secret-Token": "s3cr3t"},
        json=_message_update(chat_id=123, text="dame reporte"),
    )

    assert response.status_code == 200
    sent_text = fake_bot.messages[-1][1]
    assert sent_text.endswith("\n[...]")
    assert len(sent_text) == 4006

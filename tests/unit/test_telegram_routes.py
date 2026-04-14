"""Unit tests for Telegram route registration and startup lifecycle."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from cognitive_code_agent.telegram.routes import register_telegram_routes

pytestmark = pytest.mark.unit


class FakeBuilder:
    async def stream_fn(self, prompt: str, session_id: str) -> str:
        return f"{session_id}:{prompt}"


class FakeBot:
    def __init__(self) -> None:
        self.webhooks: list[tuple[str, str]] = []

    async def set_webhook(self, url: str, secret_token: str | None = None) -> bool:
        self.webhooks.append((url, secret_token or ""))
        return True

    async def send_message(self, chat_id: int, text: str, parse_mode: str | None = None) -> None:
        return None

    async def send_chat_action(self, chat_id: int, action: str) -> None:
        return None


def test_register_telegram_routes_adds_webhook_endpoint(monkeypatch: pytest.MonkeyPatch):
    app = FastAPI()
    fake_bot = FakeBot()

    monkeypatch.setenv("TELEGRAM_WEBHOOK_SECRET", "secret")
    monkeypatch.setenv("TELEGRAM_WEBHOOK_URL", "https://example.com/telegram/webhook")
    monkeypatch.setattr("cognitive_code_agent.telegram.routes.build_telegram_bot", lambda: fake_bot)

    register_telegram_routes(app, FakeBuilder())

    with TestClient(app) as client:
        response = client.post(
            "/telegram/webhook",
            headers={"X-Telegram-Bot-Api-Secret-Token": "secret"},
            json={
                "message": {
                    "text": "hola",
                    "chat": {"id": 123, "type": "private"},
                }
            },
        )

    assert response.status_code == 200


def test_startup_registers_webhook_when_url_present(monkeypatch: pytest.MonkeyPatch):
    app = FastAPI()
    fake_bot = FakeBot()

    monkeypatch.setenv("TELEGRAM_WEBHOOK_SECRET", "secret")
    monkeypatch.setenv("TELEGRAM_WEBHOOK_URL", "https://example.com/telegram/webhook")
    monkeypatch.setattr("cognitive_code_agent.telegram.routes.build_telegram_bot", lambda: fake_bot)

    register_telegram_routes(app, FakeBuilder())

    with TestClient(app):
        pass

    assert fake_bot.webhooks == [("https://example.com/telegram/webhook", "secret")]


def test_startup_skips_webhook_registration_when_url_missing(monkeypatch: pytest.MonkeyPatch):
    app = FastAPI()
    fake_bot = FakeBot()

    monkeypatch.setenv("TELEGRAM_WEBHOOK_SECRET", "secret")
    monkeypatch.delenv("TELEGRAM_WEBHOOK_URL", raising=False)
    monkeypatch.setattr("cognitive_code_agent.telegram.routes.build_telegram_bot", lambda: fake_bot)

    register_telegram_routes(app, FakeBuilder())

    with TestClient(app):
        pass

    assert fake_bot.webhooks == []

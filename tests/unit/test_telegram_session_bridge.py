"""Unit tests for Telegram session bridge behavior."""

from __future__ import annotations

import importlib
import logging
import pytest

pytestmark = pytest.mark.unit


def _reload_bridge(monkeypatch: pytest.MonkeyPatch, allowlist: str | None):
    from cognitive_code_agent.telegram import session_bridge as bridge

    if allowlist is None:
        monkeypatch.delenv("TELEGRAM_ALLOWED_CHAT_IDS", raising=False)
    else:
        monkeypatch.setenv("TELEGRAM_ALLOWED_CHAT_IDS", allowlist)

    return importlib.reload(bridge)


def test_is_allowed_returns_true_for_allowed_chat_id(monkeypatch: pytest.MonkeyPatch):
    bridge = _reload_bridge(monkeypatch, "123,456")
    assert bridge.is_allowed(123) is True


def test_is_allowed_returns_false_for_disallowed_chat_id(monkeypatch: pytest.MonkeyPatch):
    bridge = _reload_bridge(monkeypatch, "123,456")
    assert bridge.is_allowed(999) is False


def test_is_allowed_skips_malformed_allowlist_entries(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
):
    caplog.set_level(logging.WARNING)
    bridge = _reload_bridge(monkeypatch, "123,abc,456")

    assert bridge.is_allowed(123) is True
    assert bridge.is_allowed(456) is True
    assert bridge.is_allowed(999) is False
    assert "Malformed TELEGRAM_ALLOWED_CHAT_IDS token" in caplog.text


def test_get_session_id_returns_deterministic_default(monkeypatch: pytest.MonkeyPatch):
    bridge = _reload_bridge(monkeypatch, "123")
    assert bridge.get_session_id(123) == "telegram:123"


def test_reset_session_overrides_following_get_session_id(monkeypatch: pytest.MonkeyPatch):
    bridge = _reload_bridge(monkeypatch, "123")

    before = bridge.get_session_id(123)
    after_reset = bridge.reset_session(123)
    after = bridge.get_session_id(123)

    assert before == "telegram:123"
    assert after_reset.startswith("telegram:123:")
    assert len(after_reset.split(":")) == 3
    assert after == after_reset

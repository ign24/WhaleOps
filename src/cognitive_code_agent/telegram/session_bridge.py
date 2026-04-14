"""Session and allowlist bridge for Telegram chats."""

from __future__ import annotations

import logging
import os
from uuid import uuid4

logger = logging.getLogger(__name__)


def _parse_allowlist(raw: str) -> set[int]:
    allowed: set[int] = set()
    for token in raw.split(","):
        item = token.strip()
        if not item:
            continue
        try:
            allowed.add(int(item))
        except ValueError:
            logger.warning("Malformed TELEGRAM_ALLOWED_CHAT_IDS token skipped: %r", item)
    return allowed


_ALLOWED_CHAT_IDS = _parse_allowlist(os.environ.get("TELEGRAM_ALLOWED_CHAT_IDS", ""))
_SESSION_OVERRIDES: dict[int, str] = {}


def is_allowed(chat_id: int) -> bool:
    """Return whether a Telegram chat id is allowed."""
    return chat_id in _ALLOWED_CHAT_IDS


def get_session_id(chat_id: int) -> str:
    """Return stable or overridden session id for chat."""
    return _SESSION_OVERRIDES.get(chat_id, f"telegram:{chat_id}")


def reset_session(chat_id: int) -> str:
    """Create and store a new session override for chat."""
    session_id = f"telegram:{chat_id}:{uuid4().hex[:8]}"
    _SESSION_OVERRIDES[chat_id] = session_id
    return session_id

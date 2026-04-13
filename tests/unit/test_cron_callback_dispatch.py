"""Unit tests for cron callback dispatch — wiring the stub to real workflow dispatch."""

from __future__ import annotations

import logging
from unittest.mock import AsyncMock

import pytest

pytestmark = pytest.mark.unit


class TestCronCallbackDispatch:
    """Tests for the real cron callback that dispatches to the agent workflow."""

    async def test_callback_invokes_stream_fn_with_prompt_and_session_id(self):
        """Cron callback must dispatch prompt via stream_fn with cron session id."""
        from cognitive_code_agent.register import _make_cron_dispatch_callback

        stream_fn = AsyncMock(return_value=None)

        callback = _make_cron_dispatch_callback(stream_fn)
        await callback("Generate daily report")

        stream_fn.assert_awaited_once_with("Generate daily report", session_id="cron:scheduled")

    async def test_callback_logs_error_on_stream_fn_failure(self, caplog):
        """Callback must log the error and NOT crash when stream_fn raises."""
        from cognitive_code_agent.register import _make_cron_dispatch_callback

        stream_fn = AsyncMock(side_effect=RuntimeError("LLM exploded"))

        callback = _make_cron_dispatch_callback(stream_fn)

        with caplog.at_level(logging.ERROR):
            # Must not raise
            await callback("Generate daily report")

        assert any("LLM exploded" in r.message for r in caplog.records)

    async def test_callback_warns_when_stream_fn_is_none(self, caplog):
        """Callback must log a warning and return when stream_fn is unavailable."""
        from cognitive_code_agent.register import _make_cron_dispatch_callback

        callback = _make_cron_dispatch_callback(None)

        with caplog.at_level(logging.WARNING):
            await callback("Generate daily report")

        assert any("stream_fn not captured" in r.message.lower() for r in caplog.records)

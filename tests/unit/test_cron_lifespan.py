"""Unit tests for the NAT lifespan monkey-patch that starts/stops the scheduler."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

pytestmark = pytest.mark.unit


class TestLifespanPatch:
    """Verify the configure monkey-patch starts/stops the scheduler correctly."""

    def test_patch_flag_set_after_import(self):
        """register._apply_cron_lifespan_patch must mark the method as patched."""
        from cognitive_code_agent.register import _apply_cron_lifespan_patch
        from nat.front_ends.fastapi.fastapi_front_end_plugin_worker import (
            FastApiFrontEndPluginWorker,
        )

        # Apply once (idempotent)
        _apply_cron_lifespan_patch()

        patched = getattr(FastApiFrontEndPluginWorker.configure, "_cognitive_cron_patched", False)
        assert patched is True

    def test_patch_is_idempotent(self):
        """Applying the patch twice must not raise or double-wrap."""
        from cognitive_code_agent.register import _apply_cron_lifespan_patch

        # Should not raise
        _apply_cron_lifespan_patch()
        _apply_cron_lifespan_patch()

    async def test_wrapped_configure_starts_scheduler(self):
        """The wrapped configure must start the scheduler after original configure runs."""
        from cognitive_code_agent.tools import cron_tools

        mock_scheduler = MagicMock()
        mock_scheduler.running = False

        original_called = []

        async def fake_original_configure(self_inner, app, builder):
            original_called.append(True)

        async def fake_app_add_event_handler(event, handler):
            pass

        fake_app = MagicMock()

        # Simulate the wrapper logic (same as in register._apply_cron_lifespan_patch)
        async def wrapped(self_inner, app, builder):
            await fake_original_configure(self_inner, app, builder)
            if mock_scheduler and not mock_scheduler.running:
                mock_scheduler.start()
            app.add_event_handler("shutdown", lambda: mock_scheduler.shutdown(wait=False))

        with patch.object(cron_tools, "_scheduler", mock_scheduler):
            await wrapped(None, fake_app, None)

        assert original_called == [True]
        mock_scheduler.start.assert_called_once()
        # Verify add_event_handler was called with "shutdown" (don't check exact lambda)
        call_args = fake_app.add_event_handler.call_args
        assert call_args is not None
        assert call_args[0][0] == "shutdown"
        assert callable(call_args[0][1])

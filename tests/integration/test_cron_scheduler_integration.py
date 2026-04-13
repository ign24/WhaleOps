"""Integration tests for cron_tools scheduler with real Redis.

Requires a running Redis instance. Validates that init_scheduler correctly
configures the RedisJobStore and that jobs can be added, listed, and removed.
"""

from __future__ import annotations

import asyncio
import os
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import pytest

pytestmark = pytest.mark.integration

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")


@pytest.fixture(autouse=True)
async def reset_cron_scheduler():
    """Stop and reset the scheduler singleton before and after each test."""
    from cognitive_code_agent.tools import cron_tools

    # Pre-test cleanup
    if cron_tools._scheduler and cron_tools._scheduler.running:
        cron_tools._scheduler.shutdown(wait=False)
    cron_tools._scheduler = None
    cron_tools._cron_callback = None

    yield

    # Post-test cleanup
    if cron_tools._scheduler and cron_tools._scheduler.running:
        cron_tools._scheduler.shutdown(wait=False)
    cron_tools._scheduler = None
    cron_tools._cron_callback = None


def _make_scheduler():
    from cognitive_code_agent.tools.cron_tools import init_scheduler

    async def dummy_callback(prompt: str) -> None:
        pass

    scheduler = init_scheduler(redis_url=REDIS_URL, run_callback=dummy_callback)
    scheduler.start()
    return scheduler


class TestCronSchedulerRedisIntegration:
    """Integration: init_scheduler with real Redis job store."""

    async def test_init_scheduler_creates_running_scheduler(self):
        scheduler = _make_scheduler()
        assert scheduler.running is True

    async def test_add_job_appears_in_get_jobs(self):
        from cognitive_code_agent.tools.cron_tools import _schedule_create, _schedule_list

        _make_scheduler()

        result = await _schedule_create(
            cron_expr="0 3 * * *",
            prompt="/analyze github.com/test/repo",
            description="Nightly integration test job",
        )
        assert "Scheduled job created" in result

        list_result = await _schedule_list()
        assert "Nightly integration test job" in list_result

    async def test_cancel_job_removes_from_scheduler(self):
        from cognitive_code_agent.tools.cron_tools import (
            _schedule_cancel,
            _schedule_create,
            _schedule_list,
        )

        _make_scheduler()

        create_result = await _schedule_create(
            cron_expr="0 4 * * 1",
            prompt="/analyze repo",
            description="Cancel-me job",
        )
        job_id = create_result.split("ID:")[1].split("\n")[0].strip()

        cancel_result = await _schedule_cancel(job_id=job_id)
        assert job_id in cancel_result

        list_result = await _schedule_list()
        assert "Cancel-me job" not in list_result

    async def test_scheduler_fires_and_dispatches_callback_chain(self):
        """Scheduler fire should execute _run_cron_job -> callback -> stream_fn."""
        from cognitive_code_agent.register import _make_cron_dispatch_callback
        from cognitive_code_agent.tools.cron_tools import _run_cron_job, init_scheduler

        stream_fn = AsyncMock(return_value=None)
        callback = _make_cron_dispatch_callback(stream_fn)

        scheduler = init_scheduler(redis_url=REDIS_URL, run_callback=callback)
        scheduler.start()

        scheduler.add_job(
            _run_cron_job,
            trigger="date",
            run_date=datetime.now(UTC) + timedelta(milliseconds=100),
            kwargs={"prompt": "Generate daily report", "description": "integration"},
            id="cron-dispatch-integration",
            replace_existing=True,
        )

        await asyncio.sleep(0.6)

        stream_fn.assert_awaited_once_with("Generate daily report", session_id="cron:scheduled")

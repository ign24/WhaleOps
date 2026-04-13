"""Unit tests for cron_tools — schedule_task tool and scheduler internals."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# 6.1 — _validate_prompt (safety check) and cron expression validation
# ---------------------------------------------------------------------------


class TestValidatePrompt:
    def test_valid_prompt_passes(self):
        from cognitive_code_agent.tools.cron_tools import _validate_prompt

        _validate_prompt("/analyze github.com/owner/repo")
        _validate_prompt("run weekly security scan on main")

    @pytest.mark.parametrize(
        "dangerous",
        [
            "rm -rf /tmp",
            "kill all processes",
            "sudo apt install",
            "drop table users",
            "delete everything",
            "format disk",
        ],
    )
    def test_blocked_tokens_rejected(self, dangerous: str):
        from cognitive_code_agent.tools.cron_tools import _validate_prompt

        with pytest.raises(ValueError, match="blocked"):
            _validate_prompt(dangerous)


class TestCronExpressionValidation:
    def test_valid_cron_accepted(self):
        from cognitive_code_agent.tools.cron_tools import _validate_cron

        _validate_cron("0 9 * * 1")
        _validate_cron("0 2 * * *")
        _validate_cron("*/5 * * * *")

    def test_invalid_cron_raises(self):
        from cognitive_code_agent.tools.cron_tools import _validate_cron

        with pytest.raises(ValueError, match="cron"):
            _validate_cron("not-a-cron")

    def test_too_few_fields_raises(self):
        from cognitive_code_agent.tools.cron_tools import _validate_cron

        with pytest.raises(ValueError, match="cron"):
            _validate_cron("0 9 *")


# ---------------------------------------------------------------------------
# 6.2 — schedule_task action helpers (mocked scheduler)
# ---------------------------------------------------------------------------


class TestScheduleTaskCreate:
    async def test_create_adds_job_and_returns_id(self):
        from cognitive_code_agent.tools import cron_tools

        mock_scheduler = MagicMock()
        mock_job = MagicMock()
        mock_job.id = "abc12345"
        mock_scheduler.add_job.return_value = mock_job

        with patch.object(cron_tools, "_scheduler", mock_scheduler):
            result = await cron_tools._schedule_create(
                cron_expr="0 9 * * 1",
                prompt="/analyze github.com/owner/repo",
                description="Weekly analysis",
            )

        mock_scheduler.add_job.assert_called_once()
        assert "abc12345" in result

    async def test_create_invalid_cron_returns_error(self):
        from cognitive_code_agent.tools import cron_tools

        mock_scheduler = MagicMock()
        with patch.object(cron_tools, "_scheduler", mock_scheduler):
            result = await cron_tools._schedule_create(
                cron_expr="bad-cron",
                prompt="/analyze repo",
                description="test",
            )

        mock_scheduler.add_job.assert_not_called()
        assert "error" in result.lower() or "invalid" in result.lower()

    async def test_create_blocked_prompt_returns_error(self):
        from cognitive_code_agent.tools import cron_tools

        mock_scheduler = MagicMock()
        with patch.object(cron_tools, "_scheduler", mock_scheduler):
            result = await cron_tools._schedule_create(
                cron_expr="0 9 * * 1",
                prompt="rm -rf everything",
                description="dangerous",
            )

        mock_scheduler.add_job.assert_not_called()
        assert "blocked" in result.lower() or "error" in result.lower()


class TestScheduleTaskList:
    async def test_list_returns_job_details(self):
        from cognitive_code_agent.tools import cron_tools

        mock_job = MagicMock()
        mock_job.id = "job1"
        mock_job.kwargs = {"description": "Weekly scan", "cron_expr": "0 9 * * 1"}
        mock_job.next_run_time = None
        mock_job.trigger = MagicMock()
        mock_job.trigger.__str__ = lambda self: "cron[hour='9', day_of_week='mon']"

        mock_scheduler = MagicMock()
        mock_scheduler.get_jobs.return_value = [mock_job]

        with patch.object(cron_tools, "_scheduler", mock_scheduler):
            result = await cron_tools._schedule_list()

        mock_scheduler.get_jobs.assert_called_once()
        assert "job1" in result

    async def test_list_empty_returns_message(self):
        from cognitive_code_agent.tools import cron_tools

        mock_scheduler = MagicMock()
        mock_scheduler.get_jobs.return_value = []

        with patch.object(cron_tools, "_scheduler", mock_scheduler):
            result = await cron_tools._schedule_list()

        assert "no" in result.lower() or "empty" in result.lower()


class TestScheduleTaskCancel:
    async def test_cancel_existing_job(self):
        from cognitive_code_agent.tools import cron_tools

        mock_scheduler = MagicMock()

        with patch.object(cron_tools, "_scheduler", mock_scheduler):
            result = await cron_tools._schedule_cancel(job_id="abc12345")

        mock_scheduler.remove_job.assert_called_once_with("abc12345")
        assert "abc12345" in result

    async def test_cancel_nonexistent_job_returns_error(self):
        from apscheduler.jobstores.base import JobLookupError

        from cognitive_code_agent.tools import cron_tools

        mock_scheduler = MagicMock()
        mock_scheduler.remove_job.side_effect = JobLookupError("notfound")

        with patch.object(cron_tools, "_scheduler", mock_scheduler):
            result = await cron_tools._schedule_cancel(job_id="notfound")

        assert "not found" in result.lower() or "error" in result.lower()


# ---------------------------------------------------------------------------
# 6.3 — _run_cron_job calls _cron_callback
# ---------------------------------------------------------------------------


class TestRunCronJob:
    async def test_run_cron_job_calls_callback(self):
        from cognitive_code_agent.tools import cron_tools

        called_with: list[str] = []

        async def fake_callback(prompt: str) -> None:
            called_with.append(prompt)

        original = cron_tools._cron_callback
        try:
            cron_tools._cron_callback = fake_callback
            await cron_tools._run_cron_job(prompt="/analyze repo")
        finally:
            cron_tools._cron_callback = original

        assert called_with == ["/analyze repo"]

    async def test_run_cron_job_no_callback_does_not_raise(self):
        from cognitive_code_agent.tools import cron_tools

        original = cron_tools._cron_callback
        try:
            cron_tools._cron_callback = None
            await cron_tools._run_cron_job(prompt="/analyze repo")
        finally:
            cron_tools._cron_callback = original

"""Unit tests for jobs_api — cron job REST endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from cognitive_code_agent.jobs_api import register_jobs_routes

pytestmark = pytest.mark.unit


def _make_app() -> tuple[FastAPI, TestClient]:
    app = FastAPI()
    register_jobs_routes(app)
    return app, TestClient(app)


def _mock_job(
    job_id: str = "abc123",
    description: str = "Daily scan",
    cron_expr: str = "0 9 * * *",
    next_run: datetime | None = None,
) -> MagicMock:
    job = MagicMock()
    job.id = job_id
    job.kwargs = {"description": description, "cron_expr": cron_expr}
    job.next_run_time = next_run or datetime(2026, 4, 14, 9, 0, 0, tzinfo=timezone.utc)
    job.trigger = MagicMock()
    return job


# ---------------------------------------------------------------------------
# GET /api/jobs/cron
# ---------------------------------------------------------------------------


class TestListCronJobs:
    def test_returns_job_list_when_jobs_exist(self):
        _, client = _make_app()
        job = _mock_job()

        mock_scheduler = MagicMock()
        mock_scheduler.get_jobs.return_value = [job]

        with patch("cognitive_code_agent.tools.cron_tools._scheduler", mock_scheduler):
            response = client.get("/api/jobs/cron")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == "abc123"
        assert data[0]["description"] == "Daily scan"
        assert data[0]["cron_expr"] == "0 9 * * *"
        assert data[0]["next_run"] is not None
        assert data[0]["status"] == "active"

    def test_returns_empty_list_when_no_jobs(self):
        _, client = _make_app()
        mock_scheduler = MagicMock()
        mock_scheduler.get_jobs.return_value = []

        with patch("cognitive_code_agent.tools.cron_tools._scheduler", mock_scheduler):
            response = client.get("/api/jobs/cron")

        assert response.status_code == 200
        assert response.json() == []

    def test_returns_503_when_scheduler_not_initialized(self):
        _, client = _make_app()

        with patch("cognitive_code_agent.tools.cron_tools._scheduler", None):
            response = client.get("/api/jobs/cron")

        assert response.status_code == 503
        assert "scheduler" in response.json()["error"].lower()

    def test_paused_job_has_paused_status(self):
        _, client = _make_app()
        job = _mock_job(next_run=None)
        job.next_run_time = None

        mock_scheduler = MagicMock()
        mock_scheduler.get_jobs.return_value = [job]

        with patch("cognitive_code_agent.tools.cron_tools._scheduler", mock_scheduler):
            response = client.get("/api/jobs/cron")

        assert response.status_code == 200
        assert response.json()[0]["status"] == "paused"
        assert response.json()[0]["next_run"] is None

    def test_multiple_jobs_all_returned(self):
        _, client = _make_app()
        jobs = [
            _mock_job("id1", "Scan", "0 9 * * *"),
            _mock_job("id2", "Report", "0 8 * * 1"),
        ]
        mock_scheduler = MagicMock()
        mock_scheduler.get_jobs.return_value = jobs

        with patch("cognitive_code_agent.tools.cron_tools._scheduler", mock_scheduler):
            response = client.get("/api/jobs/cron")

        assert response.status_code == 200
        assert len(response.json()) == 2
        ids = {item["id"] for item in response.json()}
        assert ids == {"id1", "id2"}


# ---------------------------------------------------------------------------
# POST /api/jobs/cron
# ---------------------------------------------------------------------------


class TestCreateCronJob:
    def test_valid_job_creation_returns_201(self):
        _, client = _make_app()
        created_job = _mock_job("new-id", "Weekly report", "0 8 * * 1")
        mock_scheduler = MagicMock()
        mock_scheduler.get_jobs.return_value = [created_job]

        with patch("cognitive_code_agent.tools.cron_tools._scheduler", mock_scheduler), \
             patch("cognitive_code_agent.tools.cron_tools._schedule_create", return_value="Scheduled job created.\n  ID: new-id"):
            response = client.post("/api/jobs/cron", json={
                "cron_expr": "0 8 * * 1",
                "prompt": "Generate weekly report",
                "description": "Weekly report",
            })

        assert response.status_code == 201
        data = response.json()
        assert data["id"] == "new-id"
        assert data["cron_expr"] == "0 8 * * 1"

    def test_invalid_cron_returns_422(self):
        _, client = _make_app()
        mock_scheduler = MagicMock()

        with patch("cognitive_code_agent.tools.cron_tools._scheduler", mock_scheduler):
            response = client.post("/api/jobs/cron", json={
                "cron_expr": "not-a-cron",
                "prompt": "do something",
                "description": "test",
            })

        assert response.status_code == 422
        assert "error" in response.json()

    def test_dangerous_prompt_returns_422(self):
        _, client = _make_app()
        mock_scheduler = MagicMock()

        with patch("cognitive_code_agent.tools.cron_tools._scheduler", mock_scheduler):
            response = client.post("/api/jobs/cron", json={
                "cron_expr": "0 9 * * *",
                "prompt": "rm -rf /tmp/analysis",
                "description": "cleanup",
            })

        assert response.status_code == 422
        assert "error" in response.json()

    def test_missing_fields_returns_422(self):
        _, client = _make_app()
        mock_scheduler = MagicMock()

        with patch("cognitive_code_agent.tools.cron_tools._scheduler", mock_scheduler):
            response = client.post("/api/jobs/cron", json={"cron_expr": "0 9 * * *"})

        assert response.status_code == 422

    def test_empty_fields_returns_422(self):
        _, client = _make_app()
        mock_scheduler = MagicMock()

        with patch("cognitive_code_agent.tools.cron_tools._scheduler", mock_scheduler):
            response = client.post("/api/jobs/cron", json={
                "cron_expr": "",
                "prompt": "do something",
                "description": "test",
            })

        assert response.status_code == 422

    def test_503_when_scheduler_not_initialized(self):
        _, client = _make_app()

        with patch("cognitive_code_agent.tools.cron_tools._scheduler", None):
            response = client.post("/api/jobs/cron", json={
                "cron_expr": "0 9 * * *",
                "prompt": "scan",
                "description": "test",
            })

        assert response.status_code == 503


# ---------------------------------------------------------------------------
# DELETE /api/jobs/cron/{job_id}
# ---------------------------------------------------------------------------


class TestCancelCronJob:
    def test_cancel_existing_job_returns_200(self):
        _, client = _make_app()
        mock_scheduler = MagicMock()

        with patch("cognitive_code_agent.tools.cron_tools._scheduler", mock_scheduler), \
             patch("cognitive_code_agent.tools.cron_tools._schedule_cancel", return_value="Scheduled job 'abc123' cancelled."):
            response = client.delete("/api/jobs/cron/abc123")

        assert response.status_code == 200
        assert response.json() == {"cancelled": True, "id": "abc123"}

    def test_cancel_nonexistent_job_returns_404(self):
        _, client = _make_app()
        mock_scheduler = MagicMock()

        with patch("cognitive_code_agent.tools.cron_tools._scheduler", mock_scheduler), \
             patch("cognitive_code_agent.tools.cron_tools._schedule_cancel", return_value="Error: job 'ghost' not found."):
            response = client.delete("/api/jobs/cron/ghost")

        assert response.status_code == 404
        assert "not found" in response.json()["error"]

    def test_503_when_scheduler_not_initialized(self):
        _, client = _make_app()

        with patch("cognitive_code_agent.tools.cron_tools._scheduler", None):
            response = client.delete("/api/jobs/cron/abc123")

        assert response.status_code == 503

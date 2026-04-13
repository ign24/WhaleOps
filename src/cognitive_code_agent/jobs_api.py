"""Jobs REST API — exposes APScheduler cron job state to the frontend.

Routes are registered via register_jobs_routes(app) called from register.py.
Auth is handled at the Next.js BFF layer; these routes are internal.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException
from fastapi.requests import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class CronJobItem(BaseModel):
    id: str
    description: str
    cron_expr: str
    next_run: str | None
    status: str


class CreateJobRequest(BaseModel):
    cron_expr: str
    prompt: str
    description: str


def register_jobs_routes(app: Any) -> None:
    if getattr(app.state, "cognitive_jobs_routes_registered", False):
        return

    @app.get("/api/jobs/cron")
    async def list_cron_jobs() -> JSONResponse:
        from cognitive_code_agent.tools import cron_tools  # noqa: PLC0415

        if cron_tools._scheduler is None:
            return JSONResponse({"error": "scheduler not initialized"}, status_code=503)

        jobs = cron_tools._scheduler.get_jobs()
        items = []
        for job in jobs:
            kwargs = job.kwargs or {}
            next_run = job.next_run_time
            items.append(
                CronJobItem(
                    id=job.id,
                    description=kwargs.get("description", ""),
                    cron_expr=kwargs.get("cron_expr", str(job.trigger)),
                    next_run=next_run.isoformat() if next_run else None,
                    status="paused" if job.next_run_time is None else "active",
                ).model_dump()
            )
        return JSONResponse(items)

    @app.post("/api/jobs/cron")
    async def create_cron_job(request: Request) -> JSONResponse:
        from cognitive_code_agent.tools import cron_tools  # noqa: PLC0415

        if cron_tools._scheduler is None:
            return JSONResponse({"error": "scheduler not initialized"}, status_code=503)

        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=422, detail="Invalid JSON body")

        cron_expr = (body.get("cron_expr") or "").strip()
        prompt = (body.get("prompt") or "").strip()
        description = (body.get("description") or "").strip()

        if not cron_expr or not prompt or not description:
            return JSONResponse({"error": "cron_expr, prompt, and description are required"}, status_code=422)

        try:
            cron_tools._validate_cron(cron_expr)
        except ValueError as exc:
            return JSONResponse({"error": str(exc)}, status_code=422)

        try:
            cron_tools._validate_prompt(prompt)
        except ValueError as exc:
            return JSONResponse({"error": str(exc)}, status_code=422)

        result = await cron_tools._schedule_create(cron_expr, prompt, description)
        if result.startswith("Error:"):
            return JSONResponse({"error": result[7:].strip()}, status_code=422)

        # Re-fetch the newly created job to return structured data
        jobs = cron_tools._scheduler.get_jobs()
        # The newest job is the last one added
        new_job = jobs[-1] if jobs else None
        if new_job is None:
            return JSONResponse({"error": "job created but could not be retrieved"}, status_code=500)

        next_run = new_job.next_run_time
        return JSONResponse(
            CronJobItem(
                id=new_job.id,
                description=description,
                cron_expr=cron_expr,
                next_run=next_run.isoformat() if next_run else None,
                status="active" if next_run else "paused",
            ).model_dump(),
            status_code=201,
        )

    @app.delete("/api/jobs/cron/{job_id}")
    async def cancel_cron_job(job_id: str) -> JSONResponse:
        from cognitive_code_agent.tools import cron_tools  # noqa: PLC0415

        if cron_tools._scheduler is None:
            return JSONResponse({"error": "scheduler not initialized"}, status_code=503)

        result = await cron_tools._schedule_cancel(job_id)
        if result.startswith("Error: job"):
            return JSONResponse({"error": "job not found"}, status_code=404)
        if result.startswith("Error:"):
            return JSONResponse({"error": result[7:].strip()}, status_code=500)

        return JSONResponse({"cancelled": True, "id": job_id})

    app.state.cognitive_jobs_routes_registered = True

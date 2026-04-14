"""Cron scheduler tool — agent-callable recurring task management.

Architecture:
- APScheduler AsyncIOScheduler with RedisJobStore for persistence.
- Module-level _cron_callback singleton (required for APScheduler pickle compat).
- _run_cron_job must remain a module-level coroutine (not a closure).
- Scheduler lifecycle is managed via register.py lifespan monkey-patch.

Important NAT compatibility note:
- Do NOT add ``from __future__ import annotations`` to this module.
  NAT's FunctionInfo introspection reads inspect.signature annotations and
  fails on Python 3.11 when annotations are deferred strings (TypeError:
  issubclass() arg 1 must be a class).
"""

import logging
from typing import Any, Callable, Coroutine

from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.jobstores.redis import RedisJobStore
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from pydantic import Field

from nat.builder.builder import Builder
from nat.builder.function_info import FunctionInfo
from nat.cli.register_workflow import register_function
from nat.data_models.function import FunctionBaseConfig

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level singleton — required for APScheduler pickle compatibility.
# APScheduler serializes job functions to Redis; closures are not pickleable.
# The callback is injected by init_scheduler() via this module-level reference.
# ---------------------------------------------------------------------------
_cron_callback: Callable[[str], Coroutine[Any, Any, None]] | None = None
_scheduler: AsyncIOScheduler | None = None

# ---------------------------------------------------------------------------
# Safety
# ---------------------------------------------------------------------------
BLOCKED_TOKENS: tuple[str, ...] = (
    "rm ",
    "kill ",
    "sudo ",
    "drop ",
    "delete ",
    "format ",
)


def _validate_prompt(prompt: str) -> None:
    """Raise ValueError if prompt contains shell-destructive tokens."""
    lower = prompt.lower()
    for token in BLOCKED_TOKENS:
        if token in lower:
            raise ValueError(
                f"Prompt contains blocked token {token!r} — scheduling rejected for safety."
            )


def _validate_cron(cron_expr: str) -> None:
    """Raise ValueError if cron_expr is not a valid 5-field cron expression."""
    try:
        CronTrigger.from_crontab(cron_expr)
    except (ValueError, KeyError) as exc:
        raise ValueError(f"Invalid cron expression {cron_expr!r}: {exc}") from exc


# ---------------------------------------------------------------------------
# Module-level job function — must NOT be a closure for APScheduler pickling.
# ---------------------------------------------------------------------------
async def _run_cron_job(prompt: str, **_meta: object) -> None:
    """Entry point called by APScheduler when a scheduled job fires.

    Only ``prompt`` is forwarded to the callback. ``_meta`` absorbs extra kwargs
    (description, cron_expr) that are stored for observability but not acted on.
    """
    if _cron_callback is None:
        logger.warning("cron_tools: _run_cron_job fired but _cron_callback is None")
        return
    await _cron_callback(prompt)


# ---------------------------------------------------------------------------
# Scheduler init — called from register.py lifespan patch
# ---------------------------------------------------------------------------
def init_scheduler(
    redis_url: str, run_callback: Callable[[str], Coroutine[Any, Any, None]]
) -> AsyncIOScheduler:
    """Create and configure the AsyncIOScheduler with Redis persistence.

    Args:
        redis_url: Redis connection URL (e.g. "redis://localhost:6379/0").
        run_callback: Async callable that receives a prompt string and dispatches
                      it to the agent workflow. Set as the module-level singleton.

    Returns:
        Configured (but not yet started) AsyncIOScheduler.
    """
    global _cron_callback, _scheduler

    _cron_callback = run_callback

    _scheduler = AsyncIOScheduler(
        jobstores={
            "default": RedisJobStore(
                jobs_key="ops:apscheduler:jobs",
                run_times_key="ops:apscheduler:run_times",
                **_redis_kwargs(redis_url),
            ),
            "volatile": MemoryJobStore(),
        },
        job_defaults={"misfire_grace_time": 60},
    )
    return _scheduler


def _redis_kwargs(redis_url: str) -> dict[str, Any]:
    """Parse redis_url into kwargs for RedisJobStore."""
    # RedisJobStore accepts host/port/db directly; use redis-py to parse URL.
    import redis as redis_lib

    parsed = redis_lib.Redis.from_url(redis_url)
    conn_kwargs = parsed.connection_pool.connection_kwargs
    result: dict[str, Any] = {}
    if "host" in conn_kwargs:
        result["host"] = conn_kwargs["host"]
    if "port" in conn_kwargs:
        result["port"] = conn_kwargs["port"]
    if "db" in conn_kwargs:
        result["db"] = conn_kwargs["db"]
    if "password" in conn_kwargs and conn_kwargs["password"]:
        result["password"] = conn_kwargs["password"]
    return result


# ---------------------------------------------------------------------------
# Action helpers — called by the NAT tool function
# ---------------------------------------------------------------------------
async def _schedule_create(cron_expr: str, prompt: str, description: str) -> str:
    """Validate and create a new scheduled job. Returns confirmation with job_id."""
    try:
        _validate_cron(cron_expr)
    except ValueError as exc:
        return f"Error: {exc}"

    try:
        _validate_prompt(prompt)
    except ValueError as exc:
        return f"Error: {exc}"

    if _scheduler is None:
        return "Error: scheduler is not initialized."

    trigger = CronTrigger.from_crontab(cron_expr)
    job = _scheduler.add_job(
        _run_cron_job,
        trigger,
        kwargs={"prompt": prompt, "description": description, "cron_expr": cron_expr},
        misfire_grace_time=60,
    )
    next_run = job.next_run_time
    return (
        f"Scheduled job created.\n"
        f"  ID:          {job.id}\n"
        f"  Description: {description}\n"
        f"  Cron:        {cron_expr}\n"
        f"  Next run:    {next_run}"
    )


async def _schedule_list() -> str:
    """Return a formatted list of all active scheduled jobs."""
    if _scheduler is None:
        return "Error: scheduler is not initialized."

    jobs = _scheduler.get_jobs()
    if not jobs:
        return "No active scheduled tasks."

    lines = ["Active scheduled tasks:", ""]
    for job in jobs:
        kwargs = job.kwargs or {}
        desc = kwargs.get("description", "(no description)")
        cron = kwargs.get("cron_expr", str(job.trigger))
        next_run = job.next_run_time or "paused"
        lines.append(f"  ID:          {job.id}")
        lines.append(f"  Description: {desc}")
        lines.append(f"  Cron:        {cron}")
        lines.append(f"  Next run:    {next_run}")
        lines.append("")
    return "\n".join(lines).rstrip()


async def _schedule_cancel(job_id: str) -> str:
    """Remove a scheduled job by ID."""
    from apscheduler.jobstores.base import JobLookupError

    if _scheduler is None:
        return "Error: scheduler is not initialized."

    try:
        _scheduler.remove_job(job_id)
        return f"Scheduled job {job_id!r} cancelled."
    except JobLookupError:
        return f"Error: job {job_id!r} not found."


# ---------------------------------------------------------------------------
# NAT tool registration
# ---------------------------------------------------------------------------
class ScheduleTaskConfig(FunctionBaseConfig, name="schedule_task"):
    description: str = Field(
        default=(
            "Manage recurring scheduled agent tasks. "
            "Use action='create' with a 5-field cron expression (e.g. '0 9 * * 1' for every Monday at 9am) "
            "and a prompt (the message the agent will receive when the job fires). "
            "Use action='list' to see all active schedules. "
            "Use action='cancel' with job_id to remove a schedule. "
            "Schedules persist across server restarts."
        )
    )


@register_function(config_type=ScheduleTaskConfig)
async def schedule_task_tool(config: ScheduleTaskConfig, builder: Builder):
    async def _run(
        action: str,
        cron_expr: str = "",
        prompt: str = "",
        description: str = "",
        job_id: str = "",
    ) -> str:
        """Manage recurring scheduled agent tasks.

        Args:
            action: One of 'create', 'list', or 'cancel'.
            cron_expr: 5-field cron expression (required for create).
                       Examples: '0 9 * * 1' (Mon 9am), '0 2 * * *' (daily 2am).
            prompt: The message sent to the agent when the job fires (required for create).
            description: Human-readable label for this schedule (required for create).
            job_id: Job ID to cancel (required for cancel).

        Returns:
            Confirmation message with job details, list of schedules, or error.
        """
        action = action.strip().lower()

        if action == "create":
            if not cron_expr:
                return "Error: 'cron_expr' is required for action='create'."
            if not prompt:
                return "Error: 'prompt' is required for action='create'."
            if not description:
                return "Error: 'description' is required for action='create'."
            return await _schedule_create(cron_expr, prompt, description)

        if action == "list":
            return await _schedule_list()

        if action == "cancel":
            if not job_id:
                return "Error: 'job_id' is required for action='cancel'."
            return await _schedule_cancel(job_id)

        return f"Error: unknown action {action!r}. Use 'create', 'list', or 'cancel'."

    yield FunctionInfo.from_fn(_run, description=config.description)

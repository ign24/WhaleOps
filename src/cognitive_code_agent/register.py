"""NAT plugin entry point for tool registration."""

from __future__ import annotations

import logging
import os
from collections.abc import Awaitable, Callable
from typing import Any


logger = logging.getLogger(__name__)


def _make_cron_dispatch_callback(
    stream_fn: Callable[..., Awaitable[Any]] | None,
) -> Callable[[str], Awaitable[None]]:
    """Create a cron callback that dispatches prompts through builder stream_fn.

    Args:
        stream_fn: Builder stream function to dispatch through.
                   If None, the callback will log a warning and return.

    Returns:
        Async callable suitable for ``cron_tools.init_scheduler(run_callback=...)``.
    """

    async def _dispatch(prompt: str) -> None:
        if stream_fn is None:
            logger.warning("cron_tools: stream_fn not captured — skipping cron dispatch")
            return

        logger.info("cron_tools: dispatching scheduled job — prompt=%r", prompt[:80])

        try:
            await stream_fn(prompt, session_id="cron:scheduled")
        except Exception as exc:
            logger.error(
                "cron_tools: scheduled job failed — prompt=%r error=%s",
                prompt[:80],
                exc,
                exc_info=True,
            )

    return _dispatch


def _apply_mcp_enum_value_patch() -> None:
    """Ensure MCP-generated Pydantic models serialize enum values as strings.

    NAT builds tool input schemas from MCP JSON schemas. Enum fields become Python
    Enum types, and downstream conversion may pass Enum instances back into
    validation paths that expect literal strings. Enabling `use_enum_values` on
    each generated model keeps arguments JSON-compatible (`"open"`, `"desc"`, etc.)
    and prevents avoidable validation retries.
    """

    try:
        from pydantic import ConfigDict
        from nat.plugins.mcp import utils as mcp_utils
    except Exception:
        return

    if getattr(mcp_utils, "_cognitive_enum_patch_applied", False):
        return

    original_model_from_mcp_schema = mcp_utils.model_from_mcp_schema

    def _patched_model_from_mcp_schema(name: str, mcp_input_schema: dict):
        model = original_model_from_mcp_schema(name, mcp_input_schema)
        try:
            config = dict(getattr(model, "model_config", {}) or {})
            if not config.get("use_enum_values"):
                config["use_enum_values"] = True
                model.model_config = ConfigDict(**config)
                model.model_rebuild(force=True)
        except Exception as exc:
            logger.warning("Could not set use_enum_values for MCP model %s: %s", name, exc)
        return model

    mcp_utils.model_from_mcp_schema = _patched_model_from_mcp_schema
    setattr(mcp_utils, "_cognitive_enum_patch_applied", True)


_apply_mcp_enum_value_patch()


def _apply_nim_timeout_patch(total_seconds: int = 900) -> None:
    """Extend aiohttp client timeout for NIM LLM calls.

    The ``langchain_nvidia_ai_endpoints`` package creates ``aiohttp.ClientSession``
    without an explicit ``ClientTimeout``, inheriting aiohttp's default (~300 s).
    Long NIM responses (heavy tool-calling chains, large code generation) can exceed
    this and raise ``asyncio.TimeoutError``, killing the workflow mid-response.

    This patch wraps ``_NVIDIAClient._create_async_session`` to inject a generous
    ``ClientTimeout`` so that the HTTP layer never cuts off a response prematurely.
    The agent's own ``tool_call_timeout_seconds`` and ``max_iterations`` remain the
    authoritative budget controls.
    """
    try:
        import aiohttp

        from langchain_nvidia_ai_endpoints._common import _NVIDIAClient
    except Exception:
        return

    if getattr(_NVIDIAClient, "_cognitive_timeout_patch_applied", False):
        return

    original_create = _NVIDIAClient._create_async_session

    def _patched_create_async_session(self) -> "aiohttp.ClientSession":
        session = original_create(self)
        session._timeout = aiohttp.ClientTimeout(total=total_seconds)
        return session

    _NVIDIAClient._create_async_session = _patched_create_async_session
    _NVIDIAClient._cognitive_timeout_patch_applied = True
    logger.info("Applied NIM aiohttp timeout patch: %ds", total_seconds)


_apply_nim_timeout_patch()


def _apply_cron_lifespan_patch() -> None:
    """Inject scheduler start/stop into NAT's FastAPI configure lifecycle.

    NAT's FastApiFrontEndPluginWorker.configure() runs inside the FastAPI
    lifespan context manager just before the server begins accepting requests.
    Wrapping it here ensures APScheduler starts after all routes are registered
    and stops cleanly when the server shuts down.

    The patch is idempotent — applying it twice is a no-op.
    """
    try:
        from nat.front_ends.fastapi.fastapi_front_end_plugin_worker import (
            FastApiFrontEndPluginWorker,
        )
    except Exception:
        return

    if getattr(FastApiFrontEndPluginWorker.configure, "_cognitive_cron_patched", False):
        return

    original_configure = FastApiFrontEndPluginWorker.configure

    async def _patched_configure(self, app, builder):
        await original_configure(self, app, builder)

        from cognitive_code_agent.tools import cron_tools

        if cron_tools._scheduler is None:
            redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

            stream_fn = getattr(builder, "stream_fn", None)
            if not callable(stream_fn):
                logger.warning(
                    "cron_tools: builder.stream_fn unavailable — cron jobs will be log-only"
                )
                stream_fn = None

            cron_callback = _make_cron_dispatch_callback(stream_fn)
            cron_tools.init_scheduler(redis_url=redis_url, run_callback=cron_callback)

        scheduler = cron_tools._scheduler
        if scheduler and not scheduler.running:
            scheduler.start()
            logger.info("cron_tools: APScheduler started (Redis job store)")

        from cognitive_code_agent.workspace_api import register_workspace_routes
        from cognitive_code_agent.jobs_api import register_jobs_routes

        register_workspace_routes(app)
        register_jobs_routes(app)

        app.add_event_handler(
            "shutdown",
            lambda: scheduler.shutdown(wait=False) if scheduler and scheduler.running else None,
        )
        logger.info("cron_tools: shutdown handler registered")

    _patched_configure._cognitive_cron_patched = True
    FastApiFrontEndPluginWorker.configure = _patched_configure
    logger.info("Applied cron lifespan patch to FastApiFrontEndPluginWorker.configure")


_apply_cron_lifespan_patch()


from cognitive_code_agent.agents import safe_tool_calling_agent  # noqa: E402
from cognitive_code_agent.eval import register as agent_judge_evaluator  # noqa: E402
from cognitive_code_agent.tools import clone_tools  # noqa: E402
from cognitive_code_agent.tools import code_review_tools  # noqa: E402
from cognitive_code_agent.tools import docs_tools  # noqa: E402
from cognitive_code_agent.tools import findings_store  # noqa: E402
from cognitive_code_agent.tools import qa_tools  # noqa: E402
from cognitive_code_agent.tools import report_tools  # noqa: E402
from cognitive_code_agent.tools import refactor_gen  # noqa: E402
from cognitive_code_agent.tools import security_tools  # noqa: E402
from cognitive_code_agent.tools import shell_tools  # noqa: E402
from cognitive_code_agent.tools import cron_tools  # noqa: E402
from cognitive_code_agent.tools import spawn_agent  # noqa: E402
from cognitive_code_agent import workspace_api  # noqa: E402

__all__ = [
    "safe_tool_calling_agent",
    "agent_judge_evaluator",
    "clone_tools",
    "cron_tools",
    "qa_tools",
    "report_tools",
    "refactor_gen",
    "code_review_tools",
    "security_tools",
    "docs_tools",
    "shell_tools",
    "spawn_agent",
    "findings_store",
    "workspace_api",
]

"""NAT plugin entry point — ops-agent tool registration."""

import logging
import os
from collections.abc import Awaitable, Callable
from typing import Any

logger = logging.getLogger(__name__)


def _make_cron_dispatch_callback(
    stream_fn: Callable[..., Awaitable[Any]] | None,
) -> Callable[[str], Awaitable[None]]:
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


def _apply_nim_timeout_patch(total_seconds: int = 900) -> None:
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


def _apply_cron_lifespan_patch() -> None:
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
            redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/1")
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

        from cognitive_code_agent.jobs_api import register_jobs_routes

        register_jobs_routes(app)

        from cognitive_code_agent.ops_api import register_ops_routes

        register_ops_routes(app)

        app.add_event_handler(
            "shutdown",
            lambda: scheduler.shutdown(wait=False) if scheduler and scheduler.running else None,
        )
        logger.info("cron_tools: shutdown handler registered")

    _patched_configure._cognitive_cron_patched = True
    FastApiFrontEndPluginWorker.configure = _patched_configure
    logger.info("Applied cron lifespan patch to FastApiFrontEndPluginWorker.configure")


def _apply_telegram_patch() -> None:
    try:
        from nat.front_ends.fastapi.fastapi_front_end_plugin_worker import (
            FastApiFrontEndPluginWorker,
        )
    except Exception:
        return

    if getattr(FastApiFrontEndPluginWorker.configure, "_cognitive_telegram_patched", False):
        return

    original_configure = FastApiFrontEndPluginWorker.configure

    async def _patched_configure(self, app, builder):
        await original_configure(self, app, builder)

        from cognitive_code_agent.telegram.routes import register_telegram_routes

        register_telegram_routes(app, builder)

    _patched_configure._cognitive_telegram_patched = True
    FastApiFrontEndPluginWorker.configure = _patched_configure
    logger.info("Applied Telegram route patch to FastApiFrontEndPluginWorker.configure")


_apply_mcp_enum_value_patch()
_apply_nim_timeout_patch()
_apply_cron_lifespan_patch()
_apply_telegram_patch()

# ---------------------------------------------------------------------------
# Ops-agent tool registration — imports trigger @register_function decorators.
# Each import is isolated so a failure in one module doesn't abort the rest.
# ---------------------------------------------------------------------------
from cognitive_code_agent.tools import cron_tools  # noqa: E402
from cognitive_code_agent.tools import ops_tools  # noqa: E402
from cognitive_code_agent.tools import sqlite_tools  # noqa: E402
from cognitive_code_agent import telegram  # noqa: E402

try:
    from cognitive_code_agent.tools import qa_tools  # noqa: F401
except Exception as _e:
    logger.warning("qa_tools failed to load: %s", _e)
    qa_tools = None

try:
    from cognitive_code_agent.tools import clone_tools  # noqa: F401
except Exception as _e:
    logger.warning("clone_tools failed to load: %s", _e)
    clone_tools = None

try:
    from cognitive_code_agent.tools import code_review_tools  # noqa: F401
except Exception as _e:
    logger.warning("code_review_tools failed to load: %s", _e)
    code_review_tools = None

try:
    from cognitive_code_agent.tools import security_tools  # noqa: F401
except Exception as _e:
    logger.warning("security_tools failed to load: %s", _e)
    security_tools = None

try:
    from cognitive_code_agent.tools import docs_tools  # noqa: F401
except Exception as _e:
    logger.warning("docs_tools failed to load: %s", _e)
    docs_tools = None

try:
    from cognitive_code_agent.tools import shell_tools  # noqa: F401
except Exception as _e:
    logger.warning("shell_tools failed to load: %s", _e)
    shell_tools = None

try:
    from cognitive_code_agent.tools import spawn_agent  # noqa: F401
except Exception as _e:
    logger.warning("spawn_agent failed to load: %s", _e)
    spawn_agent = None

try:
    from cognitive_code_agent.tools import findings_store  # noqa: F401

    _findings_store_loaded = True
except Exception as _e:
    logger.warning("findings_store failed to load — query_findings unavailable: %s", _e)
    _findings_store_loaded = False

__all__ = [
    "cron_tools",
    "ops_tools",
    "sqlite_tools",
    "telegram",
    "qa_tools",
    "clone_tools",
    "code_review_tools",
    "security_tools",
    "docs_tools",
    "shell_tools",
    "spawn_agent",
]

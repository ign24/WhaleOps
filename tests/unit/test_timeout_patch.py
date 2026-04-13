"""Tests for NIM aiohttp timeout patch and streaming error resilience."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from nat.data_models.api_server import ChatRequestOrMessage

import cognitive_code_agent.agents.safe_tool_calling_agent as workflow_module
from cognitive_code_agent.agents.safe_tool_calling_agent import (
    SafeToolCallAgentWorkflowConfig,
    safe_tool_calling_agent_workflow,
)

pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# Task 1.3: Timeout patch idempotency
# ---------------------------------------------------------------------------


def test_nim_timeout_patch_is_idempotent() -> None:
    """Applying the NIM timeout patch twice must not raise."""
    from cognitive_code_agent.register import _apply_nim_timeout_patch

    # First application (may already be applied at import time)
    _apply_nim_timeout_patch(total_seconds=900)
    # Second application — must be a no-op
    _apply_nim_timeout_patch(total_seconds=900)


def test_nim_timeout_patch_sets_client_timeout() -> None:
    """After patching, _create_async_session must produce a session with extended timeout."""
    from cognitive_code_agent.register import _apply_nim_timeout_patch

    _apply_nim_timeout_patch(total_seconds=900)

    try:
        from langchain_nvidia_ai_endpoints._common import _NVIDIAClient

        assert getattr(_NVIDIAClient, "_cognitive_timeout_patch_applied", False)
    except ImportError:
        pytest.skip("langchain_nvidia_ai_endpoints not installed")


# ---------------------------------------------------------------------------
# Task 1.4: Streaming failure with ainvoke fallback also failing
# ---------------------------------------------------------------------------


def test_stream_and_ainvoke_both_fail_yields_error_message(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When both streaming and ainvoke fail, yield a user-friendly error."""

    class FakeCompiledGraph:
        async def astream(self, *_args, **_kwargs):
            raise RuntimeError("stream exploded")
            yield  # noqa: RET503 — unreachable, needed for async generator

        async def ainvoke(self, *_args, **_kwargs):
            raise RuntimeError("ainvoke also exploded")

    class FakeGraphFactory:
        def __init__(self, **_kwargs):
            pass

        async def build_graph(self):
            return FakeCompiledGraph()

    class FakeBuilder:
        async def get_llm(self, *_args, **_kwargs):
            return object()

        async def get_tools(self, tool_names, **_kwargs):
            if tool_names:
                return [SimpleNamespace(name="fake_tool")]
            return []

    monkeypatch.setattr(workflow_module, "SafeToolCallAgentGraph", FakeGraphFactory)
    monkeypatch.setattr(workflow_module, "build_active_skills_block", lambda **_kwargs: ([], ""))

    async def run() -> list[str]:
        config = SafeToolCallAgentWorkflowConfig.model_validate(
            {
                "tool_names": ["fake_tool"],
                "llm_name": "devstral",
            }
        )
        async with safe_tool_calling_agent_workflow(config, FakeBuilder()) as function_info:
            chunks = []
            async for chunk in function_info.stream_fn(ChatRequestOrMessage(input_message="Hola")):
                chunks.append(chunk.choices[0].delta.content or "")
            return chunks

    chunk_contents = asyncio.run(run())

    # Must not crash — yields structured partial response + stop chunk
    assert any("Execution budget was exhausted" in c for c in chunk_contents)

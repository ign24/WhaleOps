"""Integration tests for SpawnAgentRunner.

Verifies that spawned agents run through a real SafeToolCallAgentGraph (with a
mock LLM) and return results, without recursion errors.
"""

from __future__ import annotations

import asyncio
from unittest.mock import MagicMock

import pytest
from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableLambda
from langchain_core.tools import tool

from cognitive_code_agent.tools.spawn_agent import SpawnAgentRunner

pytestmark = pytest.mark.integration


class _FakeLLM:
    """Minimal LLM that returns a final answer without tool calls."""

    async def ainvoke(self, messages: object, **kwargs: object) -> AIMessage:
        return AIMessage(content="Task complete.")

    def bind_tools(self, tools: list) -> object:
        async def _invoke(messages_dict: object, **kw: object) -> AIMessage:
            return AIMessage(content="Task complete.")

        return RunnableLambda(_invoke)


@tool
def fake_list_directory(path: str) -> str:
    """List directory contents at path."""
    return f"files in {path}: file1.py file2.py"


def _make_fake_tool(name: str) -> MagicMock:
    t = MagicMock()
    t.name = name
    return t


async def test_spawn_agent_runs_without_recursion_error() -> None:
    """Spawned agent runs through a real SafeToolCallAgentGraph and returns a string."""
    tool_registry = {"fake_list_directory": fake_list_directory}

    runner = SpawnAgentRunner(
        tool_registry=tool_registry,
        llm=_FakeLLM(),
        summary_llm=None,
        skill_registry_path="src/cognitive_code_agent/prompts/skills/registry.yml",
        max_active_skills=2,
    )

    result = await runner.run(
        task="List the contents of /tmp",
        tools=["fake_list_directory"],
        max_iterations=5,
    )

    assert isinstance(result, str)
    assert len(result) > 0


async def test_spawn_two_agents_parallel_independent() -> None:
    """Two parallel spawns complete independently with separate results."""
    call_order: list[str] = []

    async def fake_build_and_run(tools, task, max_iterations):
        await asyncio.sleep(0)
        call_order.append(task)
        return f"done: {task}"

    tool_registry = {"run_semgrep": _make_fake_tool("run_semgrep")}

    runner = SpawnAgentRunner(
        tool_registry=tool_registry,
        llm=_FakeLLM(),
        summary_llm=None,
        skill_registry_path="src/cognitive_code_agent/prompts/skills/registry.yml",
        max_active_skills=2,
        _build_and_run=fake_build_and_run,
    )

    r1, r2 = await asyncio.gather(
        runner.run(task="security-alpha", tools=["run_semgrep"], max_iterations=10),
        runner.run(task="security-beta", tools=["run_semgrep"], max_iterations=10),
    )

    assert r1 == "done: security-alpha"
    assert r2 == "done: security-beta"
    assert set(call_order) == {"security-alpha", "security-beta"}

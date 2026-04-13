"""Safe tool-calling workflow with timeout and recursion fallback.

Important NAT compatibility note:
- Do not enable ``from __future__ import annotations`` in this module.
  NAT's FunctionInfo introspection path reads ``inspect.signature`` annotations
  and can fail on Python 3.11 when annotations are deferred strings.
"""

import asyncio
import contextvars
import datetime
import hashlib
import json
import logging
import re
from dataclasses import dataclass
from enum import Enum
from typing import Annotated
from typing import AsyncGenerator

from langchain_core.messages import AIMessage
from langchain_core.messages import BaseMessage
from langchain_core.messages import SystemMessage
from langchain_core.messages import ToolMessage
from langchain_core.messages import trim_messages
from langchain_core.runnables.config import RunnableConfig
from langchain_core.runnables.config import ensure_config
from langchain_core.runnables.config import merge_configs
from langgraph.errors import GraphRecursionError
from pydantic import Field

from nat.agent.base import AGENT_LOG_PREFIX
from nat.agent.tool_calling_agent.agent import ToolCallAgentGraph
from nat.agent.tool_calling_agent.agent import ToolCallAgentGraphState
from nat.agent.tool_calling_agent.agent import create_tool_calling_agent_prompt
from nat.agent.tool_calling_agent.register import ToolCallAgentWorkflowConfig
from nat.builder.builder import Builder
from nat.builder.framework_enum import LLMFrameworkEnum
from nat.builder.function_info import FunctionInfo
from nat.cli.register_workflow import register_function
from nat.data_models.api_server import ChatRequest
from nat.data_models.api_server import ChatRequestOrMessage
from nat.data_models.api_server import ChatResponse
from nat.data_models.api_server import ChatResponseChunk
from nat.data_models.api_server import UserMessageContentRoleType
from nat.data_models.api_server import Usage
from nat.data_models.streaming import Streaming
from nat.utils.type_converter import GlobalTypeConverter

from cognitive_code_agent.memory import MemoryConfig
from cognitive_code_agent.memory import WorkingMemoryConfig
from cognitive_code_agent.memory import load_memory_config
from cognitive_code_agent.memory.working import compress_state
from cognitive_code_agent.memory.working import prepare_messages_with_summary
from cognitive_code_agent.memory.working import should_compact
from cognitive_code_agent.prompts import build_active_skills_block
from cognitive_code_agent.prompts import load_base_prompt
from cognitive_code_agent.routing.query_classifier import IntentClass
from cognitive_code_agent.routing.query_classifier import QueryClassifier

logger = logging.getLogger(__name__)


VALID_MODES = ("analyze", "execute")
_REFACTOR_ALIAS = "refactor"  # Deprecated alias → routes to execute

WRITE_TOOL_NAMES = frozenset({"write_file", "edit_file", "create_directory"})
READ_ONLY_MODES = frozenset({"analyze"})
TEMPERATURE_PRESETS: dict[str, float] = {"low": 0.1, "medium": 0.3, "high": 0.7}
_MODE_PREFIX_RE = re.compile(
    r"^/(" + "|".join((*VALID_MODES, _REFACTOR_ALIAS)) + r")\b\s*",
    re.IGNORECASE,
)
_TOOL_CALL_ID_RE = re.compile(r"^call_")


def _resolve_runtime_key(
    mode: str,
    model_key: str,
    temp_preset: str,
) -> tuple[str, str, str]:
    """Build a normalized runtime cache key, falling back to 'medium' for unknown presets."""
    normalized_preset = temp_preset if temp_preset in TEMPERATURE_PRESETS else "medium"
    return (mode, model_key, normalized_preset)


# Marker appended by _guard_tool_outputs when content is truncated.
# Co-located with the guard so the detection string is always in sync.
TRUNCATION_MARKER = "[OUTPUT TRUNCATED:"

# ContextVars used to communicate between run_and_stream and _guard_tool_outputs
# within the same asyncio task without mutating shared graph state.
_TRUNCATION_OCCURRED: contextvars.ContextVar[bool] = contextvars.ContextVar(
    "_TRUNCATION_OCCURRED", default=False
)
_TOOL_GUARD_OVERRIDES: contextvars.ContextVar[dict[str, int] | None] = contextvars.ContextVar(
    "_TOOL_GUARD_OVERRIDES", default=None
)


class FailureClass(str, Enum):
    RECURSION_LIMIT = "recursion_limit"
    TOOL_TIMEOUT = "tool_timeout"
    TOOL_VALIDATION_ERROR = "tool_validation_error"
    TOOL_CALL_ID_MISMATCH = "tool_call_id_mismatch"
    DEGRADED_FUNCTION = "degraded_function"
    MEMORY_DEGRADED = "memory_degraded"
    EVIDENCE_INSUFFICIENT = "evidence_insufficient"
    UNKNOWN_RUNTIME = "unknown_runtime"
    HITL_TIMEOUT = "hitl_timeout"
    WRITE_DENIED = "write_denied"
    RATE_LIMITED = "rate_limited"
    SERVER_ERROR = "server_error"
    CONTEXT_OVERFLOW = "context_overflow"


@dataclass(slots=True, frozen=True)
class FailurePolicy:
    retryable: bool
    partial_finalize: bool
    action: str


@dataclass(slots=True, frozen=True)
class NormalizedFailure:
    failure_class: FailureClass
    failure_source: str
    subagent_name: str | None


FAILURE_POLICIES: dict[FailureClass, FailurePolicy] = {
    FailureClass.RECURSION_LIMIT: FailurePolicy(
        retryable=True, partial_finalize=True, action="single_scoped_retry"
    ),
    FailureClass.TOOL_TIMEOUT: FailurePolicy(
        retryable=True, partial_finalize=True, action="single_scoped_retry"
    ),
    FailureClass.TOOL_VALIDATION_ERROR: FailurePolicy(
        retryable=False, partial_finalize=False, action="replan_without_same_args"
    ),
    FailureClass.TOOL_CALL_ID_MISMATCH: FailurePolicy(
        retryable=True, partial_finalize=True, action="repair_history_and_retry"
    ),
    FailureClass.DEGRADED_FUNCTION: FailurePolicy(
        retryable=False, partial_finalize=True, action="direct_execution_fallback"
    ),
    FailureClass.MEMORY_DEGRADED: FailurePolicy(
        retryable=False, partial_finalize=False, action="continue_without_memory"
    ),
    FailureClass.EVIDENCE_INSUFFICIENT: FailurePolicy(
        retryable=False, partial_finalize=False, action="downgrade_to_unconfirmed"
    ),
    FailureClass.UNKNOWN_RUNTIME: FailurePolicy(
        retryable=False, partial_finalize=True, action="safe_partial_finalize"
    ),
    FailureClass.HITL_TIMEOUT: FailurePolicy(
        retryable=False, partial_finalize=False, action="skip_and_continue"
    ),
    FailureClass.WRITE_DENIED: FailurePolicy(
        retryable=False, partial_finalize=False, action="replan_without_write"
    ),
    FailureClass.RATE_LIMITED: FailurePolicy(
        retryable=True, partial_finalize=True, action="exponential_backoff_retry"
    ),
    FailureClass.SERVER_ERROR: FailurePolicy(
        retryable=True, partial_finalize=True, action="exponential_backoff_retry"
    ),
    FailureClass.CONTEXT_OVERFLOW: FailurePolicy(
        retryable=True, partial_finalize=True, action="compact_and_continue"
    ),
}


SUBAGENT_TOOL_NAMES = {
    "reader_agent",
    "security_agent",
    "qa_agent",
    "review_agent",
    "docs_agent",
}


def resolve_mode(user_message: str, default: str = "analyze") -> tuple[str, str]:
    """Detect an explicit mode prefix and return (mode, cleaned_message).

    Examples:
        >>> resolve_mode("/analyze https://github.com/org/repo")
        ('analyze', 'https://github.com/org/repo')
        >>> resolve_mode("/execute apply the plan")
        ('execute', 'apply the plan')
        >>> resolve_mode("/refactor apply the plan")
        ('execute', 'apply the plan')
        >>> resolve_mode("just a plain message")
        ('analyze', 'just a plain message')
    """
    match = _MODE_PREFIX_RE.match(user_message)
    if match:
        mode = match.group(1).lower()
        cleaned = user_message[match.end() :].strip()
        if mode == _REFACTOR_ALIAS:
            logger.info("%s /refactor is deprecated, routing to /execute", AGENT_LOG_PREFIX)
            mode = "execute"
        return mode, cleaned
    return default, user_message


def strip_think_blocks(content: str) -> str:
    """Remove model reasoning tags to keep responses user-facing."""
    return re.sub(r"(?is)<think>.*?</think>", "", content).strip()


def _emit_trace_event(event_type: str, payload: dict) -> None:
    """Log a structured trace event as JSON for the NAT file tracer.

    Events are logged at INFO level so they appear in the JSONL trace file.
    The ``trace_event=`` prefix makes them parseable by trace consumers.
    """
    event = {"event_type": event_type, **payload}
    logger.info("trace_event=%s", json.dumps(event, ensure_ascii=True))


def _classify_failure(error: Exception | str) -> FailureClass:
    """Classify runtime failures into deterministic fallback classes."""
    if isinstance(error, GraphRecursionError):
        return FailureClass.RECURSION_LIMIT
    message = str(error).lower()
    if "timed out" in message or "timeout" in message:
        return FailureClass.TOOL_TIMEOUT
    if "validation_error" in message or "destination already exists" in message:
        return FailureClass.TOOL_VALIDATION_ERROR
    # Check TOOL_CALL_ID_MISMATCH and DEGRADED_FUNCTION before UNKNOWN_RUNTIME
    if "unexpected tool call id" in message:
        return FailureClass.TOOL_CALL_ID_MISMATCH
    if "degraded function cannot be invoked" in message:
        return FailureClass.DEGRADED_FUNCTION
    if "memory_degraded" in message:
        return FailureClass.MEMORY_DEGRADED
    if "rate limit" in message or "429" in message or "too many requests" in message:
        return FailureClass.RATE_LIMITED
    if "context length" in message or "maximum context" in message or "token limit" in message:
        return FailureClass.CONTEXT_OVERFLOW
    if (
        "500" in message
        or "502" in message
        or "503" in message
        or "internal server error" in message
        or "bad gateway" in message
        or "service unavailable" in message
        or "connection refused" in message
        or "connection reset" in message
        or "enginecore" in message
    ):
        return FailureClass.SERVER_ERROR
    return FailureClass.UNKNOWN_RUNTIME


def _extract_degraded_function_id(error: Exception | str) -> str | None:
    """Extract the NAT function ID from a DEGRADED function error message, if present."""
    import re

    text = str(error)
    match = re.search(
        r"function\s+id\s+['\"]?([0-9a-f-]{36})['\"]?",
        text,
        re.IGNORECASE,
    )
    return match.group(1) if match else None


_RATE_LIMIT_BASE_DELAY = 2.0
_RATE_LIMIT_MAX_DELAY = 30.0
_RATE_LIMIT_MAX_RETRIES = 2

# Marker written to recovery_notes when the stream path exhausts the recursion budget.
# Used by the ainvoke fallback to detect the futile-full-retry scenario and switch to
# synthesis-only mode.
_STREAM_FAILURE_RECURSION = "stream_failure:recursion_limit"

# Capped recursion budget for synthesis-only ainvoke after a recursion-limit failure.
# 12 recursion steps ≈ 6 LLM turns — sufficient for a single synthesis response.
_SYNTHESIS_RECURSION_LIMIT = 12


def _rate_limit_backoff_delay(
    attempt: int, *, base: float = _RATE_LIMIT_BASE_DELAY, max_delay: float = _RATE_LIMIT_MAX_DELAY
) -> float:
    """Compute exponential backoff delay in seconds for a given attempt (0-based)."""
    return min(base * (2**attempt), max_delay)


def _should_retry_ainvoke(failure_class: "FailureClass") -> bool:
    """Return True if the ainvoke fallback should retry after this failure class."""
    return failure_class in (FailureClass.SERVER_ERROR, FailureClass.RATE_LIMITED)


# -- Compact-and-continue recovery ------------------------------------------

_ALWAYS_COMPACT_RECOVERABLE = frozenset(
    {FailureClass.RECURSION_LIMIT, FailureClass.CONTEXT_OVERFLOW}
)
_PROGRESS_COMPACT_RECOVERABLE = frozenset({FailureClass.SERVER_ERROR, FailureClass.RATE_LIMITED})


class _RecoverableFailure(Exception):
    """Internal sentinel raised when a failure is eligible for compact-and-continue."""

    def __init__(self, failure_class: FailureClass) -> None:
        self.failure_class = failure_class
        super().__init__(failure_class.value)


def _is_compact_recoverable(failure_class: FailureClass, *, has_progress: bool) -> bool:
    """Return True if *failure_class* can be recovered via compact-and-continue."""
    if failure_class in _ALWAYS_COMPACT_RECOVERABLE:
        return True
    if failure_class in _PROGRESS_COMPACT_RECOVERABLE and has_progress:
        return True
    return False


def _extract_delegation_identity(tool_name: str, args: object) -> str | None:
    """Extract delegation identity for subagent-aware loop signatures."""
    if isinstance(args, dict):
        subagent_name = args.get("subagent_name")
        if isinstance(subagent_name, str) and subagent_name.strip():
            return subagent_name.strip()
    if tool_name in SUBAGENT_TOOL_NAMES or tool_name.endswith("_agent"):
        return tool_name
    return None


def _normalize_subagent_failure(
    *,
    tool_name: str,
    tool_status: str | None,
    tool_content: str,
) -> NormalizedFailure | None:
    """Normalize delegated subagent runtime payloads into deterministic classes."""
    subagent_name = _extract_delegation_identity(tool_name, {})
    if subagent_name is None:
        return None

    status = (tool_status or "").lower()
    lower_content = tool_content.lower()
    if status == "error" or "graphrecursionerror" in lower_content or "timeout" in lower_content:
        failure_class = _classify_failure(tool_content)
        return NormalizedFailure(
            failure_class=failure_class,
            failure_source="subagent",
            subagent_name=subagent_name,
        )
    return None


def _count_subagent_failure_occurrences(
    messages: list[BaseMessage],
    *,
    subagent_name: str,
    failure_class: FailureClass,
) -> int:
    marker = f"SUBAGENT_FAILURE::{subagent_name}::{failure_class.value}"
    count = 0
    for msg in messages:
        if not isinstance(msg, ToolMessage):
            continue
        content = str(msg.content)
        if marker in content:
            count += 1
    return count


def _normalize_nested_subagent_failures(
    state: ToolCallAgentGraphState,
    *,
    mode_name: str,
    escalation_budget: dict[str, dict[str, int]],
) -> int:
    """Convert raw nested runtime errors into deterministic, bounded failure signals."""
    normalized = 0
    for idx, msg in enumerate(state.messages):
        if not isinstance(msg, ToolMessage):
            continue
        tool_name = getattr(msg, "name", None) or ""
        content = str(msg.content)
        normalized_failure = _normalize_subagent_failure(
            tool_name=tool_name,
            tool_status=getattr(msg, "status", None),
            tool_content=content,
        )
        if normalized_failure is None or normalized_failure.subagent_name is None:
            continue

        normalized += 1
        subagent_name = normalized_failure.subagent_name
        failure_class = normalized_failure.failure_class
        policy = FAILURE_POLICIES[failure_class]
        class_budget = escalation_budget.get(subagent_name, {})
        max_escalations = class_budget.get(failure_class.value, 1)
        previous_count = _count_subagent_failure_occurrences(
            state.messages[:idx],
            subagent_name=subagent_name,
            failure_class=failure_class,
        )
        attempt = previous_count + 1
        exhausted = attempt > max_escalations
        action = "safe_partial_finalize" if exhausted else policy.action

        _emit_trace_event(
            "fallback_activated",
            {
                "reason": failure_class.value,
                "action": action,
                "mode": mode_name,
                "failure_source": normalized_failure.failure_source,
                "subagent_name": subagent_name,
                "attempt": attempt,
                "max_escalations": max_escalations,
            },
        )

        marker = f"SUBAGENT_FAILURE::{subagent_name}::{failure_class.value}::attempt={attempt}"
        if exhausted:
            normalized_content = (
                f"{marker}\n"
                f"Nested recovery exhausted for delegated subagent '{subagent_name}' "
                f"({failure_class.value}). Finalize with structured partial output and "
                "mark blocked scope as subagent-related."
            )
        else:
            normalized_content = (
                f"{marker}\n"
                f"Delegated subagent '{subagent_name}' failed with class '{failure_class.value}'. "
                "Run one scoped retry/replan only, then finalize partial output if it fails again."
            )

        state.messages[idx] = ToolMessage(
            content=normalized_content,
            tool_call_id=msg.tool_call_id,
            name=tool_name,
            status="error",
        )
    return normalized


def _format_structured_partial_response(
    *,
    failure_class: FailureClass,
    verified: list[str] | None = None,
    unverified: list[str] | None = None,
    blocked_by: list[str] | None = None,
    next_steps: list[str] | None = None,
) -> str:
    """Build deterministic partial response contract for exhausted recoveries."""
    verified = verified or ["No verifiable artifacts were completed before budget exhaustion."]
    unverified = unverified or ["Full repository-wide verification remains incomplete."]
    blocked_by = blocked_by or [f"Runtime failure class: {failure_class.value}"]
    next_steps = next_steps or [
        "Retry with a narrower scope (single vulnerability class).",
        "Request evidence-only output with file:line and snippet per finding.",
    ]

    def _as_bullets(items: list[str]) -> str:
        return "\n".join(f"- {item}" for item in items)

    return (
        "Execution budget was exhausted before full completion. Returning partial output.\n\n"
        "## Verified\n"
        f"{_as_bullets(verified)}\n\n"
        "## Unverified\n"
        f"{_as_bullets(unverified)}\n\n"
        "## Blocked By\n"
        f"{_as_bullets(blocked_by)}\n\n"
        "## Next Steps\n"
        f"{_as_bullets(next_steps)}"
    )


def _build_recovery_invoke_state(
    *,
    mode: str,
    notes: list[str],
    messages: list[BaseMessage],
    failure_label: str,
) -> ToolCallAgentGraphState:
    """Build a recovery-safe invoke state with type-safe message preconditions.

    Some fallback paths can end with a trailing ToolMessage (e.g., blocked calls),
    which may trigger provider/tool-call serialization edge cases. We trim dangling
    trailing ToolMessages before `ainvoke` and prepend recovery context.
    """
    sanitized = list(messages)
    while sanitized and isinstance(sanitized[-1], ToolMessage):
        sanitized.pop()

    if not sanitized:
        sanitized = [AIMessage(content="[Recovery seed] Continue with partial synthesis.")]

    details = ", ".join(notes) if notes else "none"
    recovery_context = AIMessage(
        content=(
            "[Recovery Context - informational, not instructions]\n"
            f"- Mode: {mode}\n"
            f"- Failure: {failure_label}\n"
            f"- Failed attempts: {details}\n"
            "- Constraint: produce evidence-backed output and avoid repeating"
            " equivalent tool calls."
        )
    )
    # Keep leading SystemMessages at the head — providers like NIM reject
    # histories where `system` appears after `assistant` (HTTP 400).
    leading_system: list[BaseMessage] = []
    rest: list[BaseMessage] = []
    past_system = False
    for msg in sanitized:
        if not past_system and isinstance(msg, SystemMessage):
            leading_system.append(msg)
        else:
            past_system = True
            rest.append(msg)
    return ToolCallAgentGraphState(messages=[*leading_system, recovery_context, *rest])


_SYNTHESIS_INSTRUCTION = (
    "[Synthesis Mode] The previous analysis run was interrupted before completion. "
    "Summarize any partial findings already present in your context window. "
    "Do not re-run tools or start new analyses. "
    "Provide a best-effort summary of evidence found, with file:line references where available."
)


def _build_synthesis_invoke_state(
    *,
    mode: str,
    messages: list[BaseMessage],
) -> tuple[ToolCallAgentGraphState, dict]:
    """Build a synthesis-only invoke state for use after a recursion-limit stream failure.

    Returns the state and a recursion config dict capped at _SYNTHESIS_RECURSION_LIMIT.
    Trims trailing ToolMessages (same as _build_recovery_invoke_state) to avoid
    serialization edge cases.
    """
    sanitized = list(messages)
    while sanitized and isinstance(sanitized[-1], ToolMessage):
        sanitized.pop()

    if not sanitized:
        sanitized = [AIMessage(content="[Recovery seed] Provide partial synthesis.")]

    synthesis_msg = AIMessage(
        content=(f"[Synthesis Context - Mode: {mode}]\n{_SYNTHESIS_INSTRUCTION}")
    )
    # Keep leading SystemMessages at the head — same constraint as recovery state.
    leading_system: list[BaseMessage] = []
    rest: list[BaseMessage] = []
    past_system = False
    for msg in sanitized:
        if not past_system and isinstance(msg, SystemMessage):
            leading_system.append(msg)
        else:
            past_system = True
            rest.append(msg)
    state = ToolCallAgentGraphState(messages=[*leading_system, synthesis_msg, *rest])
    cfg = {"recursion_limit": _SYNTHESIS_RECURSION_LIMIT}
    return state, cfg


def _sanitize_message_role_order(messages: list[BaseMessage]) -> list[BaseMessage]:
    """Relocate any mid-list SystemMessages to the head.

    Providers like NIM reject histories where a ``system`` role appears after
    an ``assistant`` role (HTTP 400 "Unexpected role 'system' after role
    'assistant'"). This sanitizer collects all SystemMessages — regardless of
    where they appear — and places them before any non-system messages.
    """
    system_msgs = [m for m in messages if isinstance(m, SystemMessage)]
    non_system_msgs = [m for m in messages if not isinstance(m, SystemMessage)]
    return [*system_msgs, *non_system_msgs]


_PROGRESSIVE_RETAIN_RECENT = (4, 2, 1)


def _recovery_retain_recent(recovery_round: int) -> int:
    """Return the compaction retain_recent for a given recovery round (0-indexed)."""
    if recovery_round < len(_PROGRESSIVE_RETAIN_RECENT):
        return _PROGRESSIVE_RETAIN_RECENT[recovery_round]
    return _PROGRESSIVE_RETAIN_RECENT[-1]


def _normalize_tool_args(args: object) -> object:
    """Normalize tool args for deterministic loop-signature matching."""
    if isinstance(args, dict):
        return {str(k): _normalize_tool_args(v) for k, v in sorted(args.items())}
    if isinstance(args, list):
        return [_normalize_tool_args(v) for v in args]
    if isinstance(args, str):
        return args.strip()
    return args


def _tool_signature(tool_name: str, args: object) -> str:
    normalized = _normalize_tool_args(args)
    delegation_identity = _extract_delegation_identity(tool_name, normalized)
    serialized = json.dumps(normalized, sort_keys=True, ensure_ascii=True)
    delegation_key = delegation_identity or "none"
    return f"{tool_name}|delegation={delegation_key}::{serialized}"


def _hash_signature(signature: str) -> str:
    return hashlib.sha256(signature.encode("utf-8")).hexdigest()[:16]


def _history_tool_signature_count(messages: list[BaseMessage], signature: str) -> int:
    """Count how many times a signature has appeared in prior AI tool calls."""
    count = 0
    for msg in messages:
        if not isinstance(msg, AIMessage):
            continue
        calls = getattr(msg, "tool_calls", None) or []
        for call in calls:
            if _tool_signature(call.get("name", ""), call.get("args", {})) == signature:
                count += 1
    return count


def _apply_tool_loop_guard(
    state: ToolCallAgentGraphState,
    *,
    threshold: int,
    mode_name: str,
) -> int:
    """Block repeated equivalent tool calls beyond threshold.

    Returns number of blocked calls.
    """
    if threshold < 1 or not state.messages:
        return 0
    last = state.messages[-1]
    calls = getattr(last, "tool_calls", None) or []
    if not calls:
        return 0

    keep: list[dict] = []
    blocked = 0
    previous_messages = state.messages[:-1]
    for call in calls:
        tool_name = call.get("name", "unknown_tool")
        call_args = call.get("args", {})
        signature = _tool_signature(tool_name, call_args)
        seen_count = _history_tool_signature_count(previous_messages, signature)
        if seen_count >= threshold:
            blocked += 1
            delegation_identity = _extract_delegation_identity(tool_name, call_args)
            payload = {
                "mode": mode_name,
                "tool": tool_name,
                "threshold": threshold,
                "signature_hash": _hash_signature(signature),
                "action": "block_and_replan",
            }
            if delegation_identity:
                payload["failure_source"] = "subagent"
                payload["subagent_name"] = delegation_identity
            _emit_trace_event(
                "tool_loop_guard",
                payload,
            )
            state.messages.append(
                ToolMessage(
                    name=tool_name,
                    tool_call_id=call.get("id", tool_name),
                    status="error",
                    content=(
                        "Loop guard blocked repeated equivalent tool call. "
                        "Replan with narrower scope or different arguments."
                    ),
                )
            )
            continue
        keep.append(call)

    if blocked == 0:
        return 0

    calls[:] = keep
    additional = getattr(last, "additional_kwargs", None) or {}
    raw_calls = additional.get("tool_calls")
    if raw_calls:
        keep_ids = {c.get("id") for c in keep}
        additional["tool_calls"] = [r for r in raw_calls if r.get("id") in keep_ids]
    return blocked


def _apply_write_mode_guard(
    state: ToolCallAgentGraphState,
    *,
    mode_name: str,
) -> int:
    """Block write tools in read-only modes with a non-terminating error."""
    if mode_name not in READ_ONLY_MODES:
        return 0
    last = state.messages[-1] if state.messages else None
    if not isinstance(last, AIMessage):
        return 0
    tool_calls = getattr(last, "tool_calls", None) or []
    blocked = 0
    for tc in tool_calls:
        tool_name = tc.get("name", "")
        # Match full name or MCP-style suffix (e.g. fs_tools_write__write_file)
        short_name = tool_name.rsplit("__", 1)[-1] if "__" in tool_name else tool_name
        if short_name in WRITE_TOOL_NAMES:
            blocked += 1
            state.messages.append(
                ToolMessage(
                    content=(
                        "Write operations are not available in analyze mode. "
                        "Use /execute to modify files."
                    ),
                    tool_call_id=tc.get("id", ""),
                    name=tool_name,
                    status="error",
                )
            )
            _emit_trace_event(
                "write_mode_guard",
                {"tool_name": tool_name, "mode": mode_name, "action": "denied"},
            )
    return blocked


def _apply_parallel_tool_cap(
    state: ToolCallAgentGraphState,
    *,
    max_parallel_tool_calls: int,
    mode_name: str,
) -> tuple[int, list[ToolMessage]]:
    """Limit number of tool calls executed in one tool node pass.

    Returns (dropped_count, deferred_messages) where deferred_messages are
    synthetic ToolMessages for the dropped calls. Callers MUST append
    deferred_messages to the result state AFTER the real tool_node executes,
    not before — appending before causes NAT's tool_node to see a ToolMessage
    as the last message and crash with 'ToolMessage has no attribute tool_calls'.
    """
    if max_parallel_tool_calls < 1 or not state.messages:
        return 0, []
    last = state.messages[-1]
    calls = getattr(last, "tool_calls", None) or []
    if len(calls) <= max_parallel_tool_calls:
        return 0, []

    keep = calls[:max_parallel_tool_calls]
    dropped = calls[max_parallel_tool_calls:]
    calls[:] = keep

    additional = getattr(last, "additional_kwargs", None) or {}
    raw_calls = additional.get("tool_calls")
    if raw_calls:
        keep_ids = {c.get("id") for c in keep}
        additional["tool_calls"] = [r for r in raw_calls if r.get("id") in keep_ids]

    _emit_trace_event(
        "tool_parallel_cap",
        {
            "mode": mode_name,
            "max_parallel_tool_calls": max_parallel_tool_calls,
            "requested": len(keep) + len(dropped),
            "dropped": len(dropped),
        },
    )

    deferred: list[ToolMessage] = [
        ToolMessage(
            name=call.get("name", "unknown_tool"),
            tool_call_id=call.get("id", call.get("name", "unknown_tool")),
            status="error",
            content=(
                "Parallel tool-call cap reached. This call was deferred; "
                "replan or retry in a follow-up step."
            ),
        )
        for call in dropped
    ]
    return len(dropped), deferred


def _history_tool_name_count(messages: list[BaseMessage], tool_name: str) -> int:
    count = 0
    for msg in messages:
        if not isinstance(msg, AIMessage):
            continue
        calls = getattr(msg, "tool_calls", None) or []
        for call in calls:
            if call.get("name") == tool_name:
                count += 1
    return count


def _apply_tool_total_limit(
    state: ToolCallAgentGraphState,
    *,
    max_calls_per_request: dict[str, int],
    mode_name: str,
) -> int:
    """Block tool calls that exceed total per-request limits."""
    if not max_calls_per_request or not state.messages:
        return 0

    last = state.messages[-1]
    calls = getattr(last, "tool_calls", None) or []
    if not calls:
        return 0

    keep: list[dict] = []
    blocked = 0
    previous = state.messages[:-1]
    for call in calls:
        tool_name = call.get("name", "unknown_tool")
        limit = max_calls_per_request.get(tool_name)
        if limit is None:
            keep.append(call)
            continue

        seen = _history_tool_name_count(previous, tool_name)
        if seen >= limit:
            blocked += 1
            event_payload = {
                "mode": mode_name,
                "tool": tool_name,
                "limit": limit,
                "seen": seen,
                "action": "block_and_replan",
            }
            _emit_trace_event(
                "tool_total_limit",
                event_payload,
            )
            _emit_trace_event(
                "budget_exhausted",
                {
                    **event_payload,
                    "budget_type": "per_request_tool_limit",
                    "failure_source": "orchestrator",
                },
            )
            state.messages.append(
                ToolMessage(
                    name=tool_name,
                    tool_call_id=call.get("id", tool_name),
                    status="error",
                    content=(
                        f"Tool call blocked: '{tool_name}' reached per-request limit ({limit}). "
                        "Use partial synthesis or a narrower follow-up request."
                    ),
                )
            )
            continue
        keep.append(call)

    if blocked == 0:
        return 0

    calls[:] = keep
    additional = getattr(last, "additional_kwargs", None) or {}
    raw_calls = additional.get("tool_calls")
    if raw_calls:
        keep_ids = {c.get("id") for c in keep}
        additional["tool_calls"] = [r for r in raw_calls if r.get("id") in keep_ids]
    return blocked


def _apply_evidence_gate(content: str, *, mode: str) -> tuple[str, int]:
    """Downgrade unsupported security/audit claims to unconfirmed.

    Evidence requirement: finding line should include file:line metadata and
    source-tool hint. Missing evidence is annotated as unconfirmed.
    """
    if mode != "analyze" or not content:
        return content, 0

    nested_runtime_patterns = (
        "graphrecursionerror",
        "recursion limit of",
        "timed out after",
        "subagent failure",
    )

    cleaned_lines: list[str] = []
    removed_runtime_payloads = 0
    for line in content.splitlines():
        lower_line = line.lower()
        if any(pattern in lower_line for pattern in nested_runtime_patterns):
            removed_runtime_payloads += 1
            continue
        cleaned_lines.append(line)

    content = "\n".join(cleaned_lines)

    path_line_re = re.compile(r"[^\s:]+\.[a-zA-Z0-9_]+:\d+")
    tool_hint_re = re.compile(r"(semgrep|trivy|gitleaks|bandit|tool:|source:)", re.IGNORECASE)
    risky_re = re.compile(
        r"(vulnerab|secret|csrf|cve|injection|open redirect|auth bypass)",
        re.IGNORECASE,
    )

    downgraded = 0
    updated: list[str] = []
    for line in content.splitlines():
        if line.strip().startswith("-") and risky_re.search(line):
            has_path_line = path_line_re.search(line) is not None
            has_tool_hint = tool_hint_re.search(line) is not None
            if not (has_path_line and has_tool_hint):
                downgraded += 1
                line = f"{line} (unconfirmed: missing path/line/tool evidence)"
        updated.append(line)

    gated = "\n".join(updated)
    if (downgraded > 0 or removed_runtime_payloads > 0) and "## Next Steps" not in gated:
        gated += (
            "\n\n## Next Steps\n"
            "- Verify each unconfirmed item with explicit file:line evidence.\n"
            "- Re-run targeted tools and include source tool per finding."
        )
    return gated, downgraded + removed_runtime_payloads


def _measure_progress(messages: list[BaseMessage], checkpoint_idx: int) -> bool:
    """Return True if meaningful tool execution occurred since *checkpoint_idx*.

    Progress is defined as at least one ToolMessage with ``status != "error"``
    and content length > 50 characters.  This uses the graph state directly —
    no log parsing required.
    """
    for msg in messages[checkpoint_idx:]:
        if (
            isinstance(msg, ToolMessage)
            and getattr(msg, "status", None) != "error"
            and len(str(msg.content)) > 50
        ):
            return True
    return False


def _extract_usage_metadata(state: ToolCallAgentGraphState) -> dict | None:
    """Extract real token counts from the last AIMessage's usage_metadata.

    Returns a dict with prompt_tokens, completion_tokens, total_tokens
    if available, or None if no usage metadata is present.
    """
    if not state.messages:
        return None
    last = state.messages[-1]
    if not isinstance(last, AIMessage):
        return None
    usage = getattr(last, "usage_metadata", None)
    if not usage or not isinstance(usage, dict):
        return None
    input_tokens = usage.get("input_tokens")
    output_tokens = usage.get("output_tokens")
    if input_tokens is None or output_tokens is None:
        return None
    total = usage.get("total_tokens", (input_tokens or 0) + (output_tokens or 0))
    return {
        "prompt_tokens": input_tokens,
        "completion_tokens": output_tokens,
        "total_tokens": total,
    }


def _guard_tool_outputs(
    state: ToolCallAgentGraphState,
    max_chars: int = 30000,
    per_tool_max_chars: dict[str, int] | None = None,
) -> None:
    """Truncate oversized tool outputs to prevent context overflow.

    Iterates ToolMessage entries in state.messages and truncates content
    exceeding the applicable limit, appending a notice so the LLM knows to use
    targeted queries for details.

    Per-tool limits in *per_tool_max_chars* take precedence over the global
    *max_chars* cap when the tool name matches.  Any overrides registered via
    _TOOL_GUARD_OVERRIDES (used by context-reduction retry) are merged on top,
    giving them the highest precedence.
    """
    overrides = _TOOL_GUARD_OVERRIDES.get()
    effective_per_tool: dict[str, int] = {}
    if per_tool_max_chars:
        effective_per_tool.update(per_tool_max_chars)
    if overrides:
        effective_per_tool.update(overrides)

    for i, msg in enumerate(state.messages):
        if not isinstance(msg, ToolMessage):
            continue
        content = msg.content
        if not isinstance(content, str):
            continue
        tool_name = getattr(msg, "name", None) or ""
        if tool_name in effective_per_tool:
            limit = effective_per_tool[tool_name]
            limit_source = "per_tool"
        else:
            limit = max_chars
            limit_source = "global"
        if len(content) <= limit:
            continue
        removed = len(content) - limit
        truncated = (
            content[:limit] + f"\n\n{TRUNCATION_MARKER} {removed:,} chars removed."
            " Use targeted queries for details.]"
        )
        state.messages[i] = ToolMessage(
            content=truncated,
            tool_call_id=msg.tool_call_id,
            name=tool_name or None,
            status=getattr(msg, "status", "ok"),
        )
        _TRUNCATION_OCCURRED.set(True)
        _emit_trace_event(
            "tool_output_truncated",
            {
                "tool": tool_name or "unknown",
                "original_chars": len(content),
                "truncated_chars": limit,
                "removed_chars": removed,
                "limit_source": limit_source,
            },
        )


def _normalize_tool_call_ids(state: ToolCallAgentGraphState) -> None:
    """Ensure tool_call IDs are API-compatible and present in additional_kwargs.

    Fixes two issues with NVIDIA AI Endpoints:

    1. **Short IDs** — Some models (e.g. Devstral) generate IDs like
       ``rdD5qZpBq`` that the API rejects.  We prefix them with ``call_``.

    2. **Missing additional_kwargs** — ``langchain-nvidia-ai-endpoints``
       serializes tool_calls from ``additional_kwargs["tool_calls"]``, NOT
       from the parsed ``tool_calls`` list.  Streaming responses leave
       ``additional_kwargs`` empty, so the serialized assistant message has
       **no tool_calls** and the API rejects the subsequent tool result with
       *"Unexpected tool call id"*.  We back-fill ``additional_kwargs``
       from the parsed list so the serializer always finds them.

    Must run in **both** ``agent_node`` (so the graph state stores normalized
    IDs) and ``tool_node`` (defense-in-depth before ToolNode copies IDs).
    """
    last = state.messages[-1]
    tool_calls = getattr(last, "tool_calls", None)
    if not tool_calls:
        return

    # --- 1. Normalize short IDs in the parsed tool_calls ----------------
    for call in tool_calls:
        call_id = call.get("id", "")
        if call_id and not _TOOL_CALL_ID_RE.match(call_id):
            call["id"] = f"call_{call_id}"

    # --- 2. Sync additional_kwargs["tool_calls"] with parsed list -------
    additional = getattr(last, "additional_kwargs", None)
    if additional is None:
        return

    raw_calls = additional.get("tool_calls")
    if raw_calls:
        # ainvoke path: additional_kwargs already has tool_calls — normalize IDs.
        for raw in raw_calls:
            raw_id = raw.get("id", "")
            if raw_id and not _TOOL_CALL_ID_RE.match(raw_id):
                raw["id"] = f"call_{raw_id}"
    else:
        # Streaming path: additional_kwargs is empty.  Back-fill from parsed
        # tool_calls so langchain-nvidia-ai-endpoints serializer includes them.
        additional["tool_calls"] = [
            {
                "id": call["id"],
                "type": "function",
                "function": {
                    "name": call.get("name", ""),
                    "arguments": (
                        call["args"]
                        if isinstance(call.get("args"), str)
                        else json.dumps(call.get("args", {}))
                    ),
                },
            }
            for call in tool_calls
        ]


def _deduplicate_tool_calls(state: ToolCallAgentGraphState) -> None:
    """Remove duplicate tool calls (identical name + args) from the last message.

    Keeps the first occurrence of each (name, args) pair. Syncs
    ``additional_kwargs["tool_calls"]`` to stay consistent with the parsed list.

    DeepSeek V3.2 sometimes emits 10-16 identical parallel calls per turn.
    This guard prevents each duplicate from being executed redundantly.
    """
    last = state.messages[-1]
    tool_calls = getattr(last, "tool_calls", None)
    if not tool_calls:
        return

    seen: set[str] = set()
    keep_indices: list[int] = []
    for i, call in enumerate(tool_calls):
        key = f"{call.get('name', '')}::{json.dumps(call.get('args', {}), sort_keys=True)}"
        if key not in seen:
            seen.add(key)
            keep_indices.append(i)

    if len(keep_indices) == len(tool_calls):
        return  # nothing to remove

    removed = len(tool_calls) - len(keep_indices)
    logger.debug("%s Deduplicating tool calls: removed %d duplicate(s)", AGENT_LOG_PREFIX, removed)

    kept = [tool_calls[i] for i in keep_indices]
    tool_calls[:] = kept

    # Sync additional_kwargs["tool_calls"] if present
    additional = getattr(last, "additional_kwargs", None) or {}
    raw_calls = additional.get("tool_calls")
    if raw_calls:
        kept_ids = {call.get("id") for call in kept}
        additional["tool_calls"] = [r for r in raw_calls if r.get("id") in kept_ids]


def _chunks_to_chat_response(chunks: list[ChatResponseChunk]) -> ChatResponse:
    content_parts: list[str] = []
    usage: Usage | None = None
    model = "unknown-model"

    for chunk in chunks:
        if chunk.model:
            model = chunk.model
        if chunk.usage is not None:
            usage = chunk.usage
        if not chunk.choices:
            continue
        delta_content = chunk.choices[0].delta.content
        if delta_content:
            content_parts.append(delta_content)

    final_usage = usage or Usage(prompt_tokens=0, completion_tokens=0, total_tokens=0)
    return ChatResponse.from_string("".join(content_parts), model=model, usage=final_usage)


async def _retrieve_memory_context(
    *,
    user_message: str,
    memory_config: MemoryConfig,
) -> str:
    """Retrieve memory context for auto-injection at session start.

    Queries available memory sources in parallel with timeout.
    Returns formatted memory block string, or empty string on failure.
    """
    from cognitive_code_agent.memory.retrieval import AutoMemoryRetriever

    # Build lightweight searchers that degrade gracefully
    episodic_manager = _NoopEpisodicManager()
    findings_searcher = _NoopFindingsSearcher()
    semantic_searcher = _NoopSemanticSearcher()

    from cognitive_code_agent.memory.readiness import evaluate_memory_readiness
    from cognitive_code_agent.memory.readiness import log_degraded_memory_once

    readiness = await evaluate_memory_readiness(
        include_episodic=memory_config.auto_retrieval.include_episodic,
        include_findings=memory_config.auto_retrieval.include_findings,
        include_semantic=memory_config.auto_retrieval.include_semantic,
    )

    if memory_config.auto_retrieval.include_findings and not readiness.findings.available:
        log_degraded_memory_once("findings", readiness.findings.reason)
    if memory_config.auto_retrieval.include_semantic and not readiness.semantic.available:
        log_degraded_memory_once("semantic", readiness.semantic.reason)

    # Try to set up episodic manager only if Redis capabilities are available
    if memory_config.auto_retrieval.include_episodic and readiness.episodic.available:
        try:
            import os

            import redis.asyncio as aioredis

            from nat.plugins.redis.redis_editor import RedisEditor

            from cognitive_code_agent.memory.episodic import EpisodicMemoryManager

            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
            client = aioredis.from_url(redis_url, decode_responses=True)
            await client.ping()

            # Reuse a simple embedder proxy — the LLM is not needed for search
            class _EmbedderProxy:
                async def aembed_query(self, text: str) -> list[float]:
                    return [0.0] * 2048  # Placeholder — RedisEditor embeds internally

            editor = RedisEditor(
                redis_client=client, key_prefix="cgn_memory", embedder=_EmbedderProxy()
            )
            episodic_manager = EpisodicMemoryManager(
                editor=editor, llm=None, ttl_days=memory_config.episodic.ttl_days
            )
        except Exception:
            logger.debug("auto_retrieval: episodic source not available", exc_info=True)
    elif memory_config.auto_retrieval.include_episodic and not readiness.episodic.available:
        log_degraded_memory_once("episodic", readiness.episodic.reason)

    retriever = AutoMemoryRetriever(
        episodic_manager=episodic_manager,
        findings_searcher=findings_searcher,
        semantic_searcher=semantic_searcher,
        timeout_seconds=memory_config.auto_retrieval.timeout_seconds,
        include_episodic=memory_config.auto_retrieval.include_episodic,
        include_findings=memory_config.auto_retrieval.include_findings,
        include_semantic=memory_config.auto_retrieval.include_semantic,
        max_semantic_retrieved=memory_config.semantic.max_knowledge_retrieved,
    )

    try:
        return await retriever.retrieve_context(user_message)
    except Exception:
        logger.debug("auto_retrieval: retrieval failed", exc_info=True)
        return ""


class _NoopEpisodicManager:
    """No-op episodic manager when Redis is unavailable."""

    async def search_relevant_sessions(self, query: str, **kwargs) -> list:
        return []


class _NoopFindingsSearcher:
    """No-op findings searcher when Milvus is unavailable."""

    async def search(self, query: str, **kwargs) -> list:
        return []


class _NoopSemanticSearcher:
    """No-op semantic searcher when semantic source is unavailable."""

    async def search(self, query: str, **kwargs) -> list:
        return []


def _fire_and_forget_session_summary(
    *,
    raw_messages: list[dict],
    llm: object,
    memory_config: MemoryConfig,
) -> None:
    """Schedule episodic memory persistence as a background task.

    This is fire-and-forget: if it fails, the agent continues normally.
    Requires Redis Stack (RediSearch + RedisJSON) to be available.
    """
    import uuid

    from cognitive_code_agent.memory.episodic import EpisodicMemoryManager
    from cognitive_code_agent.memory.readiness import log_degraded_memory_once
    from cognitive_code_agent.memory.readiness import probe_episodic_redis

    async def _persist() -> None:
        try:
            episodic_ready = await probe_episodic_redis(ttl_seconds=60)
            if not episodic_ready.available:
                log_degraded_memory_once("episodic", episodic_ready.reason)
                return

            import os

            import redis.asyncio as aioredis

            from nat.plugins.redis.redis_editor import RedisEditor
            from nat.plugins.redis.schema import ensure_index_exists

            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
            client = aioredis.from_url(redis_url, decode_responses=True)

            try:
                await client.ping()
            except Exception:
                logger.debug("episodic_memory: Redis not available, skipping session summary")
                await client.close()
                return

            key_prefix = "cgn_memory"
            await ensure_index_exists(client=client, key_prefix=key_prefix, embedding_dim=2048)

            editor = RedisEditor(redis_client=client, key_prefix=key_prefix, embedder=llm)
            manager = EpisodicMemoryManager(
                editor=editor, llm=llm, ttl_days=memory_config.episodic.ttl_days
            )

            # Extract session context from messages
            session_id = str(uuid.uuid4())
            repo_id = ""
            tools_used: list[str] = []
            for msg in raw_messages:
                content = str(msg.get("content", ""))
                # Simple heuristic: extract repo from URL patterns
                if "/" in content and ("github" in content or "repo" in content.lower()):
                    for word in content.split():
                        if "/" in word and len(word.split("/")) >= 2:
                            repo_id = word.strip(".,;:\"'()[]")
                            break

            await manager.persist_session_summary(
                messages=raw_messages,
                session_id=session_id,
                repo_id=repo_id,
                tools_used=tools_used,
                findings_count=0,
                outcome="completed",
            )
            await client.close()
        except Exception:
            logger.debug("episodic_memory: background session summary failed", exc_info=True)

    asyncio.create_task(_persist())


def _load_memory_config() -> MemoryConfig:
    """Load memory config from dedicated file with legacy fallback."""
    try:
        loaded = load_memory_config()
        logger.info("memory_config loaded source=%s", loaded.source)
        return loaded.config
    except Exception:
        logger.warning("Failed to load memory config, using defaults", exc_info=True)
        return MemoryConfig()


_STREAM_ACTIVITY_RESULT_MAX_CHARS = 8000

# Module-level cache so TOOL_START / TOOL_END pairs always share the same
# IntermediateStepManager instance (and its _outstanding_start_steps dict).
# Context.get() creates a new Context wrapper on every call, making
# cached_property on Context useless for cross-call caching.
_CACHED_STEP_MANAGER: "object | None" = None


def _get_step_manager():
    """Return a stable IntermediateStepManager for the lifetime of the process.

    NAT's ContextState is a Singleton, so one shared manager is correct.
    """
    global _CACHED_STEP_MANAGER
    if _CACHED_STEP_MANAGER is None:
        from nat.builder.context import Context  # noqa: PLC0415

        _CACHED_STEP_MANAGER = Context.get().intermediate_step_manager
    return _CACHED_STEP_MANAGER


def _emit_stream_activity(activity) -> None:
    """Push a StreamActivity payload through NAT's intermediate_step_manager
    so the FastAPI front-end serializes it into an intermediate_data: SSE
    line that ui-cognitive/lib/nat-client.ts consumes as an activity event.

    Swallows push errors silently — tool lifecycle visibility must never
    break the streaming response.
    """
    try:
        from nat.data_models.intermediate_step import (  # noqa: PLC0415
            IntermediateStepPayload,
            IntermediateStepType,
            StreamEventData,
        )

        payload = activity.payload
        kind = payload.get("type")
        if kind == "tool_start":
            step_type = IntermediateStepType.TOOL_START
            data = StreamEventData(input=payload.get("tool_args"))
        elif kind == "tool_end":
            step_type = IntermediateStepType.TOOL_END
            data = StreamEventData(output=payload.get("tool_result"))
        elif kind == "task_complete":
            # CUSTOM_END requires a prior CUSTOM_START to satisfy NAT's span tracking.
            # Emit START immediately before END so both reach subscribers.
            tc_meta = {"success": payload.get("success", True)}
            tc_data = StreamEventData()
            start_step = IntermediateStepPayload(
                event_type=IntermediateStepType.CUSTOM_START,
                name="task_complete",
                data=tc_data,
                metadata=tc_meta,
            )
            mgr = _get_step_manager()
            mgr.push_intermediate_step(start_step)
            end_step = IntermediateStepPayload(
                event_type=IntermediateStepType.CUSTOM_END,
                name="task_complete",
                data=tc_data,
                metadata=tc_meta,
                UUID=start_step.UUID,
            )
            mgr.push_intermediate_step(end_step)
            return
        else:
            return

        if payload.get("mode"):
            metadata: dict | None = {"mode": payload.get("mode")}
        else:
            metadata = None

        kwargs = dict(
            event_type=step_type,
            name=payload.get("name") or "tool",
            data=data,
            metadata=metadata,
        )
        if payload.get("uuid"):
            kwargs["UUID"] = payload["uuid"]
        _get_step_manager().push_intermediate_step(IntermediateStepPayload(**kwargs))
    except Exception:  # noqa: BLE001 — observability must not break the stream
        logger.debug("%s failed to emit stream activity", AGENT_LOG_PREFIX, exc_info=True)


class StreamToken:
    """Discriminator for a token-level streaming event emitted by the graph helper."""

    __slots__ = ("chunk",)

    def __init__(self, chunk: ChatResponseChunk) -> None:
        self.chunk = chunk


class StreamActivity:
    """Discriminator for a tool-lifecycle streaming event emitted by the graph helper."""

    __slots__ = ("payload",)

    def __init__(self, payload: dict) -> None:
        self.payload = payload


async def _stream_graph_events(
    graph,
    *,
    state,
    config,
    content_so_far: str,
    chunk_id: str,
    created,
    model_name: str,
    mode: str,
    per_tool_max_chars: "dict[str, int] | None" = None,
):
    """Consume graph.astream_events(version='v2') and yield StreamToken /
    StreamActivity items.

    - on_chat_model_stream -> StreamToken (per-LLM-token ChatResponseChunk)
    - on_tool_start        -> StreamActivity (tool lifecycle payload)
    - on_tool_end          -> StreamActivity (tool lifecycle payload, truncated)
    - other events         -> filtered

    Exceptions raised by astream_events propagate so _classify_failure in the
    caller can apply the existing retry/fallback policies.
    """
    async for event in graph.astream_events(state, config=config, version="v2"):
        ev_type = event.get("event")
        if ev_type == "on_chat_model_stream":
            data = event.get("data") or {}
            chunk = data.get("chunk")
            token = getattr(chunk, "content", None) if chunk is not None else None
            if not token or not isinstance(token, str):
                continue
            yield StreamToken(
                ChatResponseChunk.create_streaming_chunk(
                    content=token,
                    id_=chunk_id,
                    created=created,
                    model=model_name,
                    role=UserMessageContentRoleType.ASSISTANT,
                )
            )
        elif ev_type == "on_tool_start":
            data = event.get("data") or {}
            tool_name = event.get("name") or "tool"
            import uuid as _uuid
            run_id = str(event.get("run_id") or _uuid.uuid4())
            yield StreamActivity(
                {
                    "type": "tool_start",
                    "name": tool_name,
                    "tool_args": data.get("input") or {},
                    "mode": mode,
                    "uuid": run_id,
                }
            )
        elif ev_type == "on_tool_end":
            data = event.get("data") or {}
            raw_output = data.get("output")
            result_text = (
                raw_output if isinstance(raw_output, str) else str(raw_output)
            )
            tool_name_end = event.get("name") or "tool"
            _overrides = _TOOL_GUARD_OVERRIDES.get() or {}
            _effective = dict(per_tool_max_chars or {})
            _effective.update(_overrides)
            _tool_cap = _effective.get(tool_name_end, _STREAM_ACTIVITY_RESULT_MAX_CHARS)
            if len(result_text) > _tool_cap:
                result_text = (
                    result_text[:_tool_cap]
                    + f"... [truncated, {len(result_text)} chars total]"
                )
            import uuid as _uuid
            run_id = str(event.get("run_id") or _uuid.uuid4())
            yield StreamActivity(
                {
                    "type": "tool_end",
                    "name": event.get("name") or "tool",
                    "tool_result": result_text,
                    "mode": mode,
                    "uuid": run_id,
                }
            )
        # Other event types (on_chain_*, on_chat_model_start/end) are filtered.


async def _stream_and_accumulate(agent, messages, config):
    """Invoke the agent via astream() and accumulate AIMessageChunks into a
    single AIMessage. Using astream() instead of ainvoke() lets the LangChain
    callback chain emit on_chat_model_stream events, which the outer
    astream_events(version="v2") loop surfaces as token-level SSE chunks.

    Falls back to ainvoke() if the agent/LLM does not yield any stream
    chunks — keeps the non-streaming path functional for unusual runnables.
    """
    merged: AIMessageChunk | None = None
    async for chunk in agent.astream({"messages": messages}, config=config):
        if merged is None:
            merged = chunk
        else:
            merged = merged + chunk  # AIMessageChunk supports __add__
    if merged is None:
        return await agent.ainvoke({"messages": messages}, config=config)
    tool_calls = getattr(merged, "tool_calls", None) or []
    additional_kwargs = dict(getattr(merged, "additional_kwargs", {}) or {})
    return AIMessage(
        content=merged.content,
        tool_calls=tool_calls,
        additional_kwargs=additional_kwargs,
    )


class SafeToolCallAgentGraph(ToolCallAgentGraph):
    """Tool-calling graph that enforces timeout on tool node execution."""

    def __init__(
        self,
        *args,
        tool_call_timeout_seconds: int = 900,
        tool_output_guard_max_chars: int = 30000,
        per_tool_max_chars: dict[str, int] | None = None,
        tool_loop_guard_threshold: int = 2,
        max_parallel_tool_calls: int = 3,
        max_tool_calls_per_request: dict[str, int] | None = None,
        subagent_recovery_escalation_budget: dict[str, dict[str, int]] | None = None,
        mode_name: str = "analyze",
        summary_llm: object | None = None,
        compaction_config: WorkingMemoryConfig | None = None,
        _checkpointer: object | None = None,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        self._checkpointer = _checkpointer
        self.tool_call_timeout_seconds = tool_call_timeout_seconds
        self.tool_output_guard_max_chars = tool_output_guard_max_chars
        self.per_tool_max_chars: dict[str, int] = per_tool_max_chars or {
            "directory_tree": 5000,
            "fs_tools__directory_tree": 5000,
        }
        self.tool_loop_guard_threshold = tool_loop_guard_threshold
        self.max_parallel_tool_calls = max_parallel_tool_calls
        self.max_tool_calls_per_request = max_tool_calls_per_request or {}
        self.subagent_recovery_escalation_budget = subagent_recovery_escalation_budget or {}
        self.mode_name = mode_name
        self.summary_llm = summary_llm
        self.compaction_config: WorkingMemoryConfig = compaction_config or WorkingMemoryConfig()
        # Start at max so the first eligible call can compact immediately.
        # After each compaction the counter resets to 0 and must reach the
        # threshold again before the next compaction fires.
        self._compaction_cooldown_counter: int = self.compaction_config.compaction_cooldown_messages
        # Request-scoped set of NAT function IDs known to be in DEGRADED state.
        self._degraded_function_ids: set[str] = set()

    async def _build_graph(self, state_schema: type):
        """Override NAT's _build_graph to inject checkpointer for HITL interrupt support."""
        from langgraph.graph import StateGraph
        from nat.agent.dual_node import AgentDecision

        graph = StateGraph(state_schema)
        graph.add_node("agent", self.agent_node)
        graph.add_node("tool", self.tool_node)
        graph.add_edge("tool", "agent")
        graph.add_conditional_edges(
            "agent",
            self.conditional_edge,
            {AgentDecision.TOOL: "tool", AgentDecision.END: "__end__"},
        )
        graph.set_entry_point("agent")
        self.graph = graph.compile(checkpointer=self._checkpointer)
        return self.graph

    async def agent_node(self, state: ToolCallAgentGraphState):
        if len(state.messages) == 0:
            raise RuntimeError('No input received in state: "messages"')

        # --- Mid-loop context compaction ------------------------------------
        if (
            self.summary_llm is not None
            and self._compaction_cooldown_counter
            >= self.compaction_config.compaction_cooldown_messages
            and should_compact(state.messages, self.compaction_config)
        ):
            messages_before = len(state.messages)
            chars_before = sum(len(str(getattr(m, "content", ""))) for m in state.messages)
            try:
                compacted = await compress_state(
                    state.messages, self.summary_llm, self.compaction_config
                )
                if compacted is not state.messages:
                    state.messages[:] = compacted
                    _emit_trace_event(
                        "context_compacted",
                        {
                            "mode": self.mode_name,
                            "messages_before": messages_before,
                            "messages_after": len(state.messages),
                            "chars_before": chars_before,
                        },
                    )
                    self._compaction_cooldown_counter = 0
            except Exception:
                logger.warning(
                    "%s Mid-loop compaction failed, continuing without compression",
                    AGENT_LOG_PREFIX,
                    exc_info=True,
                )
        else:
            self._compaction_cooldown_counter += 1

        base_config = ensure_config()
        runtime_config = RunnableConfig(
            callbacks=self.callbacks,
            configurable={"__pregel_runtime": "threadpool"},
        )
        merged_config = merge_configs(base_config, runtime_config)

        try:
            response = await _stream_and_accumulate(
                self.agent, state.messages, merged_config
            )
        except Exception as agent_ex:  # noqa: BLE001
            failure_class = _classify_failure(agent_ex)
            if failure_class is FailureClass.TOOL_CALL_ID_MISMATCH:
                from cognitive_code_agent.memory.working import repair_message_history

                repaired, was_changed = repair_message_history(state.messages)
                if was_changed:
                    _emit_trace_event(
                        "tool_call_id_mismatch_repair",
                        {
                            "mode": self.mode_name,
                            "messages_before": len(state.messages),
                            "messages_after": len(repaired),
                            "action": "repair_and_retry",
                        },
                    )
                    state.messages[:] = repaired
                    try:
                        response = await _stream_and_accumulate(
                            self.agent, state.messages, merged_config
                        )
                    except Exception:  # noqa: BLE001
                        raise agent_ex
                else:
                    raise
            else:
                raise

        state.messages.append(response)
        last_message = state.messages[-1]
        content = str(last_message.content)
        sanitized = strip_think_blocks(content)
        if sanitized != content:
            state.messages[-1] = AIMessage(
                content=sanitized,
                tool_calls=getattr(last_message, "tool_calls", None),
            )
        # Normalize tool_call IDs in the graph state so downstream nodes
        # (tool_node) and the next model call all see consistent IDs.
        _normalize_tool_call_ids(state)
        return state

    async def tool_node(self, state: ToolCallAgentGraphState):
        _normalize_tool_call_ids(state)
        _deduplicate_tool_calls(state)
        _apply_write_mode_guard(state, mode_name=self.mode_name)
        parallel_blocked, deferred_tool_messages = _apply_parallel_tool_cap(
            state,
            max_parallel_tool_calls=self.max_parallel_tool_calls,
            mode_name=self.mode_name,
        )
        total_blocked = _apply_tool_total_limit(
            state,
            max_calls_per_request=self.max_tool_calls_per_request,
            mode_name=self.mode_name,
        )
        loop_blocked = _apply_tool_loop_guard(
            state,
            threshold=self.tool_loop_guard_threshold,
            mode_name=self.mode_name,
        )
        last_ai_with_calls = next(
            (
                msg
                for msg in reversed(state.messages)
                if isinstance(msg, AIMessage) and getattr(msg, "tool_calls", None) is not None
            ),
            None,
        )
        remaining_calls = getattr(last_ai_with_calls, "tool_calls", None) or []
        blocked = parallel_blocked + total_blocked + loop_blocked
        if blocked > 0 and not remaining_calls:
            _emit_trace_event(
                "guardrail_non_terminating_replan",
                {
                    "mode": self.mode_name,
                    "blocked_calls": blocked,
                    "remaining_calls": 0,
                    "action": "return_to_model_for_replan",
                },
            )
            return state
        try:
            result = await asyncio.wait_for(
                super().tool_node(state), timeout=self.tool_call_timeout_seconds
            )
            _guard_tool_outputs(
                result,
                max_chars=self.tool_output_guard_max_chars,
                per_tool_max_chars=self.per_tool_max_chars,
            )
            _normalize_nested_subagent_failures(
                result,
                mode_name=self.mode_name,
                escalation_budget=self.subagent_recovery_escalation_budget,
            )
            if deferred_tool_messages:
                result.messages.extend(deferred_tool_messages)
            return result
        except (TimeoutError, asyncio.TimeoutError):
            failure_class = FailureClass.TOOL_TIMEOUT
            policy = FAILURE_POLICIES[failure_class]
            _emit_trace_event(
                "fallback_activated",
                {
                    "reason": failure_class.value,
                    "action": policy.action,
                    "mode": self.mode_name,
                },
            )
            logger.error(
                "%s Tool node timed out after %ss",
                AGENT_LOG_PREFIX,
                self.tool_call_timeout_seconds,
            )
            tool_calls = getattr(state.messages[-1], "tool_calls", []) or []
            for call in tool_calls:
                tool_name = call.get("name", "unknown_tool")
                state.messages += [
                    ToolMessage(
                        name=tool_name,
                        tool_call_id=call.get("id", tool_name),
                        status="error",
                        content=(
                            f"Tool call timed out after {self.tool_call_timeout_seconds}s: {tool_name}"
                        ),
                    )
                ]
            return state


class ModeConfig:
    """Per-mode overrides for LLM, tools, prompt, and execution budget."""

    __slots__ = (
        "llm_name",
        "switchable_models",
        "tool_names",
        "prompt_path",
        "max_iterations",
        "max_history",
        "tool_call_timeout_seconds",
        "tool_loop_guard_threshold",
        "max_parallel_tool_calls",
        "max_tool_calls_per_request",
        "subagent_recovery_escalation_budget",
        "hitl_enabled",
        "checkpointer_backend",
        "interrupt_timeout_seconds",
        "max_recovery_rounds",
    )

    def __init__(
        self,
        *,
        llm_name: str,
        switchable_models: list[str] | None = None,
        tool_names: list[str],
        prompt_path: str,
        max_iterations: int = 40,
        max_history: int = 8,
        tool_call_timeout_seconds: int = 900,
        tool_loop_guard_threshold: int = 2,
        max_parallel_tool_calls: int = 3,
        max_tool_calls_per_request: dict[str, int] | None = None,
        subagent_recovery_escalation_budget: dict[str, dict[str, int]] | None = None,
        hitl_enabled: bool = False,
        checkpointer_backend: str = "memory",
        interrupt_timeout_seconds: int = 120,
        max_recovery_rounds: int = 3,
    ):
        self.llm_name = llm_name
        self.switchable_models: list[str] = switchable_models or []
        self.tool_names = tool_names
        self.prompt_path = prompt_path
        self.max_iterations = max_iterations
        self.max_history = max_history
        self.tool_call_timeout_seconds = tool_call_timeout_seconds
        self.tool_loop_guard_threshold = tool_loop_guard_threshold
        self.max_parallel_tool_calls = max_parallel_tool_calls
        self.max_tool_calls_per_request = max_tool_calls_per_request or {}
        self.subagent_recovery_escalation_budget = subagent_recovery_escalation_budget or {}
        self.hitl_enabled = hitl_enabled
        self.checkpointer_backend = checkpointer_backend
        self.interrupt_timeout_seconds = interrupt_timeout_seconds
        self.max_recovery_rounds = max_recovery_rounds

    @classmethod
    def from_dict(cls, data: dict) -> "ModeConfig":
        return cls(
            llm_name=data["llm_name"],
            switchable_models=data.get("switchable_models", []),
            tool_names=data.get("tool_names", []),
            prompt_path=data.get("prompt_path", ""),
            max_iterations=data.get("max_iterations", 40),
            max_history=data.get("max_history", 8),
            tool_call_timeout_seconds=data.get("tool_call_timeout_seconds", 900),
            tool_loop_guard_threshold=data.get("tool_loop_guard_threshold", 2),
            max_parallel_tool_calls=data.get("max_parallel_tool_calls", 3),
            max_tool_calls_per_request=data.get("max_tool_calls_per_request", {}),
            subagent_recovery_escalation_budget=data.get("subagent_recovery_escalation_budget", {}),
            hitl_enabled=data.get("hitl_enabled", False),
            checkpointer_backend=data.get("checkpointer_backend", "memory"),
            interrupt_timeout_seconds=data.get("interrupt_timeout_seconds", 120),
            max_recovery_rounds=data.get("max_recovery_rounds", 3),
        )


class _ModeRuntime:
    """Pre-built runtime for a single execution mode."""

    __slots__ = (
        "graph",
        "llm",
        "model_name",
        "tool_names",
        "max_iterations",
        "max_history",
        "tool_call_timeout_seconds",
        "tool_loop_guard_threshold",
        "max_parallel_tool_calls",
        "max_tool_calls_per_request",
        "per_tool_max_chars",
        "subagent_recovery_escalation_budget",
        "prompt_path",
        "max_recovery_rounds",
    )

    def __init__(
        self,
        *,
        graph: object,
        llm: object,
        model_name: str,
        tool_names: list[str],
        max_iterations: int,
        max_history: int,
        tool_call_timeout_seconds: int,
        tool_loop_guard_threshold: int,
        max_parallel_tool_calls: int,
        max_tool_calls_per_request: dict[str, int],
        per_tool_max_chars: dict[str, int],
        subagent_recovery_escalation_budget: dict[str, dict[str, int]],
        prompt_path: str,
        max_recovery_rounds: int = 3,
    ):
        self.graph = graph
        self.llm = llm
        self.model_name = model_name
        self.tool_names = tool_names
        self.max_iterations = max_iterations
        self.max_history = max_history
        self.tool_call_timeout_seconds = tool_call_timeout_seconds
        self.tool_loop_guard_threshold = tool_loop_guard_threshold
        self.max_parallel_tool_calls = max_parallel_tool_calls
        self.max_tool_calls_per_request = max_tool_calls_per_request
        self.per_tool_max_chars = per_tool_max_chars
        self.subagent_recovery_escalation_budget = subagent_recovery_escalation_budget
        self.prompt_path = prompt_path
        self.max_recovery_rounds = max_recovery_rounds


class SafeToolCallAgentWorkflowConfig(
    ToolCallAgentWorkflowConfig,
    name="safe_tool_calling_agent",
):
    """Tool-calling workflow config with timeout, modes, and recursion safeguards."""

    tool_call_timeout_seconds: int = Field(
        default=900,
        ge=5,
        le=900,
        description="Timeout in seconds for each tool call.",
    )
    tool_output_guard_max_chars: int = Field(
        default=30000,
        ge=1000,
        description="Maximum characters per tool output before truncation.",
    )
    per_tool_max_chars: dict[str, int] = Field(
        default_factory=lambda: {
            "directory_tree": 5000,
            "fs_tools__directory_tree": 5000,
        },
        description="Per-tool char limits that override the global tool_output_guard_max_chars.",
    )
    tool_loop_guard_threshold: int = Field(
        default=2,
        ge=1,
        le=10,
        description="Maximum equivalent tool-call repeats before loop guard blocks execution.",
    )
    max_parallel_tool_calls: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Maximum number of tool calls executed in parallel per turn.",
    )
    max_tool_calls_per_request: dict[str, int] = Field(
        default_factory=dict,
        description="Per-tool total call limits within a single request.",
    )
    subagent_recovery_escalation_budget: dict[str, dict[str, int]] = Field(
        default_factory=dict,
        description="Per-subagent recovery escalation budget by failure class.",
    )
    prompt_base_path: str = Field(
        default="src/cognitive_code_agent/prompts/system/base.md",
        description="Repository path to the base system prompt markdown file.",
    )
    skill_registry_path: str = Field(
        default="src/cognitive_code_agent/prompts/skills/registry.yml",
        description="Repository path to runtime skill registry YAML file.",
    )
    max_active_skills: int = Field(
        default=2,
        ge=1,
        le=5,
        description="Maximum number of skill modules to activate for one request.",
    )
    default_mode: str = Field(
        default="analyze",
        description="Mode used when no /mode prefix is detected.",
    )
    modes: dict = Field(
        default_factory=dict,
        description="Per-mode overrides: {mode_name: {llm_name, tool_names, prompt_path, ...}}",
    )


async def _build_mode_runtime(
    *,
    mode_name: str,
    mode_cfg: ModeConfig,
    builder: Builder,
    base_config: SafeToolCallAgentWorkflowConfig,
    summary_llm: object | None = None,
    compaction_config: WorkingMemoryConfig | None = None,
    temp_override: float | None = None,
) -> _ModeRuntime:
    """Build a pre-compiled graph for a single execution mode."""
    prompt_text = load_base_prompt(mode_cfg.prompt_path)
    runtime_config = base_config.model_copy(
        update={
            "system_prompt": prompt_text,
            "llm_name": mode_cfg.llm_name,
            "tool_names": mode_cfg.tool_names,
            "max_iterations": mode_cfg.max_iterations,
            "max_history": mode_cfg.max_history,
            "tool_loop_guard_threshold": mode_cfg.tool_loop_guard_threshold,
            "max_parallel_tool_calls": mode_cfg.max_parallel_tool_calls,
            "max_tool_calls_per_request": mode_cfg.max_tool_calls_per_request,
            "subagent_recovery_escalation_budget": mode_cfg.subagent_recovery_escalation_budget,
        }
    )
    prompt = create_tool_calling_agent_prompt(runtime_config)
    llm = await builder.get_llm(mode_cfg.llm_name, wrapper_type=LLMFrameworkEnum.LANGCHAIN)
    if temp_override is not None and hasattr(llm, "bind"):
        llm = llm.bind(temperature=temp_override)
    tools = await builder.get_tools(
        tool_names=mode_cfg.tool_names, wrapper_type=LLMFrameworkEnum.LANGCHAIN
    )
    if not tools:
        raise ValueError(f"No tools for mode '{mode_name}' (llm={mode_cfg.llm_name})")

    return_direct_tools = (
        await builder.get_tools(
            tool_names=runtime_config.return_direct, wrapper_type=LLMFrameworkEnum.LANGCHAIN
        )
        if runtime_config.return_direct
        else None
    )

    # Create checkpointer for HITL interrupt support when enabled
    checkpointer = None
    if mode_cfg.hitl_enabled:
        backend = mode_cfg.checkpointer_backend
        if backend == "sqlite":
            from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

            checkpointer = AsyncSqliteSaver.from_conn_string(":memory:")
        else:
            from langgraph.checkpoint.memory import MemorySaver

            checkpointer = MemorySaver()
        logger.info(
            "%s HITL enabled for mode '%s' (checkpointer=%s)",
            AGENT_LOG_PREFIX,
            mode_name,
            backend,
        )

    graph = await SafeToolCallAgentGraph(
        llm=llm,
        tools=tools,
        prompt=prompt,
        detailed_logs=runtime_config.verbose,
        log_response_max_chars=runtime_config.log_response_max_chars,
        handle_tool_errors=runtime_config.handle_tool_errors,
        return_direct=return_direct_tools,
        tool_call_timeout_seconds=mode_cfg.tool_call_timeout_seconds,
        tool_output_guard_max_chars=base_config.tool_output_guard_max_chars,
        per_tool_max_chars=dict(base_config.per_tool_max_chars),
        tool_loop_guard_threshold=mode_cfg.tool_loop_guard_threshold,
        max_parallel_tool_calls=mode_cfg.max_parallel_tool_calls,
        max_tool_calls_per_request=mode_cfg.max_tool_calls_per_request,
        subagent_recovery_escalation_budget=mode_cfg.subagent_recovery_escalation_budget,
        mode_name=mode_name,
        summary_llm=summary_llm,
        compaction_config=compaction_config,
        _checkpointer=checkpointer,
    ).build_graph()

    logger.info(
        "%s Built mode '%s': llm=%s, tools=%d, max_iter=%d",
        AGENT_LOG_PREFIX,
        mode_name,
        mode_cfg.llm_name,
        len(tools),
        mode_cfg.max_iterations,
    )

    return _ModeRuntime(
        graph=graph,
        llm=llm,
        model_name=mode_cfg.llm_name,
        tool_names=[t.name for t in tools],
        max_iterations=mode_cfg.max_iterations,
        max_history=mode_cfg.max_history,
        tool_call_timeout_seconds=mode_cfg.tool_call_timeout_seconds,
        tool_loop_guard_threshold=mode_cfg.tool_loop_guard_threshold,
        max_parallel_tool_calls=mode_cfg.max_parallel_tool_calls,
        max_tool_calls_per_request=mode_cfg.max_tool_calls_per_request,
        per_tool_max_chars=dict(base_config.per_tool_max_chars),
        subagent_recovery_escalation_budget=mode_cfg.subagent_recovery_escalation_budget,
        prompt_path=mode_cfg.prompt_path,
        max_recovery_rounds=mode_cfg.max_recovery_rounds,
    )


@register_function(
    config_type=SafeToolCallAgentWorkflowConfig,
    framework_wrappers=[LLMFrameworkEnum.LANGCHAIN],
)
async def safe_tool_calling_agent_workflow(
    config: SafeToolCallAgentWorkflowConfig, builder: Builder
):
    memory_config = _load_memory_config()

    # --- Resolve summary LLM for mid-loop compaction (task 4.1) ------------
    summary_llm: object | None = None
    if memory_config.working.summary_llm_name:
        try:
            summary_llm = await builder.get_llm(
                memory_config.working.summary_llm_name,
                wrapper_type=LLMFrameworkEnum.LANGCHAIN,
            )
            logger.info(
                "%s summary_llm resolved: %s",
                AGENT_LOG_PREFIX,
                memory_config.working.summary_llm_name,
            )
        except Exception:
            logger.warning(
                "%s Failed to resolve summary_llm '%s', compaction disabled",
                AGENT_LOG_PREFIX,
                memory_config.working.summary_llm_name,
                exc_info=True,
            )

    # --- Build mode runtimes ------------------------------------------------
    # Runtimes are indexed by (mode, model_key, temperature_preset) to allow
    # per-request model and temperature selection without rebuilding graphs.
    # If explicit modes are configured, build one graph per (mode, model, preset)
    # combination. Otherwise fall back to a single-mode setup using the top-level
    # config (backward compatible with pre-modes config).
    mode_runtimes: dict[tuple[str, str, str], _ModeRuntime] = {}
    # Legacy flat lookup for mode resolution checks (mode → default key)
    _mode_default_key: dict[str, tuple[str, str, str]] = {}

    async def _build_and_register(
        mode_name: str,
        model_key: str,
        temp_preset: str,
        mode_cfg: "ModeConfig",
        temp_override: float | None = None,
    ) -> None:
        """Build a single (mode, model, preset) runtime and register it. Errors are logged, not raised."""
        import copy as _copy

        cfg_for_build = _copy.copy(mode_cfg)
        if temp_override is not None:
            cfg_for_build = ModeConfig(
                llm_name=model_key,
                switchable_models=mode_cfg.switchable_models,
                tool_names=mode_cfg.tool_names,
                prompt_path=mode_cfg.prompt_path,
                max_iterations=mode_cfg.max_iterations,
                max_history=mode_cfg.max_history,
                tool_call_timeout_seconds=mode_cfg.tool_call_timeout_seconds,
                tool_loop_guard_threshold=mode_cfg.tool_loop_guard_threshold,
                max_parallel_tool_calls=mode_cfg.max_parallel_tool_calls,
                max_tool_calls_per_request=mode_cfg.max_tool_calls_per_request,
                subagent_recovery_escalation_budget=mode_cfg.subagent_recovery_escalation_budget,
                hitl_enabled=mode_cfg.hitl_enabled,
                checkpointer_backend=mode_cfg.checkpointer_backend,
                interrupt_timeout_seconds=mode_cfg.interrupt_timeout_seconds,
            )
        else:
            cfg_for_build = ModeConfig(
                llm_name=model_key,
                switchable_models=mode_cfg.switchable_models,
                tool_names=mode_cfg.tool_names,
                prompt_path=mode_cfg.prompt_path,
                max_iterations=mode_cfg.max_iterations,
                max_history=mode_cfg.max_history,
                tool_call_timeout_seconds=mode_cfg.tool_call_timeout_seconds,
                tool_loop_guard_threshold=mode_cfg.tool_loop_guard_threshold,
                max_parallel_tool_calls=mode_cfg.max_parallel_tool_calls,
                max_tool_calls_per_request=mode_cfg.max_tool_calls_per_request,
                subagent_recovery_escalation_budget=mode_cfg.subagent_recovery_escalation_budget,
                hitl_enabled=mode_cfg.hitl_enabled,
                checkpointer_backend=mode_cfg.checkpointer_backend,
                interrupt_timeout_seconds=mode_cfg.interrupt_timeout_seconds,
            )
        key = _resolve_runtime_key(mode_name, model_key, temp_preset)
        try:
            rt = await _build_mode_runtime(
                mode_name=mode_name,
                mode_cfg=cfg_for_build,
                builder=builder,
                base_config=config,
                summary_llm=summary_llm,
                compaction_config=memory_config.working,
                temp_override=temp_override,
            )
            mode_runtimes[key] = rt
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "%s Failed to build runtime for (%s, %s, %s): %s — skipping",
                AGENT_LOG_PREFIX,
                mode_name,
                model_key,
                temp_preset,
                exc,
            )

    if config.modes:
        build_tasks = []
        for mode_name, mode_raw in config.modes.items():
            mode_cfg = ModeConfig.from_dict(mode_raw) if isinstance(mode_raw, dict) else mode_raw
            models_to_build = (
                mode_cfg.switchable_models if mode_cfg.switchable_models else [mode_cfg.llm_name]
            )
            for model_key in models_to_build:
                for preset, temp_val in TEMPERATURE_PRESETS.items():
                    build_tasks.append(
                        _build_and_register(
                            mode_name, model_key, preset, mode_cfg, temp_override=temp_val
                        )
                    )
            # Record the default key for this mode
            _mode_default_key[mode_name] = _resolve_runtime_key(
                mode_name, mode_cfg.llm_name, "medium"
            )

        await asyncio.gather(*build_tasks)
    else:
        # Single-mode fallback: top-level config becomes the "analyze" mode
        fallback_cfg = ModeConfig(
            llm_name=config.llm_name,
            tool_names=config.tool_names,
            prompt_path=config.prompt_base_path,
            max_iterations=config.max_iterations,
            max_history=config.max_history,
            tool_call_timeout_seconds=config.tool_call_timeout_seconds,
            tool_loop_guard_threshold=config.tool_loop_guard_threshold,
            max_parallel_tool_calls=config.max_parallel_tool_calls,
            max_tool_calls_per_request=config.max_tool_calls_per_request,
            subagent_recovery_escalation_budget=config.subagent_recovery_escalation_budget,
        )
        for preset, temp_val in TEMPERATURE_PRESETS.items():
            await _build_and_register(
                "analyze", config.llm_name, preset, fallback_cfg, temp_override=temp_val
            )
        _mode_default_key["analyze"] = _resolve_runtime_key("analyze", config.llm_name, "medium")

    default_mode = config.default_mode
    if default_mode not in _mode_default_key:
        default_mode = next(iter(_mode_default_key))
        logger.warning(
            "%s default_mode '%s' not found, falling back to '%s'",
            AGENT_LOG_PREFIX,
            config.default_mode,
            default_mode,
        )

    async def _response_fn(
        chat_request_or_message: ChatRequestOrMessage,
    ) -> Annotated[
        AsyncGenerator[ChatResponseChunk, None], Streaming(convert=_chunks_to_chat_response)
    ]:
        rt: _ModeRuntime | None = None
        state: ToolCallAgentGraphState | None = None
        mode = default_mode
        recursion_cfg: dict[str, int] = {"recursion_limit": (config.max_iterations + 1) * 2}
        try:
            message = GlobalTypeConverter.get().convert(
                chat_request_or_message, to_type=ChatRequest
            )
            raw_messages = [m.model_dump() for m in message.messages]
            last_user_message = ""
            for item in reversed(raw_messages):
                if item.get("role") == "user":
                    last_user_message = str(item.get("content", ""))
                    break

            # --- Tier 0: pre-dispatch intent classification -----------------
            # Runs before explicit mode resolution. Only overrides the mode
            # when no /mode prefix was typed and intent is clearly conversational.
            has_explicit_prefix = _MODE_PREFIX_RE.match(last_user_message) is not None
            tier0_intent = QueryClassifier.classify(last_user_message)
            logger.debug(
                "%s Tier0 classifier: intent=%s, has_prefix=%s",
                AGENT_LOG_PREFIX,
                tier0_intent.value,
                has_explicit_prefix,
            )

            # --- Mode resolution -------------------------------------------
            mode, cleaned_message = resolve_mode(last_user_message, default=default_mode)
            if mode not in _mode_default_key:
                mode = default_mode

            # Override to chat mode when Tier 0 signals conversational intent
            # and the user did not specify an explicit /mode prefix.
            if (
                not has_explicit_prefix
                and tier0_intent is IntentClass.CHAT
                and "chat" in _mode_default_key
            ):
                mode = "chat"
                logger.debug("%s Tier0 override: routing to chat mode", AGENT_LOG_PREFIX)

            # --- Runtime selection (model + temperature preset) -------------
            req_model_key: str = getattr(message, "model", None) or _mode_default_key[mode][1]
            req_temp_preset: str = getattr(message, "temperature_preset", "medium") or "medium"
            runtime_key = _resolve_runtime_key(mode, req_model_key, req_temp_preset)
            if runtime_key not in mode_runtimes:
                fallback_key = _mode_default_key[mode]
                logger.warning(
                    "%s Runtime key %s not found, falling back to %s",
                    AGENT_LOG_PREFIX,
                    runtime_key,
                    fallback_key,
                )
                runtime_key = fallback_key
            rt = mode_runtimes[runtime_key]

            # Replace the user message with the cleaned (prefix-stripped) version
            if cleaned_message != last_user_message:
                for item in reversed(raw_messages):
                    if item.get("role") == "user":
                        item["content"] = cleaned_message
                        break

            logger.info(
                "%s Mode: %s (llm=%s, tools=%d)",
                AGENT_LOG_PREFIX,
                mode,
                rt.model_name,
                len(rt.tool_names),
            )

            # --- Skill activation (suppressed for chat mode) ---------------
            # Use original message (with mode prefix) so trigger words like
            # "refactor" in "/refactor fix alerts" still match.
            if mode not in ("chat", "analyze"):
                active_skill_ids, active_skills_block = build_active_skills_block(
                    user_message=last_user_message,
                    available_tools=rt.tool_names,
                    registry_path=config.skill_registry_path,
                    max_active_skills=config.max_active_skills,
                )
                if active_skills_block:
                    raw_messages.insert(0, {"role": "system", "content": active_skills_block})
                    logger.info(
                        "%s Activated skills for request: %s",
                        AGENT_LOG_PREFIX,
                        ", ".join(active_skill_ids),
                    )

            # --- Auto-retrieval: inject memory context on first message ----
            # Suppressed for chat mode — no value in querying Milvus/Redis for greetings.
            if mode != "chat" and memory_config.auto_retrieval.enabled:
                human_count = sum(1 for m in raw_messages if m.get("role") in ("user", "human"))
                if human_count <= 1 and cleaned_message:
                    memory_block = await _retrieve_memory_context(
                        user_message=cleaned_message,
                        memory_config=memory_config,
                    )
                    if memory_block:
                        raw_messages.insert(0, {"role": "system", "content": memory_block})
                        logger.info("%s Injected memory context block", AGENT_LOG_PREFIX)

            # --- Working memory: summarize evicted messages ----------------
            raw_messages = await prepare_messages_with_summary(
                raw_messages,
                max_history=memory_config.working.max_history,
                llm=rt.llm,
                enabled=memory_config.working.enabled
                and memory_config.working.summarize_on_eviction,
            )

            messages: list[BaseMessage] = trim_messages(
                messages=raw_messages,
                max_tokens=rt.max_history,
                strategy="last",
                token_counter=len,
                start_on="human",
                include_system=True,
            )
            state = ToolCallAgentGraphState(messages=messages)
            content = ""
            model_name = rt.model_name
            chunk_id = f"safe-tool-{mode}-{model_name}"
            created = datetime.datetime.now(datetime.UTC)
            stream_failed = False
            recovery_notes: list[str] = []
            _request_degraded_fn_ids: set[str] = set()

            import uuid as _uuid

            _original_recursion_limit = (rt.max_iterations + 1) * 2
            recursion_cfg: dict = {
                "recursion_limit": _original_recursion_limit,
                "configurable": {"thread_id": str(_uuid.uuid4())},
            }
            _recovery_round = 0
            _recovery_checkpoint = len(state.messages)
            accumulated_usage: dict | None = None

            try:
                async for _item in _stream_graph_events(
                    rt.graph,
                    state=state,
                    config=recursion_cfg,
                    content_so_far=content,
                    chunk_id=chunk_id,
                    created=created,
                    model_name=model_name,
                    mode=mode,
                    per_tool_max_chars=rt.per_tool_max_chars,
                ):
                    if isinstance(_item, StreamToken):
                        _tok = _item.chunk.choices[0].delta.content or ""
                        content += _tok
                        yield _item.chunk
                    elif isinstance(_item, StreamActivity):
                        _emit_stream_activity(_item)
            except Exception as stream_ex:  # noqa: BLE001
                failure_class = _classify_failure(stream_ex)
                policy = FAILURE_POLICIES[failure_class]

                # Transient errors: backoff and retry stream before falling through
                if failure_class in (FailureClass.RATE_LIMITED, FailureClass.SERVER_ERROR):
                    # Context-reduction retry: when a tool output was truncated in the
                    # previous run, halve the per-tool limits and retry once (no delay).
                    # Only attempted once; if it fails, fall through to normal backoff.
                    if failure_class is FailureClass.SERVER_ERROR and _TRUNCATION_OCCURRED.get():
                        reduced = {k: max(500, v // 2) for k, v in rt.per_tool_max_chars.items()}
                        _emit_trace_event(
                            "server_error_context_reduction",
                            {
                                "original_limits": rt.per_tool_max_chars,
                                "reduced_limits": reduced,
                                "mode": mode,
                            },
                        )
                        _TRUNCATION_OCCURRED.set(False)
                        _cr_token = _TOOL_GUARD_OVERRIDES.set(reduced)
                        _cr_succeeded = False
                        try:
                            async for _item in _stream_graph_events(
                                rt.graph,
                                state=state,
                                config=recursion_cfg,
                                content_so_far=content,
                                chunk_id=chunk_id,
                                created=created,
                                model_name=model_name,
                                mode=mode,
                                per_tool_max_chars=rt.per_tool_max_chars,
                            ):
                                if isinstance(_item, StreamToken):
                                    _tok = _item.chunk.choices[0].delta.content or ""
                                    content += _tok
                                    yield _item.chunk
                                elif isinstance(_item, StreamActivity):
                                    _emit_stream_activity(_item)
                            _cr_succeeded = True
                        except Exception:  # noqa: BLE001
                            pass
                        finally:
                            _TOOL_GUARD_OVERRIDES.reset(_cr_token)
                        if _cr_succeeded:
                            # Context-reduction retry succeeded — skip normal backoff
                            pass
                        else:
                            # Fall through to normal backoff loop
                            for attempt in range(_RATE_LIMIT_MAX_RETRIES):
                                delay = _rate_limit_backoff_delay(attempt)
                                _emit_trace_event(
                                    "rate_limit_backoff",
                                    {"attempt": attempt + 1, "delay_s": delay, "mode": mode},
                                )
                                await asyncio.sleep(delay)
                                try:
                                    async for _item in _stream_graph_events(
                                        rt.graph,
                                        state=state,
                                        config=recursion_cfg,
                                        content_so_far=content,
                                        chunk_id=chunk_id,
                                        created=created,
                                        model_name=model_name,
                                        mode=mode,
                                        per_tool_max_chars=rt.per_tool_max_chars,
                                    ):
                                        if isinstance(_item, StreamToken):
                                            _tok = _item.chunk.choices[0].delta.content or ""
                                            content += _tok
                                            yield _item.chunk
                                        elif isinstance(_item, StreamActivity):
                                            _emit_stream_activity(_item)
                                    break
                                except Exception:  # noqa: BLE001
                                    if attempt == _RATE_LIMIT_MAX_RETRIES - 1:
                                        stream_failed = True
                            else:
                                stream_failed = True
                    else:
                        for attempt in range(_RATE_LIMIT_MAX_RETRIES):
                            delay = _rate_limit_backoff_delay(attempt)
                            _emit_trace_event(
                                "rate_limit_backoff",
                                {"attempt": attempt + 1, "delay_s": delay, "mode": mode},
                            )
                            logger.info(
                                "%s Rate limited, backoff %.1fs (attempt %d/%d)",
                                AGENT_LOG_PREFIX,
                                delay,
                                attempt + 1,
                                _RATE_LIMIT_MAX_RETRIES,
                            )
                            await asyncio.sleep(delay)
                            try:
                                async for _item in _stream_graph_events(
                                    rt.graph,
                                    state=state,
                                    config=recursion_cfg,
                                    content_so_far=content,
                                    chunk_id=chunk_id,
                                    created=created,
                                    model_name=model_name,
                                    mode=mode,
                                    per_tool_max_chars=rt.per_tool_max_chars,
                                ):
                                    if isinstance(_item, StreamToken):
                                        _tok = _item.chunk.choices[0].delta.content or ""
                                        content += _tok
                                        yield _item.chunk
                                    elif isinstance(_item, StreamActivity):
                                        _emit_stream_activity(_item)
                                break  # Retry succeeded
                            except Exception:  # noqa: BLE001
                                if attempt == _RATE_LIMIT_MAX_RETRIES - 1:
                                    stream_failed = True
                        else:
                            stream_failed = True
                else:
                    stream_failed = True

                if failure_class is FailureClass.DEGRADED_FUNCTION:
                    fn_id = _extract_degraded_function_id(stream_ex)
                    if fn_id:
                        _request_degraded_fn_ids.add(fn_id)
                    _emit_trace_event(
                        "function_degraded",
                        {
                            "function_id": fn_id,
                            "invoking_path": "stream",
                            "in_process_fallback": False,
                        },
                    )
                note = (
                    _STREAM_FAILURE_RECURSION
                    if failure_class is FailureClass.RECURSION_LIMIT
                    else f"stream_failure:{failure_class.value}"
                )
                recovery_notes.append(note)
                _emit_trace_event(
                    "fallback_activated",
                    {
                        "reason": failure_class.value,
                        "action": policy.action,
                        "mode": mode,
                        "phase": "stream",
                    },
                )
                error_msg = str(stream_ex)
                logger.warning(
                    "%s Streaming path failed, falling back to ainvoke: %s",
                    AGENT_LOG_PREFIX,
                    error_msg,
                )
                if "context length" in error_msg.lower():
                    _emit_trace_event(
                        "context_overflow",
                        {
                            "reason": "context_length_exceeded",
                            "model": model_name,
                            "mode": mode,
                            "error": error_msg[:500],
                        },
                    )

            # Check compact-recoverable before falling through to ainvoke
            _stream_fc = locals().get("failure_class")
            if stream_failed and _stream_fc is not None:
                _stream_has_prog = _measure_progress(state.messages, _recovery_checkpoint)
                if _is_compact_recoverable(_stream_fc, has_progress=_stream_has_prog):
                    raise _RecoverableFailure(_stream_fc)

            if stream_failed or not content:
                # When stream failed with DEGRADED, attempt a single ainvoke probe
                # before giving up — the function may have recovered between attempts.
                if _request_degraded_fn_ids and stream_failed:
                    _degraded_probe_succeeded = False
                    try:
                        _probe_state = _build_recovery_invoke_state(
                            mode=mode,
                            notes=recovery_notes,
                            messages=state.messages,
                            failure_label="degraded_probe",
                        )
                        _probe_result = await rt.graph.ainvoke(_probe_state, config=recursion_cfg)
                        _probe_state_out = ToolCallAgentGraphState(**_probe_result)
                        accumulated_usage = _extract_usage_metadata(_probe_state_out)
                        _probe_msg = _probe_state_out.messages[-1]
                        content = strip_think_blocks(str(_probe_msg.content))
                        content, _dg = _apply_evidence_gate(content, mode=mode)
                        if content:
                            yield ChatResponseChunk.create_streaming_chunk(
                                content=content,
                                id_=chunk_id,
                                created=created,
                                model=model_name,
                                role=UserMessageContentRoleType.ASSISTANT,
                            )
                        _degraded_probe_succeeded = True
                        _emit_trace_event(
                            "degraded_probe_recovered",
                            {
                                "mode": mode,
                                "degraded_function_ids": list(_request_degraded_fn_ids),
                            },
                        )
                    except Exception as probe_ex:  # noqa: BLE001
                        _probe_failure = _classify_failure(probe_ex)
                        _emit_trace_event(
                            "degraded_probe_failed",
                            {
                                "mode": mode,
                                "degraded_function_ids": list(_request_degraded_fn_ids),
                                "probe_failure_class": _probe_failure.value,
                            },
                        )
                        if _probe_failure is FailureClass.DEGRADED_FUNCTION:
                            # Still degraded — emit partial response
                            fallback_msg = _format_structured_partial_response(
                                failure_class=FailureClass.DEGRADED_FUNCTION,
                                blocked_by=[
                                    f"Remote function degraded: {list(_request_degraded_fn_ids)}. "
                                    "Ainvoke probe also failed.",
                                ],
                            )
                            yield ChatResponseChunk.create_streaming_chunk(
                                content=fallback_msg,
                                id_=chunk_id,
                                created=created,
                                model=model_name,
                                role=UserMessageContentRoleType.ASSISTANT,
                            )
                        else:
                            # Different error class — format as ainvoke failure
                            fallback_msg = _format_structured_partial_response(
                                failure_class=_probe_failure,
                                blocked_by=[f"Ainvoke fallback failed: {str(probe_ex)[:200]}"],
                            )
                            yield ChatResponseChunk.create_streaming_chunk(
                                content=fallback_msg,
                                id_=chunk_id,
                                created=created,
                                model=model_name,
                                role=UserMessageContentRoleType.ASSISTANT,
                            )

                    if _degraded_probe_succeeded:
                        pass  # Skip normal ainvoke path; probe already produced output
                    # If probe failed, we already yielded a fallback above
                else:
                    # Choose invoke state: synthesis-only when stream hit recursion limit,
                    # normal recovery state otherwise.
                    _use_synthesis = _STREAM_FAILURE_RECURSION in recovery_notes
                    if _use_synthesis:
                        invoke_state, invoke_cfg = _build_synthesis_invoke_state(
                            mode=mode,
                            messages=state.messages,
                        )
                        _emit_trace_event(
                            "fallback_activated",
                            {
                                "reason": FailureClass.RECURSION_LIMIT.value,
                                "action": "synthesis_only_ainvoke",
                                "mode": mode,
                                "phase": "ainvoke_synthesis",
                                "recursion_limit": invoke_cfg["recursion_limit"],
                            },
                        )
                    else:
                        invoke_cfg = recursion_cfg
                        invoke_state = state
                        if recovery_notes:
                            invoke_state = _build_recovery_invoke_state(
                                mode=mode,
                                notes=recovery_notes,
                                messages=state.messages,
                                failure_label="stream_failure",
                            )

                    # Retry loop with backoff for transient server errors.
                    _ainvoke_succeeded = False
                    _last_invoke_ex: Exception | None = None
                    _last_invoke_failure: FailureClass = FailureClass.UNKNOWN_RUNTIME
                    for _attempt in range(_RATE_LIMIT_MAX_RETRIES):
                        try:
                            result = await rt.graph.ainvoke(invoke_state, config=invoke_cfg)
                            result_state = ToolCallAgentGraphState(**result)
                            accumulated_usage = _extract_usage_metadata(result_state)
                            output_message = result_state.messages[-1]
                            content = strip_think_blocks(str(output_message.content))
                            content, downgraded = _apply_evidence_gate(content, mode=mode)
                            if downgraded > 0:
                                _emit_trace_event(
                                    "fallback_activated",
                                    {
                                        "reason": FailureClass.EVIDENCE_INSUFFICIENT.value,
                                        "action": FAILURE_POLICIES[
                                            FailureClass.EVIDENCE_INSUFFICIENT
                                        ].action,
                                        "mode": mode,
                                        "downgraded_findings": downgraded,
                                    },
                                )
                            if content:
                                yield ChatResponseChunk.create_streaming_chunk(
                                    content=content,
                                    id_=chunk_id,
                                    created=created,
                                    model=model_name,
                                    role=UserMessageContentRoleType.ASSISTANT,
                                )
                            _ainvoke_succeeded = True
                            break
                        except Exception as invoke_ex:  # noqa: BLE001
                            _last_invoke_ex = invoke_ex
                            _last_invoke_failure = _classify_failure(invoke_ex)
                            _emit_trace_event(
                                "fallback_activated",
                                {
                                    "reason": _last_invoke_failure.value,
                                    "action": FAILURE_POLICIES[_last_invoke_failure].action,
                                    "mode": mode,
                                    "phase": "ainvoke",
                                    "attempt": _attempt + 1,
                                },
                            )
                            if _last_invoke_failure is FailureClass.DEGRADED_FUNCTION:
                                fn_id = _extract_degraded_function_id(invoke_ex)
                                if fn_id:
                                    _request_degraded_fn_ids.add(fn_id)
                                _emit_trace_event(
                                    "function_degraded",
                                    {
                                        "function_id": fn_id,
                                        "invoking_path": "ainvoke_fallback",
                                        "in_process_fallback": False,
                                    },
                                )
                            if (
                                _should_retry_ainvoke(_last_invoke_failure)
                                and _attempt < _RATE_LIMIT_MAX_RETRIES - 1
                            ):
                                delay = _rate_limit_backoff_delay(_attempt)
                                _emit_trace_event(
                                    "rate_limit_backoff",
                                    {
                                        "attempt": _attempt + 1,
                                        "delay_s": delay,
                                        "mode": mode,
                                        "phase": "ainvoke_retry",
                                    },
                                )
                                await asyncio.sleep(delay)
                            else:
                                # Non-retryable class or final attempt — stop loop
                                break

                    if not _ainvoke_succeeded and _last_invoke_ex is not None:
                        logger.error(
                            "%s ainvoke fallback also failed: %s",
                            AGENT_LOG_PREFIX,
                            str(_last_invoke_ex),
                        )
                        # Check if compact-and-continue can recover
                        _has_prog = _measure_progress(state.messages, _recovery_checkpoint)
                        if _is_compact_recoverable(_last_invoke_failure, has_progress=_has_prog):
                            raise _RecoverableFailure(_last_invoke_failure)
                        _blocked = [f"Ainvoke fallback failed: {str(_last_invoke_ex)[:200]}"]
                        if _use_synthesis:
                            _blocked.insert(
                                0,
                                "Stream exhausted recursion budget; synthesis-only retry also failed.",
                            )
                        fallback_msg = _format_structured_partial_response(
                            failure_class=_last_invoke_failure
                            if not _use_synthesis
                            else FailureClass.RECURSION_LIMIT,
                            blocked_by=_blocked,
                        )
                        yield ChatResponseChunk.create_streaming_chunk(
                            content=fallback_msg,
                            id_=chunk_id,
                            created=created,
                            model=model_name,
                            role=UserMessageContentRoleType.ASSISTANT,
                        )

            if accumulated_usage:
                prompt_tokens = accumulated_usage["prompt_tokens"]
                completion_tokens = accumulated_usage["completion_tokens"]
                total_tokens = accumulated_usage["total_tokens"]
            else:
                # Fallback: word-count estimation when real metadata unavailable
                prompt_tokens = sum(len(str(msg.content).split()) for msg in message.messages)
                completion_tokens = len(content.split()) if content else 0
                total_tokens = prompt_tokens + completion_tokens
                logger.debug(
                    "%s Token usage: falling back to word-count estimation", AGENT_LOG_PREFIX
                )
            usage = Usage(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
            )

            # Episodic memory: persist session summary (fire-and-forget)
            if memory_config.episodic.enabled:
                _fire_and_forget_session_summary(
                    raw_messages=raw_messages,
                    llm=rt.llm,
                    memory_config=memory_config,
                )

            _emit_trace_event(
                "session_token_usage",
                {
                    "model": model_name,
                    "mode": mode,
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": total_tokens,
                    "estimation": accumulated_usage is None,
                },
            )

            usage_chunk = ChatResponseChunk.create_streaming_chunk(
                content="",
                id_=chunk_id,
                created=created,
                model=model_name,
                finish_reason="stop",
                usage=usage,
            )
            usage_chunk.usage_estimated = accumulated_usage is None
            _emit_stream_activity(StreamActivity({"type": "task_complete", "success": True}))
            yield usage_chunk
        except GraphRecursionError as ex:
            logger.warning("%s Safe Tool Calling hit recursion limit: %s", AGENT_LOG_PREFIX, ex)
            _emit_trace_event(
                "context_overflow",
                {
                    "reason": "recursion_limit",
                    "model": config.llm_name,
                    "mode": default_mode,
                    "max_iterations": config.max_iterations,
                },
            )
            # Treat as _RecoverableFailure so the recovery loop can handle it.
            if rt is not None and state is not None:
                raise _RecoverableFailure(FailureClass.RECURSION_LIMIT) from ex
            # If rt/state unavailable, emit partial directly.
            partial = _format_structured_partial_response(
                failure_class=FailureClass.RECURSION_LIMIT,
                blocked_by=["Graph recursion budget exhausted (no runtime for recovery)."],
            )
            usage = Usage(prompt_tokens=0, completion_tokens=0, total_tokens=0)
            chunk_id = f"safe-tool-{config.llm_name}"
            created = datetime.datetime.now(datetime.UTC)
            yield ChatResponseChunk.create_streaming_chunk(
                content=partial,
                id_=chunk_id,
                created=created,
                model=config.llm_name,
                role=UserMessageContentRoleType.ASSISTANT,
            )
            _emit_stream_activity(StreamActivity({"type": "task_complete", "success": False}))
            yield ChatResponseChunk.create_streaming_chunk(
                content="",
                id_=chunk_id,
                created=created,
                model=config.llm_name,
                finish_reason="stop",
                usage=usage,
            )
        except _RecoverableFailure as rec_ex:
            # --- Compact-and-continue recovery loop --------------------------
            _rec_fc = rec_ex.failure_class
            _has_prog = _measure_progress(state.messages, _recovery_checkpoint)
            while (
                _is_compact_recoverable(_rec_fc, has_progress=_has_prog)
                and _recovery_round < rt.max_recovery_rounds
            ):
                _recovery_round += 1
                retain = _recovery_retain_recent(_recovery_round - 1)
                msgs_before = len(state.messages)
                from cognitive_code_agent.memory.working import compress_state as _compress_r
                from types import SimpleNamespace as _NS

                _comp_cfg = _NS(
                    compaction_retain_recent=retain,
                    compaction_message_threshold=0,
                    compaction_char_threshold=0,
                    summary_max_tokens=400,
                )
                _progress_count = sum(
                    1
                    for m in state.messages[_recovery_checkpoint:]
                    if isinstance(m, ToolMessage)
                    and getattr(m, "status", None) != "error"
                    and len(str(m.content)) > 50
                )
                try:
                    compacted = await _compress_r(state.messages, rt.llm, _comp_cfg)
                    if compacted is not state.messages:
                        state.messages[:] = compacted
                except Exception:  # noqa: BLE001
                    logger.warning(
                        "%s Recovery compaction failed, continuing without compression",
                        AGENT_LOG_PREFIX,
                        exc_info=True,
                    )
                _emit_trace_event(
                    "recovery_round",
                    {
                        "round": _recovery_round,
                        "progress_tool_count": _progress_count,
                        "messages_before_compact": msgs_before,
                        "messages_after_compact": len(state.messages),
                        "retain_recent_used": retain,
                    },
                )
                recursion_cfg["recursion_limit"] = _original_recursion_limit
                recursion_cfg["configurable"]["thread_id"] = str(_uuid.uuid4())
                _recovery_checkpoint = len(state.messages)

                # Re-attempt via ainvoke with fresh budget on compacted state
                _rec_invoke_state = _build_recovery_invoke_state(
                    mode=mode,
                    notes=[f"recovery_round_{_recovery_round}"],
                    messages=state.messages,
                    failure_label=f"compact_continue_r{_recovery_round}",
                )
                try:
                    result = await rt.graph.ainvoke(_rec_invoke_state, config=recursion_cfg)
                    result_state = ToolCallAgentGraphState(**result)
                    accumulated_usage = _extract_usage_metadata(result_state)
                    output_message = result_state.messages[-1]
                    content = strip_think_blocks(str(output_message.content))
                    content, _dg = _apply_evidence_gate(content, mode=mode)
                    if content:
                        yield ChatResponseChunk.create_streaming_chunk(
                            content=content,
                            id_=chunk_id,
                            created=created,
                            model=model_name,
                            role=UserMessageContentRoleType.ASSISTANT,
                        )
                    break  # Recovery succeeded
                except GraphRecursionError:
                    _rec_fc = FailureClass.RECURSION_LIMIT
                    _has_prog = _measure_progress(state.messages, _recovery_checkpoint)
                    continue  # Try another recovery round
                except Exception as rec_invoke_ex:  # noqa: BLE001
                    _rec_fc = _classify_failure(rec_invoke_ex)
                    _has_prog = _measure_progress(state.messages, _recovery_checkpoint)
                    if _is_compact_recoverable(_rec_fc, has_progress=_has_prog):
                        continue  # Try another recovery round
                    break  # Non-recoverable, fall through to synthesis
            else:
                # While condition failed (no progress or max rounds exhausted)
                # → final synthesis attempt
                try:
                    _synth_state, _synth_cfg = _build_synthesis_invoke_state(
                        mode=mode,
                        messages=state.messages,
                    )
                    _emit_trace_event(
                        "fallback_activated",
                        {
                            "reason": _rec_fc.value,
                            "action": "synthesis_only_last_resort",
                            "mode": mode,
                            "phase": "recovery_synthesis",
                            "recovery_rounds_used": _recovery_round,
                        },
                    )
                    _synth_result = await rt.graph.ainvoke(_synth_state, config=_synth_cfg)
                    _synth_out = ToolCallAgentGraphState(**_synth_result)
                    accumulated_usage = _extract_usage_metadata(_synth_out)
                    content = strip_think_blocks(str(_synth_out.messages[-1].content))
                    content, _ = _apply_evidence_gate(content, mode=mode)
                    if content:
                        yield ChatResponseChunk.create_streaming_chunk(
                            content=content,
                            id_=chunk_id,
                            created=created,
                            model=model_name,
                            role=UserMessageContentRoleType.ASSISTANT,
                        )
                except Exception:  # noqa: BLE001
                    fallback_msg = _format_structured_partial_response(
                        failure_class=_rec_fc,
                        blocked_by=[
                            "Recovery loop exhausted and synthesis failed.",
                        ],
                    )
                    _emit_stream_activity(StreamActivity({"type": "task_complete", "success": False}))
                    yield ChatResponseChunk.create_streaming_chunk(
                        content=fallback_msg,
                        id_=chunk_id,
                        created=created,
                        model=model_name,
                        role=UserMessageContentRoleType.ASSISTANT,
                    )
        except Exception as ex:  # noqa: BLE001
            logger.error(
                "%s Safe Tool Calling Agent failed with exception: %s", AGENT_LOG_PREFIX, str(ex)
            )
            _emit_stream_activity(StreamActivity({"type": "task_complete", "success": False}))
            raise

    yield FunctionInfo.from_fn(_response_fn, description=config.description)

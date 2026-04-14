"""Working memory summarization for the cognitive-code-agent.

Provides context compression that summarizes evicted messages before they
are dropped from the sliding window, preserving reasoning continuity
within long sessions.

Also provides mid-loop compaction (compress_state / should_compact) for use
inside LangGraph agent_node to prevent state growth during long executions.
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

CONTEXT_SUMMARY_PREFIX = "[Context Summary]:"


def _emit_trace_event(event_type: str, payload: dict) -> None:
    event = {"event_type": event_type, **payload}
    logger.info("trace_event=%s", json.dumps(event, ensure_ascii=True))


_SUMMARIZE_PROMPT = """Summarize the following conversation messages in at most {max_tokens} tokens.
Focus on: key topics discussed, tools used, repos analyzed, decisions made, and any important findings.
Be concise and factual. Do not add information not present in the messages.

Messages:
{messages_text}

Summary:"""


def _format_messages_for_prompt(messages: list[dict[str, Any]]) -> str:
    """Format message dicts into a readable string for the LLM prompt."""
    parts: list[str] = []
    for msg in messages:
        role = msg.get("role", "unknown")
        content = str(msg.get("content", ""))
        parts.append(f"[{role}]: {content}")
    return "\n".join(parts)


async def summarize_evicted_messages(
    messages: list[dict[str, Any]],
    llm: Any,
    *,
    max_tokens: int = 200,
) -> str:
    """Generate a concise summary of messages about to be evicted.

    Args:
        messages: The message dicts that will be evicted from context.
        llm: An LLM instance with an ``ainvoke(prompt)`` method.
        max_tokens: Maximum token budget for the summary.

    Returns:
        Summary string, or empty string if messages are empty or LLM fails.
    """
    if not messages:
        return ""

    messages_text = _format_messages_for_prompt(messages)
    prompt = _SUMMARIZE_PROMPT.format(max_tokens=max_tokens, messages_text=messages_text)

    try:
        summary = await llm.ainvoke(prompt)
        return str(summary).strip()
    except Exception:
        logger.warning(
            "working_memory: summarization failed, proceeding without summary", exc_info=True
        )
        return ""


async def prepare_messages_with_summary(
    messages: list[dict[str, Any]],
    *,
    max_history: int,
    llm: Any,
    enabled: bool,
) -> list[dict[str, Any]]:
    """Prepare messages for the agent, summarizing evicted context if needed.

    If the number of non-system messages exceeds ``max_history``, the oldest
    messages are summarized and replaced with a single ``[Context Summary]``
    message.  If a summary already exists (cascading), it is included in the
    new summarization input and replaced.

    Args:
        messages: Full list of message dicts (may include system messages).
        max_history: Maximum number of non-system messages to retain.
        llm: An LLM instance with an ``ainvoke(prompt)`` method.
        enabled: Whether summarization is enabled; if False, returns messages unchanged.

    Returns:
        The message list, potentially with evicted messages replaced by a summary.
    """
    if not enabled:
        return messages

    system_msgs = [m for m in messages if m.get("role") == "system"]
    non_system_msgs = [m for m in messages if m.get("role") != "system"]

    if len(non_system_msgs) <= max_history:
        return messages

    existing_summary = ""
    non_system_no_summary: list[dict[str, Any]] = []
    for m in non_system_msgs:
        content = str(m.get("content", ""))
        if content.startswith(CONTEXT_SUMMARY_PREFIX):
            existing_summary = content[len(CONTEXT_SUMMARY_PREFIX) :].strip()
        else:
            non_system_no_summary.append(m)

    retain_count = max_history
    if len(non_system_no_summary) <= retain_count:
        return messages

    evicted = non_system_no_summary[:-retain_count]
    retained = non_system_no_summary[-retain_count:]

    to_summarize: list[dict[str, Any]] = []
    if existing_summary:
        to_summarize.append({"role": "assistant", "content": existing_summary})
    to_summarize.extend(evicted)

    summary = await summarize_evicted_messages(to_summarize, llm)
    if not summary:
        return messages

    summary_msg: dict[str, Any] = {
        "role": "assistant",
        "content": f"{CONTEXT_SUMMARY_PREFIX} {summary}",
    }

    return system_msgs + [summary_msg] + retained


def _get_tool_call_id(message: Any) -> str | None:
    """Return the tool_call_id from a ToolMessage, or None."""
    from langchain_core.messages import ToolMessage

    if isinstance(message, ToolMessage):
        return getattr(message, "tool_call_id", None)
    return None


def _get_tool_call_ids_from_ai(message: Any) -> set[str]:
    """Return the set of tool call IDs declared in an AIMessage's tool_calls."""
    from langchain_core.messages import AIMessage

    if not isinstance(message, AIMessage):
        return set()
    result: set[str] = set()
    for tc in getattr(message, "tool_calls", None) or []:
        cid = tc.get("id") if isinstance(tc, dict) else getattr(tc, "id", None)
        if cid:
            result.add(cid)
    return result


def _find_pair_boundary(messages: list[Any], retain_recent: int) -> int:
    """Find the safe compaction boundary that preserves tool call/result message pairs."""
    from langchain_core.messages import AIMessage, ToolMessage

    n = len(messages)
    naive = n - retain_recent
    min_boundary = max(1, naive - retain_recent * 2)
    boundary = naive

    while boundary > min_boundary:
        if boundary >= n:
            break

        candidate = messages[boundary]
        if isinstance(candidate, ToolMessage):
            tid = getattr(candidate, "tool_call_id", None)
            if tid:
                ai_in_recent = any(
                    tid in _get_tool_call_ids_from_ai(m) for m in messages[boundary:]
                )
                if not ai_in_recent:
                    boundary -= 1
                    continue

        if boundary > 1:
            prev = messages[boundary - 1]
            if isinstance(prev, AIMessage):
                call_ids = _get_tool_call_ids_from_ai(prev)
                if call_ids:
                    result_ids_in_recent = {
                        getattr(m, "tool_call_id", None)
                        for m in messages[boundary:]
                        if isinstance(m, ToolMessage)
                    }
                    if call_ids & result_ids_in_recent:
                        boundary -= 1
                        continue

        break

    return boundary


def repair_message_history(messages: list[Any]) -> tuple[list[Any], bool]:
    """Remove orphaned tool call/result entries from a message list."""
    from langchain_core.messages import AIMessage, ToolMessage

    result_ids: set[str] = set()
    for m in messages:
        tid = _get_tool_call_id(m)
        if tid:
            result_ids.add(tid)

    declared_ids: set[str] = set()
    for m in messages:
        declared_ids |= _get_tool_call_ids_from_ai(m)

    changed = False
    result: list[Any] = []

    for m in messages:
        if isinstance(m, ToolMessage):
            tid = getattr(m, "tool_call_id", None)
            if tid and tid not in declared_ids:
                changed = True
                continue
            result.append(m)
        elif isinstance(m, AIMessage):
            tool_calls = getattr(m, "tool_calls", None) or []
            orphans = [
                tc
                for tc in tool_calls
                if (tc.get("id") if isinstance(tc, dict) else getattr(tc, "id", None))
                not in result_ids
            ]
            if orphans:
                valid = [
                    tc
                    for tc in tool_calls
                    if (tc.get("id") if isinstance(tc, dict) else getattr(tc, "id", None))
                    in result_ids
                ]
                changed = True
                result.append(AIMessage(content=m.content, tool_calls=valid))
            else:
                result.append(m)
        else:
            result.append(m)

    return result, changed


def should_compact(messages: list[Any], config: Any) -> bool:
    """Return True when mid-loop compaction should trigger."""
    if not messages:
        return False
    if len(messages) > config.compaction_message_threshold:
        return True
    total_chars = sum(len(str(getattr(m, "content", ""))) for m in messages)
    return total_chars > config.compaction_char_threshold


async def compress_state(
    messages: list[Any],
    llm: Any,
    config: Any,
) -> list[Any]:
    """Compress LangGraph state by summarizing evictable messages mid-loop."""
    from langchain_core.messages import AIMessage

    if llm is None or not messages:
        return messages

    retain_recent = config.compaction_retain_recent
    if len(messages) <= retain_recent + 1:
        return messages

    anchor = messages[0]

    naive_boundary = len(messages) - retain_recent
    boundary = _find_pair_boundary(messages, retain_recent) if retain_recent > 0 else 1

    if boundary != naive_boundary:
        reason = "tool_result_orphan"
        cap = max(1, naive_boundary - retain_recent * 2)
        if boundary <= cap:
            _emit_trace_event(
                "compaction_boundary_capped",
                {
                    "original": naive_boundary,
                    "capped_at": boundary,
                    "cap": cap,
                },
            )
        else:
            _emit_trace_event(
                "compaction_boundary_adjusted",
                {
                    "original": naive_boundary,
                    "adjusted": boundary,
                    "reason": reason,
                },
            )

    recent = messages[boundary:] if retain_recent > 0 else []
    middle = messages[1:boundary] if retain_recent > 0 else messages[1:]

    if not middle:
        return messages

    error_msgs: list[Any] = []
    compactable: list[Any] = []
    for m in middle:
        if getattr(m, "status", None) == "error":
            error_msgs.append(m)
        else:
            compactable.append(m)

    if not compactable:
        return messages

    as_dicts = [
        {"role": getattr(m, "type", "unknown"), "content": str(getattr(m, "content", ""))}
        for m in compactable
    ]

    summary_text = await summarize_evicted_messages(
        as_dicts, llm, max_tokens=config.summary_max_tokens
    )

    if not summary_text:
        return messages

    summary_msg = AIMessage(content=f"{CONTEXT_SUMMARY_PREFIX} {summary_text}")
    return [anchor, summary_msg, *error_msgs, *recent]

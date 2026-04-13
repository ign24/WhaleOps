"""Judge evaluator that reads from a NAT trace JSONL file or a harness JSONL file.

Extracts real agent interactions from trace events, runs AgentJudgeEvaluator
on each, and prints a formatted report to stdout.

Usage:
    python scripts/run_judge_from_traces.py
    python scripts/run_judge_from_traces.py --traces /path/to/traces.jsonl
    python scripts/run_judge_from_traces.py --input /path/to/harness_run.jsonl
    python scripts/run_judge_from_traces.py --last 10
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

_DIMS = [
    "goal_fulfillment",
    "tool_grounding",
    "output_structure",
    "mode_skill_appropriateness",
    "safety_compliance",
    "conciseness",
]


# ---------------------------------------------------------------------------
# Trace parsing
# ---------------------------------------------------------------------------


def _to_lower(value: object) -> str:
    if isinstance(value, str):
        return value.lower()
    if isinstance(value, (int, float, bool)):
        return str(value).lower()
    return ""


def _pick(event: dict, *keys: str) -> object:
    for key in keys:
        if key in event:
            return event[key]
        # nested payload
        payload = event.get("payload")
        if isinstance(payload, dict) and key in payload:
            return payload[key]
    return None


def _pick_trace_id(event: dict) -> str | None:
    direct = event.get("nat.workflow.run_id")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()
    for key in ("workflow_run_id", "workflowRunId", "trace_id", "traceId"):
        value = _pick(event, key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _pick_timestamp(event: dict) -> float | None:
    for key in ("timestamp", "time", "created_at", "createdAt"):
        value = _pick(event, key)
        if isinstance(value, (int, float)) and value > 0:
            return float(value)
        if isinstance(value, str):
            try:
                import datetime

                return datetime.datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
            except ValueError:
                pass
    return None


def _pick_role(event: dict) -> str | None:
    """Return 'human', 'ai', or None based on event content."""
    role = _to_lower(_pick(event, "role", "message_role"))
    if role in ("human", "user"):
        return "human"
    if role in ("ai", "assistant"):
        return "ai"
    event_type = _to_lower(_pick(event, "event_type", "type"))
    if "human" in event_type or "user_message" in event_type:
        return "human"
    if "ai_message" in event_type or "llm_end" in event_type or "assistant" in event_type:
        return "ai"
    return None


def _pick_content(event: dict) -> str | None:
    for key in ("content", "message", "text", "output"):
        value = _pick(event, key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, dict):
            inner = value.get("content") or value.get("text")
            if isinstance(inner, str) and inner.strip():
                return inner.strip()
    return None


def _pick_tool_name(event: dict) -> str | None:
    for key in ("name", "tool", "tool_name"):
        value = _pick(event, key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _is_tool_event(event: dict) -> bool:
    event_type = _to_lower(_pick(event, "event_type", "type"))
    return "tool" in event_type


def _pick_mode(event: dict) -> str | None:
    mode = _pick(event, "mode", "agent_mode")
    if isinstance(mode, str) and mode.strip():
        return mode.strip()
    return None


def parse_traces(path: str) -> tuple[list[dict], int]:
    """Parse JSONL trace file, returning (samples, skipped_count).

    Each sample has: id, question, agent_response, trajectory (list of dicts), mode.
    Traces without a recoverable question or agent_response are counted as skipped.
    """
    buckets: dict[str, dict] = {}

    with open(path, encoding="utf-8") as fh:
        for raw_line in fh:
            line = raw_line.strip()
            if not line:
                continue
            try:
                event: dict = json.loads(line)
            except json.JSONDecodeError:
                continue

            trace_id = _pick_trace_id(event)
            if not trace_id:
                continue

            if trace_id not in buckets:
                buckets[trace_id] = {
                    "id": trace_id,
                    "first_ts": None,
                    "human_messages": [],
                    "ai_messages": [],
                    "tool_calls": [],
                    "mode": None,
                }

            bucket = buckets[trace_id]

            ts = _pick_timestamp(event)
            if ts is not None and (bucket["first_ts"] is None or ts < bucket["first_ts"]):
                bucket["first_ts"] = ts

            if not bucket["mode"]:
                bucket["mode"] = _pick_mode(event)

            role = _pick_role(event)
            content = _pick_content(event)

            if role == "human" and content:
                bucket["human_messages"].append((ts or 0.0, content))
            elif role == "ai" and content:
                bucket["ai_messages"].append((ts or 0.0, content))
            elif _is_tool_event(event):
                tool_name = _pick_tool_name(event)
                tool_output = _pick_content(event) or ""
                if tool_name:
                    bucket["tool_calls"].append(
                        {
                            "type": "tool_end",
                            "tool": tool_name,
                            "output": tool_output,
                            "ts": ts or 0.0,
                        }
                    )

    samples: list[dict] = []
    skipped = 0

    for trace_id, bucket in buckets.items():
        human_msgs = sorted(bucket["human_messages"], key=lambda x: x[0])
        ai_msgs = sorted(bucket["ai_messages"], key=lambda x: x[0])
        tool_calls = sorted(bucket["tool_calls"], key=lambda x: x["ts"])

        if not human_msgs or not ai_msgs:
            skipped += 1
            continue

        question = human_msgs[0][1]
        agent_response = ai_msgs[-1][1]

        samples.append(
            {
                "id": trace_id,
                "question": question,
                "agent_response": agent_response,
                "trajectory": tool_calls,
                "mode": bucket["mode"] or "analyze",
                "first_ts": bucket["first_ts"] or 0.0,
            }
        )

    return samples, skipped


def parse_harness(path: str) -> tuple[list[dict], int]:
    """Parse a harness JSONL file produced by run_task_harness.py.

    Each line is a record with: question, agent_response, trajectory_raw, mode.
    Returns (samples, skipped_count).
    """
    samples: list[dict] = []
    skipped = 0

    with open(path, encoding="utf-8") as fh:
        for raw_line in fh:
            line = raw_line.strip()
            if not line:
                continue
            try:
                record: dict = json.loads(line)
            except json.JSONDecodeError:
                skipped += 1
                continue

            question = record.get("question") or ""
            agent_response = record.get("agent_response") or ""
            trajectory_raw = record.get("trajectory_raw") or []
            mode = record.get("mode") or "analyze"
            run_id = record.get("run_id") or ""

            if not question or not agent_response:
                skipped += 1
                continue

            samples.append(
                {
                    "id": f"{run_id}:{question[:40]}",
                    "question": question,
                    "agent_response": agent_response,
                    "trajectory": trajectory_raw,
                    "mode": mode,
                    "first_ts": record.get("timestamp") or 0.0,
                }
            )

    return samples, skipped


# ---------------------------------------------------------------------------
# Judge runner
# ---------------------------------------------------------------------------


async def run_judge(samples: list[dict], api_key: str, base_url: str) -> list[dict]:
    from langchain_nvidia_ai_endpoints import ChatNVIDIA

    from cognitive_code_agent.eval.evaluate import AgentJudgeEvaluator
    from nat.eval.evaluator.evaluator_model import EvalInput, EvalInputItem

    llm = ChatNVIDIA(
        model="nvidia/llama-3.3-nemotron-super-49b-v1.5",
        api_key=api_key,
        base_url=base_url,
        temperature=0.1,
        top_p=0.85,
        max_tokens=4096,
    )

    items = [
        EvalInputItem(
            id=s["id"],
            input_obj=s["question"],
            output_obj=s["agent_response"],
            expected_output_obj="",
            full_dataset_entry={"mode": s["mode"], "trajectory_raw": s["trajectory"]},
        )
        for s in samples
    ]
    eval_input = EvalInput(eval_input_items=items)

    evaluator = AgentJudgeEvaluator(llm=llm, max_concurrency=2)
    output = await evaluator.evaluate(eval_input)

    return [
        {
            "id": item.id,
            "score": item.score,
            "reasoning": item.reasoning,
        }
        for item in output.eval_output_items
    ]


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------


def _bar(value: float, max_value: float = 5.0, width: int = 20) -> str:
    filled = int(round((value / max_value) * width))
    filled = max(0, min(width, filled))
    return "█" * filled + "░" * (width - filled)


def print_report(results: list[dict], skipped: int) -> None:
    total = len(results)
    if total == 0:
        print(f"\n0 traces evaluated. Skipped: {skipped}")
        return

    passed = sum(1 for r in results if r["reasoning"].get("pass", False))
    pass_rate = (passed / total) * 100
    avg_score = sum(r["score"] for r in results) / total

    print()
    print("=" * 60)
    print("  CGN-AGENT JUDGE REPORT")
    print("=" * 60)
    print(f"  Evaluated : {total}")
    print(f"  Passed    : {passed} ({pass_rate:.1f}%)")
    print(f"  Failed    : {total - passed} ({100 - pass_rate:.1f}%)")
    print(f"  Avg score : {avg_score:.3f} / 5.0")
    if skipped > 0:
        print(f"  Skipped   : {skipped} (incomplete traces)")
    print()

    # per-dimension averages
    dim_scores: dict[str, list[float]] = {d: [] for d in _DIMS}
    for r in results:
        scores = r["reasoning"].get("scores", {})
        for dim in _DIMS:
            if dim in scores:
                try:
                    dim_scores[dim].append(float(scores[dim]))
                except (TypeError, ValueError):
                    pass

    print("  Scores by dimension (avg / 5.0):")
    print()
    for dim in _DIMS:
        vals = dim_scores[dim]
        avg = sum(vals) / len(vals) if vals else 0.0
        bar = _bar(avg)
        flag = "  <-- review" if avg < 3.0 else ""
        print(f"  {dim:<30} {bar} {avg:.2f}{flag}")
    print()

    # failed traces
    failures = [r for r in results if not r["reasoning"].get("pass", False)]
    if failures:
        print(f"  Failed traces ({len(failures)}):")
        print()
        for r in failures:
            cf = r["reasoning"].get("critical_failures", [])
            rationale = r["reasoning"].get("rationale", "")
            mode = r["reasoning"].get("mode", "?")
            print(f"  [{r['id'][:40]}] score={r['score']:.3f} mode={mode}")
            if cf:
                print(f"    critical: {', '.join(cf)}")
            if rationale:
                print(f"    {rationale[:120]}")
            print()
    else:
        print("  All traces passed.")
        print()

    print("=" * 60)
    print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def _resolve_traces_path(arg: str | None) -> str | None:
    if arg:
        return arg
    env = os.environ.get("TRACES_PATH", "")
    if env:
        return env
    candidates = [
        Path.cwd() / "traces" / "agent_traces.jsonl",
        Path.cwd().parent / "traces" / "agent_traces.jsonl",
        Path("/app/traces/agent_traces.jsonl"),
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Run judge on real agent traces")
    parser.add_argument("--traces", help="Path to NAT JSONL trace file (default: $TRACES_PATH)")
    parser.add_argument(
        "--input",
        help="Path to harness JSONL file produced by run_task_harness.py",
    )
    parser.add_argument(
        "--last", type=int, default=0, help="Evaluate only the N most recent traces"
    )
    args = parser.parse_args()

    api_key = os.environ.get("NVIDIA_API_KEY", "")
    if not api_key:
        print("ERROR: NVIDIA_API_KEY is not set")
        sys.exit(1)

    base_url = os.environ.get("NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")

    if args.input:
        # Harness JSONL path — parse directly without NAT event grouping
        input_path = args.input
        if not Path(input_path).exists():
            print(f"ERROR: Harness input file not found: {input_path}")
            print("Pass a valid path via --input <path>")
            sys.exit(1)
        print(f"Reading harness records from: {input_path}")
        samples, skipped = parse_harness(input_path)
    else:
        # NAT trace JSONL path — use existing NAT parser
        traces_path = _resolve_traces_path(args.traces)
        if not traces_path or not Path(traces_path).exists():
            path_display = traces_path or "(not found)"
            print(f"ERROR: Trace file not found: {path_display}")
            print(
                "Set TRACES_PATH environment variable, pass --traces <path>, "
                "or pass --input <harness_jsonl_path>"
            )
            sys.exit(1)
        print(f"Reading traces from: {traces_path}")
        samples, skipped = parse_traces(traces_path)

    if args.last > 0:
        samples = sorted(samples, key=lambda s: s["first_ts"], reverse=True)[: args.last]
        print(f"Limiting to {args.last} most recent traces ({len(samples)} selected)")

    if not samples:
        print(f"No evaluable traces found. Skipped: {skipped}")
        sys.exit(0)

    print(f"Running judge on {len(samples)} traces (skipped: {skipped})...\n")
    results = asyncio.run(run_judge(samples, api_key, base_url))
    print_report(results, skipped)


if __name__ == "__main__":
    main()

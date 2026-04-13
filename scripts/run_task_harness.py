"""Task harness runner — sends predefined tasks to the agent HTTP endpoint.

Writes one JSONL line per task with fields:
    run_id, question, agent_response, trajectory_raw, mode, timestamp

Usage:
    python scripts/run_task_harness.py
    python scripts/run_task_harness.py --base-url http://localhost:8000
    python scripts/run_task_harness.py --output /tmp/my_run.jsonl
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime
from pathlib import Path


# ---------------------------------------------------------------------------
# Task definitions
# ---------------------------------------------------------------------------

_FIXTURE_REPO = str(Path(__file__).parent.parent / "tests" / "fixtures" / "sample_repo")

_TASKS: list[dict] = [
    {
        "mode": "analyze",
        "question": (
            f"Analyze the code quality of the repository at {_FIXTURE_REPO}. "
            "Run a lint check and summarize all issues found."
        ),
    },
    {
        "mode": "analyze",
        "question": (
            f"Scan {_FIXTURE_REPO} for security vulnerabilities. "
            "Report any hardcoded secrets or unsafe patterns."
        ),
    },
    {
        "mode": "refactor",
        "question": (
            f"Review {_FIXTURE_REPO} and suggest how to fix the unused import "
            "in app.py without breaking any functionality."
        ),
    },
    {
        "mode": "execute",
        "question": (f"Run the test suite in {_FIXTURE_REPO} and report how many tests pass."),
    },
]


# ---------------------------------------------------------------------------
# HTTP helpers (stdlib only — no external deps)
# ---------------------------------------------------------------------------


def _check_connectivity(base_url: str) -> None:
    """Attempt GET /health; raise SystemExit(1) if agent is not reachable."""
    health_url = base_url.rstrip("/") + "/health"
    req = urllib.request.Request(health_url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=3):
            pass
    except urllib.error.URLError as exc:
        # ConnectionRefusedError surfaces as URLError
        print(
            f"ERROR: Agent not reachable at {base_url}. Start the agent first.\n"
            f"  Detail: {exc.reason}",
            file=sys.stderr,
        )
        sys.exit(1)
    except OSError as exc:
        print(
            f"ERROR: Agent not reachable at {base_url}. Start the agent first.\n  Detail: {exc}",
            file=sys.stderr,
        )
        sys.exit(1)


def _post_chat(base_url: str, question: str) -> dict:
    """POST question to /chat, return parsed JSON response."""
    chat_url = base_url.rstrip("/") + "/chat"
    body = json.dumps(
        {
            "messages": [{"role": "user", "content": question}],
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        chat_url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = resp.read().decode("utf-8")
    return json.loads(raw)


def _extract_agent_response(resp: dict) -> str | None:
    """Extract the assistant message content from a ChatCompletion-style response."""
    choices = resp.get("choices") or []
    if choices:
        first = choices[0]
        message = first.get("message") or {}
        return message.get("content") or None
    # fallback: some agents return {"content": "..."}
    return resp.get("content") or resp.get("response") or None


def _extract_trajectory(resp: dict) -> list:
    """Extract tool trajectory from response if present."""
    return resp.get("trajectory") or resp.get("tool_calls") or []


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def _build_output_path() -> str:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return str(Path("traces") / f"harness_run_{ts}.jsonl")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run predefined tasks against the agent and write JSONL output"
    )
    parser.add_argument(
        "--base-url",
        default="http://localhost:8000",
        help="Base URL of the agent HTTP endpoint (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Path for the output JSONL file (default: traces/harness_run_<timestamp>.jsonl)",
    )
    args = parser.parse_args()

    base_url: str = args.base_url
    output_path = Path(args.output) if args.output else Path(_build_output_path())

    print(f"Checking connectivity to {base_url} ...", file=sys.stderr)
    _check_connectivity(base_url)
    print(f"Agent reachable at {base_url}", file=sys.stderr)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    run_id = str(uuid.uuid4())

    print(f"Writing output to: {output_path}", file=sys.stderr)
    print(f"run_id: {run_id}", file=sys.stderr)
    print(f"Tasks: {len(_TASKS)}", file=sys.stderr)

    with output_path.open("w", encoding="utf-8") as fh:
        for idx, task in enumerate(_TASKS, start=1):
            question = task["question"]
            mode = task["mode"]
            print(f"[{idx}/{len(_TASKS)}] mode={mode} ...", file=sys.stderr)

            record: dict = {
                "run_id": run_id,
                "question": question,
                "mode": mode,
                "timestamp": time.time(),
                "agent_response": None,
                "trajectory_raw": [],
            }

            try:
                resp = _post_chat(base_url, question)
                agent_response = _extract_agent_response(resp)
                trajectory_raw = _extract_trajectory(resp)
                record["agent_response"] = agent_response
                record["trajectory_raw"] = trajectory_raw
                print(f"  -> ok (response length: {len(agent_response or '')})", file=sys.stderr)
            except Exception as exc:
                record["error"] = str(exc)
                print(f"  -> ERROR: {exc}", file=sys.stderr)

            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
            fh.flush()

    # Print output path to stdout so callers can capture it
    print(str(output_path))
    print(f"Done. {len(_TASKS)} tasks written to {output_path}", file=sys.stderr)


if __name__ == "__main__":
    main()

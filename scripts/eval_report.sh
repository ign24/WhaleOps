#!/usr/bin/env bash
# eval_report.sh — Run the task harness and pipe output to the judge evaluator.
#
# Usage:
#   ./scripts/eval_report.sh
#   ./scripts/eval_report.sh --base-url http://staging:8000
#   ./scripts/eval_report.sh --last 5
#
# Options forwarded to run_task_harness.py:
#   --base-url <url>   Agent base URL (default: http://localhost:8000)
#   --output <path>    JSONL output path (default: traces/harness_run_<ts>.jsonl)
#
# Options forwarded to run_judge_from_traces.py:
#   --last <N>         Evaluate only the N most recent records
#
# Environment:
#   NVIDIA_API_KEY     Required for the judge step
#   NIM_BASE_URL       Optional NVIDIA NIM endpoint override

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

HARNESS_ARGS=()
JUDGE_ARGS=()

# Parse arguments: split into harness vs judge flags
while [[ $# -gt 0 ]]; do
    case "$1" in
        --base-url|--output)
            HARNESS_ARGS+=("$1" "$2")
            shift 2
            ;;
        --last)
            JUDGE_ARGS+=("$1" "$2")
            shift 2
            ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 1
            ;;
    esac
done

echo "--- Running task harness ---" >&2
HARNESS_OUTPUT=$(uv run python "${SCRIPT_DIR}/run_task_harness.py" "${HARNESS_ARGS[@]+"${HARNESS_ARGS[@]}"}")
# The harness prints the output path as the last line to stdout
JSONL_PATH=$(echo "${HARNESS_OUTPUT}" | tail -n 1)

echo "--- Harness output: ${JSONL_PATH} ---" >&2

echo "--- Running judge evaluator ---" >&2
uv run python "${SCRIPT_DIR}/run_judge_from_traces.py" \
    --input "${JSONL_PATH}" \
    "${JUDGE_ARGS[@]+"${JUDGE_ARGS[@]}"}"

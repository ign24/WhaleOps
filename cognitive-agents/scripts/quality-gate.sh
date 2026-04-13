#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-local}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run_python_quality() {
  local project_dir="$1"
  echo "==> Quality checks in ${project_dir}"
  (
    cd "${ROOT_DIR}/${project_dir}"
    uv run ruff check .
    uv run pytest -x
  )
}

run_gga() {
  echo "==> GGA analysis"
  if command -v gga >/dev/null 2>&1; then
    set +e
    gga
    local gga_exit=$?
    set -e

    if [[ "${MODE}" == "ci-blocking" && ${gga_exit} -ne 0 ]]; then
      echo "GGA reported blocking findings in ci-blocking mode."
      exit ${gga_exit}
    fi

    if [[ ${gga_exit} -ne 0 ]]; then
      echo "GGA reported findings (non-blocking phase)."
    fi
  else
    if [[ "${MODE}" == "ci-blocking" ]]; then
      echo "GGA command not found in blocking mode."
      exit 1
    fi
    echo "GGA command not found; skipping in non-blocking phase."
  fi
}

run_python_quality "code-agent"
run_python_quality "marketing-agent"
run_gga

echo "Quality gate completed in mode: ${MODE}"

import json
import re
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence


AWS_KEY_RE = re.compile(r"AKIA[0-9A-Z]{16}")
GENERIC_SECRET_RE = re.compile(r"(?i)(api[_-]?key|token|secret|password)\s*[:=]\s*['\"]?[^'\"\s]+")
NON_RETRYABLE_ERROR_PATTERNS = (
    "outside sandbox root",
    "outside allowed roots",
    "repository path does not exist",
    "invalid_repo_path",
    "validation error",
    "field required",
    "missing",
    "timed out",
    "timeout reached",
    "cancelled",
)

ANALYSIS_ROOT = "/tmp/analysis"
WORKSPACE_ROOT = "/app/workspace"
DEFAULT_ALLOWED_REPO_ROOTS = (ANALYSIS_ROOT, WORKSPACE_ROOT)


def ensure_within_allowed_roots(path: Path, allowed_roots: Sequence[str]) -> Path:
    """Validate that *path* is within one of *allowed_roots*.

    Returns the resolved path on success, raises ValueError otherwise.
    """
    resolved_path = path.resolve()
    resolved_roots = [Path(root).resolve() for root in allowed_roots]
    if any(root in resolved_path.parents or resolved_path == root for root in resolved_roots):
        return resolved_path

    roots_list = ", ".join(str(root) for root in resolved_roots)
    if len(resolved_roots) == 1:
        raise ValueError(f"Path {resolved_path} is outside sandbox root {resolved_roots[0]}.")
    raise ValueError(f"Path {resolved_path} is outside allowed roots [{roots_list}].")


@dataclass(slots=True)
class CommandResult:
    command: list[str]
    returncode: int
    stdout: str
    stderr: str
    duration_ms: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "command": self.command,
            "returncode": self.returncode,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "duration_ms": self.duration_ms,
        }


def ensure_repo_path(
    repo_path: str,
    sandbox_root: str | None = None,
    allowed_roots: Sequence[str] | None = None,
) -> Path:
    path = Path(repo_path).resolve()
    if not path.exists():
        raise FileNotFoundError(
            f"Repository path does not exist: {path}. "
            "For URL targets, use web-mode analysis tools instead of local repo scanners."
        )
    if allowed_roots is None:
        allowed_roots = [sandbox_root] if sandbox_root is not None else DEFAULT_ALLOWED_REPO_ROOTS

    try:
        return ensure_within_allowed_roots(path, allowed_roots=allowed_roots)
    except ValueError as exc:
        raise ValueError(
            f"{exc} For URL targets, use web-mode analysis tools instead of local repo scanners."
        ) from exc


def run_command(
    command: Sequence[str], timeout: int = 60, cwd: Path | None = None
) -> CommandResult:
    start = time.perf_counter()
    proc = subprocess.run(
        list(command),
        capture_output=True,
        text=True,
        timeout=timeout,
        shell=False,
        cwd=str(cwd) if cwd else None,
    )
    duration_ms = int((time.perf_counter() - start) * 1000)
    return CommandResult(
        command=list(command),
        returncode=proc.returncode,
        stdout=proc.stdout,
        stderr=proc.stderr,
        duration_ms=duration_ms,
    )


def redact_secrets(text: str) -> str:
    redacted = AWS_KEY_RE.sub("***REDACTED***", text)
    return GENERIC_SECRET_RE.sub("***REDACTED***", redacted)


def truncate_output(text: str, max_chars: int, *, label: str = "output") -> str:
    """Truncate *text* to *max_chars*, appending a notice when trimmed."""
    if len(text) <= max_chars:
        return text
    removed = len(text) - max_chars
    return text[:max_chars] + f"\n\n... [{label} truncated: {removed:,} chars removed]"


# Default limits for scanner tool outputs (characters, not tokens).
MAX_SCANNER_OUTPUT_CHARS = 15_000
MAX_SCANNER_STDERR_CHARS = 2_000


def json_response(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=True)


def is_non_retryable_error(error: Exception | str) -> bool:
    text = str(error).lower()
    return any(pattern in text for pattern in NON_RETRYABLE_ERROR_PATTERNS)

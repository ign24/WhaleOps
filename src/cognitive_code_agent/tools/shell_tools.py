import logging
import subprocess
from pathlib import Path

from pydantic import Field

from nat.builder.builder import Builder
from nat.builder.function_info import FunctionInfo
from nat.cli.register_workflow import register_function
from nat.data_models.function import FunctionBaseConfig

from cognitive_code_agent.tools.common import ensure_repo_path
from cognitive_code_agent.tools.common import json_response
from cognitive_code_agent.tools.common import redact_secrets
from cognitive_code_agent.tools.common import run_command
from cognitive_code_agent.tools.safety import SafetyMode
from cognitive_code_agent.tools.safety import SafetyTier
from cognitive_code_agent.tools.safety import classify_command
from cognitive_code_agent.tools.safety import get_safety_mode

logger = logging.getLogger(__name__)

MAX_COMMAND_LENGTH = 500
MAX_TIMEOUT_SECONDS = 120
MAX_OUTPUT_CHARS = 10_000
MAX_STDERR_CHARS = 2_000
SANDBOX_ROOT = "/tmp/analysis"
ALLOWED_REPO_ROOTS = ["/tmp/analysis", "/app/workspace"]


class ShellExecuteConfig(FunctionBaseConfig, name="shell_execute"):
    description: str = Field(
        default=(
            "Execute a shell command with deterministic safety tiers. "
            "TIER_1 runs automatically, TIER_2 behavior depends on SAFETY_MODE, "
            "TIER_3 is always blocked."
        )
    )


def _truncate_output(text: str, limit: int, suffix: str) -> tuple[str, bool]:
    if len(text) <= limit:
        return text, False
    return f"{text[:limit]}\n{suffix}", True


def _build_command_result(
    *,
    tier: SafetyTier,
    mode: SafetyMode,
    command: str,
    repo_path: Path,
    status: str,
    message: str,
    returncode: int | None = None,
    duration_ms: int | None = None,
    stdout: str = "",
    stderr: str = "",
    truncated: bool = False,
    error_type: str | None = None,
    retryable: bool | None = None,
) -> str:
    return json_response(
        {
            "status": status,
            "message": message,
            "error_type": error_type,
            "retryable": retryable,
            "tier": tier.value,
            "safety_mode": mode.value,
            "command": command,
            "repo_path": str(repo_path),
            "returncode": returncode,
            "duration_ms": duration_ms,
            "stdout": stdout,
            "stderr": stderr,
            "truncated": truncated,
        }
    )


@register_function(config_type=ShellExecuteConfig)
async def shell_execute_tool(config: ShellExecuteConfig, builder: Builder):
    async def _run(command: str, repo_path: str, timeout_seconds: int = 30) -> str:
        normalized_command = command.strip()
        if not normalized_command:
            raise ValueError("command must not be empty")
        if len(normalized_command) > MAX_COMMAND_LENGTH:
            raise ValueError(f"command exceeds {MAX_COMMAND_LENGTH} characters")

        safe_timeout = max(1, min(timeout_seconds, MAX_TIMEOUT_SECONDS))
        mode = get_safety_mode()
        tier = classify_command(normalized_command)
        try:
            safe_repo_path = ensure_repo_path(repo_path, allowed_roots=ALLOWED_REPO_ROOTS)
        except (FileNotFoundError, ValueError) as exc:
            return _build_command_result(
                tier=tier,
                mode=mode,
                command=normalized_command,
                repo_path=Path(SANDBOX_ROOT),
                status="error",
                message=str(exc),
                error_type="invalid_repo_path",
                retryable=False,
            )

        if tier == SafetyTier.TIER_3_BLOCKED:
            return _build_command_result(
                tier=tier,
                mode=mode,
                command=normalized_command,
                repo_path=safe_repo_path,
                status="blocked",
                message="Command is blocked by deterministic safety rules",
            )

        if tier == SafetyTier.TIER_2_CONFIRM and mode == SafetyMode.STRICT:
            return _build_command_result(
                tier=tier,
                mode=mode,
                command=normalized_command,
                repo_path=safe_repo_path,
                status="blocked",
                message=(
                    "Command requires write privileges (TIER_2). "
                    "Set SAFETY_MODE=standard or SAFETY_MODE=permissive to allow it."
                ),
            )

        try:
            # We intentionally invoke bash with shell=False so Python does not
            # interpolate command strings directly. Deterministic safety tiering
            # runs before execution.
            command_args = ["bash", "-lc", normalized_command]
            result = run_command(command_args, timeout=safe_timeout, cwd=safe_repo_path)
        except FileNotFoundError as exc:
            return _build_command_result(
                tier=tier,
                mode=mode,
                command=normalized_command,
                repo_path=safe_repo_path,
                status="error",
                message=f"Executable not found: {exc}",
            )
        except (TimeoutError, subprocess.TimeoutExpired):
            return _build_command_result(
                tier=tier,
                mode=mode,
                command=normalized_command,
                repo_path=safe_repo_path,
                status="timeout",
                message=f"Command timed out after {safe_timeout} seconds",
            )

        stdout = redact_secrets(result.stdout)
        stderr = redact_secrets(result.stderr)
        stdout, stdout_truncated = _truncate_output(
            stdout, MAX_OUTPUT_CHARS, "[... stdout truncated]"
        )
        stderr, stderr_truncated = _truncate_output(
            stderr, MAX_STDERR_CHARS, "[... stderr truncated]"
        )

        logger.info(
            "tool=shell_execute status=ok tier=%s mode=%s returncode=%s duration_ms=%s",
            tier.value,
            mode.value,
            result.returncode,
            result.duration_ms,
        )
        return _build_command_result(
            tier=tier,
            mode=mode,
            command=normalized_command,
            repo_path=safe_repo_path,
            status="ok",
            message="Command executed",
            returncode=result.returncode,
            duration_ms=result.duration_ms,
            stdout=stdout,
            stderr=stderr,
            truncated=stdout_truncated or stderr_truncated,
        )

    yield FunctionInfo.from_fn(_run, description=config.description)

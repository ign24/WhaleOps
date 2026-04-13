import logging

from pydantic import Field

from nat.builder.builder import Builder
from nat.builder.function_info import FunctionInfo
from nat.cli.register_workflow import register_function
from nat.data_models.function import FunctionBaseConfig

from cognitive_code_agent.tools.common import MAX_SCANNER_OUTPUT_CHARS
from cognitive_code_agent.tools.common import MAX_SCANNER_STDERR_CHARS
from cognitive_code_agent.tools.common import ensure_repo_path
from cognitive_code_agent.tools.common import json_response
from cognitive_code_agent.tools.common import redact_secrets
from cognitive_code_agent.tools.common import run_command
from cognitive_code_agent.tools.common import truncate_output

logger = logging.getLogger(__name__)


class RunSemgrepConfig(FunctionBaseConfig, name="run_semgrep"):
    description: str = Field(default="Run Semgrep SAST scan")


@register_function(config_type=RunSemgrepConfig)
async def run_semgrep_tool(config: RunSemgrepConfig, builder: Builder):
    async def _run(repo_path: str) -> str:
        try:
            path = ensure_repo_path(repo_path)
        except (FileNotFoundError, ValueError) as exc:
            payload = {
                "status": "error",
                "error_type": "invalid_repo_path",
                "retryable": False,
                "findings": "",
                "stderr": str(exc),
                "returncode": None,
                "duration_ms": 0,
            }
            logger.warning("tool=run_semgrep status=invalid_repo_path error=%s", exc)
            return json_response(payload)
        result = run_command(
            ["semgrep", "scan", "--json", "--config", "auto", "."], timeout=180, cwd=path
        )
        payload = {
            "status": "ok",
            "findings": truncate_output(
                result.stdout, MAX_SCANNER_OUTPUT_CHARS, label="semgrep findings"
            ),
            "stderr": truncate_output(
                result.stderr, MAX_SCANNER_STDERR_CHARS, label="semgrep stderr"
            ),
            "returncode": result.returncode,
            "duration_ms": result.duration_ms,
        }
        logger.info("tool=run_semgrep status=ok duration_ms=%s", result.duration_ms)
        return json_response(payload)

    yield FunctionInfo.from_fn(_run, description=config.description)


class RunTrivyConfig(FunctionBaseConfig, name="run_trivy"):
    description: str = Field(default="Run Trivy vulnerability scan")


@register_function(config_type=RunTrivyConfig)
async def run_trivy_tool(config: RunTrivyConfig, builder: Builder):
    async def _run(repo_path: str) -> str:
        try:
            path = ensure_repo_path(repo_path)
        except (FileNotFoundError, ValueError) as exc:
            payload = {
                "status": "error",
                "error_type": "invalid_repo_path",
                "retryable": False,
                "vulnerabilities": "",
                "stderr": str(exc),
                "returncode": None,
                "duration_ms": 0,
            }
            logger.warning("tool=run_trivy status=invalid_repo_path error=%s", exc)
            return json_response(payload)
        result = run_command(["trivy", "fs", "--format", "json", "."], timeout=300, cwd=path)
        payload = {
            "status": "ok",
            "vulnerabilities": truncate_output(
                result.stdout, MAX_SCANNER_OUTPUT_CHARS, label="trivy vulnerabilities"
            ),
            "stderr": truncate_output(
                result.stderr, MAX_SCANNER_STDERR_CHARS, label="trivy stderr"
            ),
            "returncode": result.returncode,
            "duration_ms": result.duration_ms,
        }
        logger.info("tool=run_trivy status=ok duration_ms=%s", result.duration_ms)
        return json_response(payload)

    yield FunctionInfo.from_fn(_run, description=config.description)


class RunGitleaksConfig(FunctionBaseConfig, name="run_gitleaks"):
    description: str = Field(default="Run gitleaks and redact all detected secrets")


@register_function(config_type=RunGitleaksConfig)
async def run_gitleaks_tool(config: RunGitleaksConfig, builder: Builder):
    async def _run(repo_path: str) -> str:
        try:
            path = ensure_repo_path(repo_path)
        except (FileNotFoundError, ValueError) as exc:
            payload = {
                "status": "error",
                "error_type": "invalid_repo_path",
                "retryable": False,
                "leaks": "",
                "stderr": str(exc),
                "returncode": None,
                "duration_ms": 0,
            }
            logger.warning("tool=run_gitleaks status=invalid_repo_path error=%s", exc)
            return json_response(payload)
        result = run_command(
            ["gitleaks", "detect", "--source", ".", "--report-format", "json"],
            timeout=120,
            cwd=path,
        )
        payload = {
            "status": "ok",
            "leaks": truncate_output(
                redact_secrets(result.stdout), MAX_SCANNER_OUTPUT_CHARS, label="gitleaks findings"
            ),
            "stderr": truncate_output(
                redact_secrets(result.stderr), MAX_SCANNER_STDERR_CHARS, label="gitleaks stderr"
            ),
            "returncode": result.returncode,
            "duration_ms": result.duration_ms,
        }
        logger.info("tool=run_gitleaks status=ok duration_ms=%s", result.duration_ms)
        return json_response(payload)

    yield FunctionInfo.from_fn(_run, description=config.description)


class RunBanditConfig(FunctionBaseConfig, name="run_bandit"):
    description: str = Field(default="Run Bandit for Python security checks")


@register_function(config_type=RunBanditConfig)
async def run_bandit_tool(config: RunBanditConfig, builder: Builder):
    async def _run(repo_path: str) -> str:
        try:
            path = ensure_repo_path(repo_path)
        except (FileNotFoundError, ValueError) as exc:
            payload = {
                "status": "error",
                "error_type": "invalid_repo_path",
                "retryable": False,
                "issues": "",
                "stderr": str(exc),
                "returncode": None,
                "duration_ms": 0,
            }
            logger.warning("tool=run_bandit status=invalid_repo_path error=%s", exc)
            return json_response(payload)
        result = run_command(["bandit", "-r", ".", "-f", "json"], timeout=120, cwd=path)
        payload = {
            "status": "ok",
            "issues": truncate_output(
                result.stdout, MAX_SCANNER_OUTPUT_CHARS, label="bandit issues"
            ),
            "stderr": truncate_output(
                result.stderr, MAX_SCANNER_STDERR_CHARS, label="bandit stderr"
            ),
            "returncode": result.returncode,
            "duration_ms": result.duration_ms,
        }
        logger.info("tool=run_bandit status=ok duration_ms=%s", result.duration_ms)
        return json_response(payload)

    yield FunctionInfo.from_fn(_run, description=config.description)

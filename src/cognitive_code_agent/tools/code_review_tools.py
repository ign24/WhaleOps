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
from cognitive_code_agent.tools.common import run_command
from cognitive_code_agent.tools.common import truncate_output

logger = logging.getLogger(__name__)


class RunRuffConfig(FunctionBaseConfig, name="run_ruff"):
    description: str = Field(default="Run ruff and return lint findings as JSON")


@register_function(config_type=RunRuffConfig)
async def run_ruff_tool(config: RunRuffConfig, builder: Builder):
    async def _run(repo_path: str) -> str:
        path = ensure_repo_path(repo_path)
        result = run_command(["ruff", "check", ".", "--output-format=json"], timeout=30, cwd=path)
        payload = {
            "issues": truncate_output(result.stdout, MAX_SCANNER_OUTPUT_CHARS, label="ruff issues"),
            "stderr": truncate_output(result.stderr, MAX_SCANNER_STDERR_CHARS, label="ruff stderr"),
            "returncode": result.returncode,
            "duration_ms": result.duration_ms,
        }
        logger.info("tool=run_ruff status=ok duration_ms=%s", result.duration_ms)
        return json_response(payload)

    yield FunctionInfo.from_fn(_run, description=config.description)


class RunEslintConfig(FunctionBaseConfig, name="run_eslint"):
    description: str = Field(default="Run ESLint and return findings as JSON")


@register_function(config_type=RunEslintConfig)
async def run_eslint_tool(config: RunEslintConfig, builder: Builder):
    async def _run(repo_path: str) -> str:
        path = ensure_repo_path(repo_path)
        result = run_command(["npx", "eslint", ".", "-f", "json"], timeout=30, cwd=path)
        payload = {
            "issues": truncate_output(
                result.stdout, MAX_SCANNER_OUTPUT_CHARS, label="eslint issues"
            ),
            "stderr": truncate_output(
                result.stderr, MAX_SCANNER_STDERR_CHARS, label="eslint stderr"
            ),
            "returncode": result.returncode,
            "duration_ms": result.duration_ms,
        }
        logger.info("tool=run_eslint status=ok duration_ms=%s", result.duration_ms)
        return json_response(payload)

    yield FunctionInfo.from_fn(_run, description=config.description)


class AnalyzeComplexityConfig(FunctionBaseConfig, name="analyze_complexity"):
    description: str = Field(default="Analyze cyclomatic complexity with radon")


@register_function(config_type=AnalyzeComplexityConfig)
async def analyze_complexity_tool(config: AnalyzeComplexityConfig, builder: Builder):
    async def _run(repo_path: str, language: str) -> str:
        path = ensure_repo_path(repo_path)
        normalized_language = language.lower().strip()
        if normalized_language == "python":
            result = run_command(["radon", "cc", ".", "-s", "-j"], timeout=30, cwd=path)
            payload = {
                "language": normalized_language,
                "complexity": truncate_output(
                    result.stdout, MAX_SCANNER_OUTPUT_CHARS, label="radon complexity"
                ),
                "stderr": truncate_output(
                    result.stderr, MAX_SCANNER_STDERR_CHARS, label="radon stderr"
                ),
                "returncode": result.returncode,
            }
        elif normalized_language in {"javascript", "typescript", "js", "ts"}:
            payload = {
                "language": normalized_language,
                "complexity": "Complexity analysis for JS/TS pending dedicated parser",
                "returncode": 0,
            }
        else:
            raise ValueError("language must be python, javascript, or typescript")
        logger.info("tool=analyze_complexity status=ok")
        return json_response(payload)

    yield FunctionInfo.from_fn(_run, description=config.description)


class GetDiffConfig(FunctionBaseConfig, name="get_diff"):
    description: str = Field(default="Get git diff from a local cloned repository")


@register_function(config_type=GetDiffConfig)
async def get_diff_tool(config: GetDiffConfig, builder: Builder):
    async def _run(repo_path: str, base_ref: str = "HEAD~1", target_ref: str = "HEAD") -> str:
        path = ensure_repo_path(repo_path)
        result = run_command(
            ["git", "diff", "--numstat", base_ref, target_ref], timeout=15, cwd=path
        )
        payload = {
            "files_changed": len([line for line in result.stdout.splitlines() if line.strip()]),
            "numstat": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }
        logger.info("tool=get_diff status=ok duration_ms=%s", result.duration_ms)
        return json_response(payload)

    yield FunctionInfo.from_fn(_run, description=config.description)

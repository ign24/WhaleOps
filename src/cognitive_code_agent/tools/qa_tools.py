import json
import logging
import re
from pathlib import Path

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


def _parse_pytest_summary(output: str) -> dict[str, int]:
    summary = {"passed": 0, "failed": 0, "errors": 0, "skipped": 0}
    for key in summary:
        match = re.search(rf"(\d+)\s+{key}", output)
        if match:
            summary[key] = int(match.group(1))
    return summary


class RunPytestConfig(FunctionBaseConfig, name="run_pytest"):
    description: str = Field(default="Run pytest and return summarized JSON results")


@register_function(config_type=RunPytestConfig)
async def run_pytest_tool(config: RunPytestConfig, builder: Builder):
    async def _run(repo_path: str) -> str:
        path = ensure_repo_path(repo_path)
        result = run_command(["pytest", "-q"], timeout=60, cwd=path)
        summary = _parse_pytest_summary(result.stdout + "\n" + result.stderr)
        payload = {
            **summary,
            "returncode": result.returncode,
            "duration_ms": result.duration_ms,
            "stdout": truncate_output(
                result.stdout, MAX_SCANNER_OUTPUT_CHARS, label="pytest stdout"
            ),
            "stderr": truncate_output(
                result.stderr, MAX_SCANNER_STDERR_CHARS, label="pytest stderr"
            ),
        }
        logger.info("tool=run_pytest status=ok duration_ms=%s", result.duration_ms)
        return json_response(payload)

    yield FunctionInfo.from_fn(_run, description=config.description)


class RunJestConfig(FunctionBaseConfig, name="run_jest"):
    description: str = Field(default="Run Jest and return summarized JSON results")


@register_function(config_type=RunJestConfig)
async def run_jest_tool(config: RunJestConfig, builder: Builder):
    async def _run(repo_path: str) -> str:
        path = ensure_repo_path(repo_path)
        output_file = path / ".jest-report.json"
        result = run_command(
            ["npx", "jest", "--json", f"--outputFile={output_file}", "--runInBand"],
            timeout=60,
            cwd=path,
        )
        report: dict[str, object] = {}
        if output_file.exists():
            report = json.loads(output_file.read_text(encoding="utf-8"))
        payload = {
            "passed": int(report.get("numPassedTests", 0)),
            "failed": int(report.get("numFailedTests", 0)),
            "test_suites": int(report.get("numTotalTestSuites", 0)),
            "returncode": result.returncode,
            "duration_ms": result.duration_ms,
            "stdout": truncate_output(result.stdout, MAX_SCANNER_OUTPUT_CHARS, label="jest stdout"),
            "stderr": truncate_output(result.stderr, MAX_SCANNER_STDERR_CHARS, label="jest stderr"),
        }
        logger.info("tool=run_jest status=ok duration_ms=%s", result.duration_ms)
        return json_response(payload)

    yield FunctionInfo.from_fn(_run, description=config.description)


class AnalyzeCoverageConfig(FunctionBaseConfig, name="analyze_test_coverage"):
    description: str = Field(default="Analyze test coverage for Python or JS/TS repositories")


@register_function(config_type=AnalyzeCoverageConfig)
async def analyze_test_coverage_tool(config: AnalyzeCoverageConfig, builder: Builder):
    async def _run(repo_path: str, language: str) -> str:
        path = ensure_repo_path(repo_path)
        normalized_language = language.lower().strip()
        uncovered_files: list[str] = []
        total_coverage = 0.0

        if normalized_language == "python":
            try:
                result = run_command(["coverage", "report", "-m"], timeout=30, cwd=path)
            except FileNotFoundError:
                return json_response(
                    {
                        "total_coverage": 0.0,
                        "uncovered_files": [],
                        "language": normalized_language,
                        "warning": "coverage command not available",
                    }
                )
            for line in (result.stdout + "\n" + result.stderr).splitlines():
                if "TOTAL" in line:
                    match = re.search(r"(\d+)%", line)
                    if match:
                        total_coverage = float(match.group(1))
                if line.strip().endswith("%") and "TOTAL" not in line:
                    parts = line.split()
                    if len(parts) >= 1:
                        uncovered_files.append(parts[0])
        elif normalized_language in {"javascript", "typescript", "js", "ts"}:
            result = run_command(["npx", "jest", "--coverage", "--runInBand"], timeout=30, cwd=path)
            for line in result.stdout.splitlines():
                if "All files" in line:
                    match = re.search(r"\|\s*([0-9.]+)", line)
                    if match:
                        total_coverage = float(match.group(1))
        else:
            raise ValueError("language must be python, javascript, or typescript")

        payload = {
            "total_coverage": total_coverage,
            "uncovered_files": uncovered_files,
            "language": normalized_language,
        }
        logger.info("tool=analyze_test_coverage status=ok")
        return json_response(payload)

    yield FunctionInfo.from_fn(_run, description=config.description)


class QueryQaKnowledgeConfig(FunctionBaseConfig, name="query_qa_knowledge"):
    description: str = Field(
        default="Query local QA seed knowledge files and return relevant snippets"
    )


def _score_line(line: str, query_terms: set[str]) -> int:
    tokens = set(re.findall(r"[a-zA-Z0-9_]+", line.lower()))
    return len(tokens.intersection(query_terms))


@register_function(config_type=QueryQaKnowledgeConfig)
async def query_qa_knowledge_tool(config: QueryQaKnowledgeConfig, builder: Builder):
    async def _run(query: str, top_k: int = 5) -> str:
        knowledge_dir = Path("src/cognitive_code_agent/data/qa_knowledge")
        if not knowledge_dir.exists():
            return json_response({"query": query, "results": []})

        query_terms = set(re.findall(r"[a-zA-Z0-9_]+", query.lower()))
        ranked: list[tuple[int, str, str]] = []

        for file_path in knowledge_dir.glob("*.md"):
            content = file_path.read_text(encoding="utf-8", errors="ignore")
            for raw_line in content.splitlines():
                line = raw_line.strip()
                if not line:
                    continue
                score = _score_line(line, query_terms)
                if score > 0:
                    ranked.append((score, file_path.name, line))

        ranked.sort(key=lambda item: item[0], reverse=True)
        results = [
            {"score": score, "source": source, "text": text}
            for score, source, text in ranked[: max(1, min(top_k, 20))]
        ]
        logger.info("tool=query_qa_knowledge status=ok count=%s", len(results))
        return json_response({"query": query, "results": results})

    yield FunctionInfo.from_fn(_run, description=config.description)

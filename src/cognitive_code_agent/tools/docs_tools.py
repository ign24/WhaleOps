import ast
import logging
from pathlib import Path

from pydantic import Field

from nat.builder.builder import Builder
from nat.builder.function_info import FunctionInfo
from nat.cli.register_workflow import register_function
from nat.data_models.function import FunctionBaseConfig

from cognitive_code_agent.tools.common import ensure_repo_path
from cognitive_code_agent.tools.common import json_response

logger = logging.getLogger(__name__)


class AnalyzeDocstringsConfig(FunctionBaseConfig, name="analyze_docstrings"):
    description: str = Field(default="Analyze Python docstring coverage")


def _python_docstring_stats(repo_path: Path) -> tuple[int, int, list[str]]:
    total = 0
    documented = 0
    missing: list[str] = []
    for file_path in repo_path.rglob("*.py"):
        try:
            node = ast.parse(file_path.read_text(encoding="utf-8"))
        except (SyntaxError, UnicodeDecodeError):
            continue
        for item in node.body:
            if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                total += 1
                if ast.get_docstring(item):
                    documented += 1
                else:
                    missing.append(f"{file_path}:{item.lineno}:{item.name}")
    return total, documented, missing


@register_function(config_type=AnalyzeDocstringsConfig)
async def analyze_docstrings_tool(config: AnalyzeDocstringsConfig, builder: Builder):
    async def _run(repo_path: str, language: str) -> str:
        path = ensure_repo_path(repo_path)
        normalized_language = language.lower().strip()
        if normalized_language != "python":
            payload = {
                "language": normalized_language,
                "message": "JS/TS docstring analysis not implemented yet",
                "total": 0,
                "documented": 0,
                "missing": [],
            }
            return json_response(payload)

        total, documented, missing = _python_docstring_stats(path)
        payload = {
            "language": normalized_language,
            "total": total,
            "documented": documented,
            "missing": missing,
            "quality_issues": [],
        }
        logger.info("tool=analyze_docstrings status=ok total=%s documented=%s", total, documented)
        return json_response(payload)

    yield FunctionInfo.from_fn(_run, description=config.description)


class CheckReadmeConfig(FunctionBaseConfig, name="check_readme"):
    description: str = Field(default="Check README completeness")


@register_function(config_type=CheckReadmeConfig)
async def check_readme_tool(config: CheckReadmeConfig, builder: Builder):
    async def _run(repo_path: str) -> str:
        path = ensure_repo_path(repo_path)
        readme = path / "README.md"
        if not readme.exists():
            return json_response(
                {
                    "exists": False,
                    "has_install": False,
                    "has_usage": False,
                    "sections": [],
                }
            )
        content = readme.read_text(encoding="utf-8", errors="ignore").lower()
        payload = {
            "exists": True,
            "has_install": "install" in content,
            "has_usage": "usage" in content,
            "sections": [line.strip() for line in content.splitlines() if line.startswith("#")],
        }
        logger.info("tool=check_readme status=ok")
        return json_response(payload)

    yield FunctionInfo.from_fn(_run, description=config.description)


class AnalyzeApiDocsConfig(FunctionBaseConfig, name="analyze_api_docs"):
    description: str = Field(default="Analyze API docs coverage through OpenAPI detection")


@register_function(config_type=AnalyzeApiDocsConfig)
async def analyze_api_docs_tool(config: AnalyzeApiDocsConfig, builder: Builder):
    async def _run(repo_path: str) -> str:
        path = ensure_repo_path(repo_path)
        openapi_files = list(path.rglob("openapi*.yml")) + list(path.rglob("openapi*.yaml"))
        payload = {
            "has_openapi": len(openapi_files) > 0,
            "endpoints_documented": 0,
            "endpoints_total": 0,
            "openapi_files": [str(file_path) for file_path in openapi_files],
        }
        logger.info("tool=analyze_api_docs status=ok")
        return json_response(payload)

    yield FunctionInfo.from_fn(_run, description=config.description)

"""Daily markdown report generation tool."""

# NAT compatibility note:
# - Do NOT add ``from __future__ import annotations`` to this module.
#   NAT's FunctionInfo introspection reads runtime signature annotations and
#   expects concrete classes. Deferred string annotations can trigger:
#   ``TypeError: issubclass() arg 1 must be a class`` during startup.

import logging
import os
from collections import Counter
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

from pydantic import Field

from nat.builder.builder import Builder
from nat.builder.function_info import FunctionInfo
from nat.cli.register_workflow import register_function
from nat.data_models.function import FunctionBaseConfig

from cognitive_code_agent.tools.findings_store import COLLECTION_NAME
from cognitive_code_agent.tools.findings_store import QUERY_OUTPUT_FIELDS
from cognitive_code_agent.tools.findings_store import _ensure_collection
from cognitive_code_agent.tools.findings_store import _get_milvus_client
from cognitive_code_agent.tools.findings_store import _milvus_circuit_open

logger = logging.getLogger(__name__)

DEFAULT_REPORT_OUTPUT_DIR = "/app/workspace/reports"
DEFAULT_MILVUS_URI = "/app/data/milvus_lite.db"
SEVERITY_ORDER = ("critical", "high", "medium", "low", "info")


def _resolve_output_dir(output_dir: str | None = None) -> Path:
    base = output_dir or os.getenv("REPORT_OUTPUT_DIR", DEFAULT_REPORT_OUTPUT_DIR)
    return Path(base)


def _find_previous_report_date(output_dir: Path, report_date: date) -> date | None:
    candidates: list[date] = []
    if not output_dir.exists():
        return None

    for md_file in output_dir.glob("*.md"):
        try:
            parsed = date.fromisoformat(md_file.stem)
        except ValueError:
            continue
        if parsed < report_date:
            candidates.append(parsed)
    return max(candidates) if candidates else None


def _collect_findings_for_report(start_ts: int, end_ts: int) -> tuple[str, list[dict[str, Any]]]:
    if _milvus_circuit_open():
        return "unavailable", []

    milvus_uri = os.getenv("MILVUS_URI", DEFAULT_MILVUS_URI)
    try:
        client = _get_milvus_client(milvus_uri)
        _ensure_collection(client, COLLECTION_NAME)
        filter_expr = f"created_at >= {start_ts} and created_at <= {end_ts}"
        rows = client.query(
            collection_name=COLLECTION_NAME,
            filter=filter_expr,
            output_fields=QUERY_OUTPUT_FIELDS,
            limit=500,
        )
        return "ok", list(rows or [])
    except Exception:
        logger.warning("generate_report: milvus query failed", exc_info=True)
        return "unavailable", []


def _render_markdown(
    *,
    report_date: date,
    findings: list[dict[str, Any]],
    status: str,
    date_range: str,
) -> str:
    repos = sorted({str(row.get("repo_id", "")).strip() for row in findings if row.get("repo_id")})
    severity_counts: Counter[str] = Counter(
        str(row.get("severity", "info")).strip().lower() or "info" for row in findings
    )
    for sev in SEVERITY_ORDER:
        severity_counts.setdefault(sev, 0)

    frontmatter = [
        "---",
        f"date: {report_date.isoformat()}",
        "type: daily-report",
        "repos:",
    ]
    if repos:
        frontmatter.extend([f"  - {repo}" for repo in repos])
    else:
        frontmatter.append("  - none")
    frontmatter.append("---")

    body: list[str] = []
    body.append(f"# Daily Report — {report_date.isoformat()}")
    body.append("")
    body.append("## Findings Summary")

    if status == "unavailable":
        body.append("Findings unavailable — Milvus unreachable.")
    elif not findings:
        body.append("No findings recorded.")
    else:
        body.append("Severity counts:")
        for sev in SEVERITY_ORDER:
            body.append(f"- {sev}: {severity_counts[sev]}")
        body.append("")
        body.append("Recent findings:")
        for row in findings:
            sev = str(row.get("severity", "info")).lower()
            finding_type = str(row.get("finding_type", "general"))
            summary = str(row.get("summary", "")).strip()
            repo_id = str(row.get("repo_id", "unknown"))
            body.append(f"- [{sev}] {finding_type} ({repo_id}): {summary}")

    body.append("")
    body.append("## Dependency Observations")
    body.append(
        "Dependency intelligence is not yet integrated. Placeholder section for future dependency-intelligence capability."
    )

    body.append("")
    body.append("## Summary")
    total = len(findings)
    breakdown = ", ".join(f"{sev}={severity_counts[sev]}" for sev in SEVERITY_ORDER)
    body.append(f"- Total findings: {total}")
    body.append(f"- Severity breakdown: {breakdown}")
    body.append(f"- Date range: {date_range}")

    return "\n".join([*frontmatter, "", *body, ""])


async def generate_report(
    *,
    now: datetime | None = None,
    output_dir: str | None = None,
) -> str:
    current = now or datetime.now(UTC)
    report_date = current.date()
    out_dir = _resolve_output_dir(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    previous_report_date = _find_previous_report_date(out_dir, report_date)
    if previous_report_date is None:
        start_dt = current - timedelta(hours=24)
    else:
        start_dt = datetime.combine(previous_report_date, datetime.min.time(), tzinfo=UTC)

    end_dt = current
    status, findings = _collect_findings_for_report(
        int(start_dt.timestamp()), int(end_dt.timestamp())
    )

    date_range = f"{start_dt.date().isoformat()} -> {end_dt.date().isoformat()}"
    markdown = _render_markdown(
        report_date=report_date,
        findings=findings,
        status=status,
        date_range=date_range,
    )

    out_path = out_dir / f"{report_date.isoformat()}.md"
    out_path.write_text(markdown, encoding="utf-8")
    return str(out_path)


class GenerateReportConfig(FunctionBaseConfig, name="generate_report"):
    description: str = Field(
        default=(
            "Generate a daily markdown report with findings summary, dependency observations, "
            "and severity breakdown. Writes REPORT_OUTPUT_DIR/YYYY-MM-DD.md"
        )
    )


@register_function(config_type=GenerateReportConfig)
async def generate_report_tool(config: GenerateReportConfig, builder: Builder):
    async def _run(trigger: str = "manual") -> str:
        """Generate and persist a daily markdown report.

        Args:
            trigger: Invocation context marker for observability.

        Returns:
            Absolute path to the written report file.
        """
        _ = trigger
        return await generate_report()

    yield FunctionInfo.from_fn(_run, description=config.description)

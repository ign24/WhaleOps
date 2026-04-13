"""Unit tests for daily markdown report generation."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest

pytestmark = pytest.mark.unit


@pytest.mark.asyncio
async def test_generate_report_tool_registration_builds_function_info() -> None:
    from cognitive_code_agent.tools import report_tools

    config = report_tools.GenerateReportConfig()
    builder = None

    async with report_tools.generate_report_tool(config, builder) as function_info:
        assert function_info is not None


@pytest.mark.asyncio
async def test_generate_report_writes_markdown_file_with_date_name(tmp_path: Path, monkeypatch):
    from cognitive_code_agent.tools import report_tools

    monkeypatch.setenv("REPORT_OUTPUT_DIR", str(tmp_path / "reports"))
    monkeypatch.setattr(
        report_tools,
        "_collect_findings_for_report",
        lambda *_args, **_kwargs: ("ok", []),
    )

    out_path = await report_tools.generate_report(now=datetime(2026, 4, 8, 12, 0, tzinfo=UTC))
    assert out_path.endswith("2026-04-08.md")
    assert Path(out_path).exists()


@pytest.mark.asyncio
async def test_generate_report_creates_output_directory(tmp_path: Path, monkeypatch):
    from cognitive_code_agent.tools import report_tools

    output_dir = tmp_path / "nested" / "reports"
    monkeypatch.setenv("REPORT_OUTPUT_DIR", str(output_dir))
    monkeypatch.setattr(
        report_tools,
        "_collect_findings_for_report",
        lambda *_args, **_kwargs: ("ok", []),
    )

    await report_tools.generate_report(now=datetime(2026, 4, 8, 12, 0, tzinfo=UTC))
    assert output_dir.exists()


@pytest.mark.asyncio
async def test_report_includes_frontmatter_date_type_and_repos(tmp_path: Path, monkeypatch):
    from cognitive_code_agent.tools import report_tools

    monkeypatch.setenv("REPORT_OUTPUT_DIR", str(tmp_path / "reports"))
    monkeypatch.setattr(
        report_tools,
        "_collect_findings_for_report",
        lambda *_args, **_kwargs: (
            "ok",
            [
                {
                    "repo_id": "owner/repo-a",
                    "severity": "high",
                    "summary": "A",
                    "finding_type": "sec",
                },
                {
                    "repo_id": "owner/repo-b",
                    "severity": "low",
                    "summary": "B",
                    "finding_type": "qa",
                },
            ],
        ),
    )

    out_path = await report_tools.generate_report(now=datetime(2026, 4, 8, 12, 0, tzinfo=UTC))
    content = Path(out_path).read_text(encoding="utf-8")

    assert "date: 2026-04-08" in content
    assert "type: daily-report" in content
    assert "repos:" in content
    assert "- owner/repo-a" in content
    assert "- owner/repo-b" in content


@pytest.mark.asyncio
async def test_second_call_same_day_overwrites_file(tmp_path: Path, monkeypatch):
    from cognitive_code_agent.tools import report_tools

    monkeypatch.setenv("REPORT_OUTPUT_DIR", str(tmp_path / "reports"))
    monkeypatch.setattr(
        report_tools,
        "_collect_findings_for_report",
        lambda *_args, **_kwargs: (
            "ok",
            [
                {
                    "repo_id": "owner/repo",
                    "severity": "high",
                    "summary": "first",
                    "finding_type": "sec",
                }
            ],
        ),
    )

    out_path = await report_tools.generate_report(now=datetime(2026, 4, 8, 12, 0, tzinfo=UTC))
    first = Path(out_path).read_text(encoding="utf-8")

    monkeypatch.setattr(
        report_tools,
        "_collect_findings_for_report",
        lambda *_args, **_kwargs: (
            "ok",
            [
                {
                    "repo_id": "owner/repo",
                    "severity": "low",
                    "summary": "second",
                    "finding_type": "lint",
                }
            ],
        ),
    )
    out_path_2 = await report_tools.generate_report(now=datetime(2026, 4, 8, 17, 0, tzinfo=UTC))
    second = Path(out_path_2).read_text(encoding="utf-8")

    assert out_path == out_path_2
    assert "first" in first
    assert "second" in second
    assert "first" not in second


@pytest.mark.asyncio
async def test_findings_summary_groups_by_severity_counts(tmp_path: Path, monkeypatch):
    from cognitive_code_agent.tools import report_tools

    monkeypatch.setenv("REPORT_OUTPUT_DIR", str(tmp_path / "reports"))
    monkeypatch.setattr(
        report_tools,
        "_collect_findings_for_report",
        lambda *_args, **_kwargs: (
            "ok",
            [
                {
                    "repo_id": "owner/repo",
                    "severity": "critical",
                    "summary": "crit",
                    "finding_type": "security",
                },
                {
                    "repo_id": "owner/repo",
                    "severity": "high",
                    "summary": "high",
                    "finding_type": "security",
                },
                {
                    "repo_id": "owner/repo",
                    "severity": "high",
                    "summary": "high-2",
                    "finding_type": "qa",
                },
            ],
        ),
    )

    out_path = await report_tools.generate_report(now=datetime(2026, 4, 8, 12, 0, tzinfo=UTC))
    content = Path(out_path).read_text(encoding="utf-8")

    assert "critical: 1" in content.lower()
    assert "high: 2" in content.lower()


@pytest.mark.asyncio
async def test_findings_summary_no_findings_message(tmp_path: Path, monkeypatch):
    from cognitive_code_agent.tools import report_tools

    monkeypatch.setenv("REPORT_OUTPUT_DIR", str(tmp_path / "reports"))
    monkeypatch.setattr(
        report_tools,
        "_collect_findings_for_report",
        lambda *_args, **_kwargs: ("ok", []),
    )

    out_path = await report_tools.generate_report(now=datetime(2026, 4, 8, 12, 0, tzinfo=UTC))
    content = Path(out_path).read_text(encoding="utf-8")
    assert "no findings recorded" in content.lower()


@pytest.mark.asyncio
async def test_findings_summary_milvus_unreachable_message(tmp_path: Path, monkeypatch):
    from cognitive_code_agent.tools import report_tools

    monkeypatch.setenv("REPORT_OUTPUT_DIR", str(tmp_path / "reports"))
    monkeypatch.setattr(
        report_tools,
        "_collect_findings_for_report",
        lambda *_args, **_kwargs: ("unavailable", []),
    )

    out_path = await report_tools.generate_report(now=datetime(2026, 4, 8, 12, 0, tzinfo=UTC))
    content = Path(out_path).read_text(encoding="utf-8")
    assert "milvus unreachable" in content.lower()


@pytest.mark.asyncio
async def test_dependency_observations_placeholder(tmp_path: Path, monkeypatch):
    from cognitive_code_agent.tools import report_tools

    monkeypatch.setenv("REPORT_OUTPUT_DIR", str(tmp_path / "reports"))
    monkeypatch.setattr(
        report_tools,
        "_collect_findings_for_report",
        lambda *_args, **_kwargs: ("ok", []),
    )

    out_path = await report_tools.generate_report(now=datetime(2026, 4, 8, 12, 0, tzinfo=UTC))
    content = Path(out_path).read_text(encoding="utf-8")
    assert "dependency intelligence is not yet integrated" in content.lower()


@pytest.mark.asyncio
async def test_summary_block_includes_total_breakdown_and_date_range(tmp_path: Path, monkeypatch):
    from cognitive_code_agent.tools import report_tools

    monkeypatch.setenv("REPORT_OUTPUT_DIR", str(tmp_path / "reports"))
    monkeypatch.setattr(
        report_tools,
        "_collect_findings_for_report",
        lambda *_args, **_kwargs: (
            "ok",
            [
                {
                    "repo_id": "owner/repo",
                    "severity": "critical",
                    "summary": "crit",
                    "finding_type": "security",
                },
                {
                    "repo_id": "owner/repo",
                    "severity": "low",
                    "summary": "low",
                    "finding_type": "lint",
                },
            ],
        ),
    )

    out_path = await report_tools.generate_report(now=datetime(2026, 4, 8, 12, 0, tzinfo=UTC))
    content = Path(out_path).read_text(encoding="utf-8")

    assert "## Summary" in content
    assert "Total findings: 2" in content
    assert "Severity breakdown:" in content
    assert "Date range:" in content

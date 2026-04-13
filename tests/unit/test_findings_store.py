from __future__ import annotations

import json
import asyncio

import pytest

from cognitive_code_agent.tools.findings_store import EMBEDDING_DIM
from cognitive_code_agent.tools.findings_store import NO_PREVIOUS_FINDINGS_MESSAGE
from cognitive_code_agent.tools.findings_store import VALID_SEVERITIES
from cognitive_code_agent.tools.findings_store import _build_filter_expr
from cognitive_code_agent.tools.findings_store import _build_primary_key
from cognitive_code_agent.tools.findings_store import _embed_texts
from cognitive_code_agent.tools.findings_store import _maybe_schedule_semantic_extraction
from cognitive_code_agent.tools.findings_store import _ensure_collection
from cognitive_code_agent.tools.findings_store import _normalize_finding
from cognitive_code_agent.tools.findings_store import _parse_findings_json
from cognitive_code_agent.tools.findings_store import validate_refactoring_plan


pytestmark = pytest.mark.unit


def test_parse_findings_json_accepts_single_object() -> None:
    payload = json.dumps(
        {
            "file_path": "src/app.py",
            "finding_type": "lint_issue",
            "severity": "high",
            "summary": "Potential SQL injection risk in raw query",
            "recommendation": "Use parameterized query",
        }
    )

    findings = _parse_findings_json(payload)

    assert len(findings) == 1
    assert findings[0].file_path == "src/app.py"
    assert findings[0].severity == "high"


def test_normalize_finding_generates_content_hash() -> None:
    finding = _normalize_finding(
        {
            "file_path": "src/app.py",
            "finding_type": "test_gap",
            "severity": "medium",
            "summary": "Missing boundary tests",
            "recommendation": "Add min/max case coverage",
        }
    )

    assert finding.content_hash
    assert len(finding.content_hash) == 64


def test_build_primary_key_is_deterministic() -> None:
    finding = _normalize_finding(
        {
            "file_path": "src/a.py",
            "finding_type": "security",
            "severity": "critical",
            "summary": "Hardcoded token",
            "recommendation": "Use env var",
            "rule_id": "SECRET_001",
        }
    )

    key_1 = _build_primary_key("repo-1", finding)
    key_2 = _build_primary_key("repo-1", finding)

    assert key_1 == key_2
    assert len(key_1) == 64


def test_parse_findings_json_rejects_invalid_payload() -> None:
    with pytest.raises(ValueError):
        _parse_findings_json("not-json")


def test_embed_texts_uses_aembed_documents_when_available() -> None:
    class Embedder:
        async def aembed_documents(self, texts):
            return [[1, 2], [3, 4]]

    vectors = asyncio.run(_embed_texts(Embedder(), ["a", "b"]))
    assert vectors == [[1.0, 2.0], [3.0, 4.0]]


def test_embed_texts_uses_embed_query_fallback() -> None:
    class Embedder:
        def embed_query(self, text):
            return [len(text), 0]

    vectors = asyncio.run(_embed_texts(Embedder(), ["abc"]))
    assert vectors == [[3.0, 0.0]]


def test_embed_texts_raises_when_no_embedding_methods() -> None:
    class Embedder:
        pass

    with pytest.raises(RuntimeError):
        asyncio.run(_embed_texts(Embedder(), ["abc"]))


# ---------------------------------------------------------------------------
# Schema constants
# ---------------------------------------------------------------------------


def test_embedding_dim_is_positive_integer() -> None:
    assert isinstance(EMBEDDING_DIM, int)
    assert EMBEDDING_DIM > 0


def test_valid_severities_contains_expected_values() -> None:
    assert "critical" in VALID_SEVERITIES
    assert "high" in VALID_SEVERITIES
    assert "medium" in VALID_SEVERITIES
    assert "low" in VALID_SEVERITIES
    assert "info" in VALID_SEVERITIES


def test_no_previous_findings_message_is_user_friendly() -> None:
    assert NO_PREVIOUS_FINDINGS_MESSAGE == "No previous findings available."


# ---------------------------------------------------------------------------
# _ensure_collection
# ---------------------------------------------------------------------------


def test_ensure_collection_noop_if_exists() -> None:
    """If the collection already exists, _ensure_collection must be a no-op."""

    class FakeClient:
        def __init__(self):
            self.created = False

        def has_collection(self, name):
            return True

        def create_collection(self, **kwargs):
            self.created = True

    client = FakeClient()
    _ensure_collection(client, "test_col")
    assert client.created is False


def test_ensure_collection_creates_if_not_exists() -> None:
    """If the collection does not exist, _ensure_collection must create it."""

    class FakeClient:
        def __init__(self):
            self.created = False
            self.create_kwargs = {}

        def has_collection(self, name):
            return False

        def prepare_index_params(self):
            return _FakeIndexParams()

        def create_collection(self, **kwargs):
            self.created = True
            self.create_kwargs = kwargs

    class _FakeIndexParams:
        def add_index(self, **kwargs):
            pass

    client = FakeClient()
    _ensure_collection(client, "new_col")
    assert client.created is True
    assert client.create_kwargs["collection_name"] == "new_col"


# ---------------------------------------------------------------------------
# _build_filter_expr
# ---------------------------------------------------------------------------


def test_build_filter_expr_empty_params_returns_empty() -> None:
    assert _build_filter_expr("", "", "", "") == ""


def test_build_filter_expr_single_repo_id() -> None:
    expr = _build_filter_expr("my-repo", "", "", "")
    assert expr == 'repo_id == "my-repo"'


def test_build_filter_expr_severity_validation() -> None:
    # Valid severity
    expr = _build_filter_expr("", "critical", "", "")
    assert 'severity == "critical"' in expr

    # Invalid severity is ignored
    expr = _build_filter_expr("", "banana", "", "")
    assert expr == ""


def test_build_filter_expr_combined_filters() -> None:
    expr = _build_filter_expr("repo-1", "high", "security", "cgn-agent")
    assert "repo_id" in expr
    assert "severity" in expr
    assert "finding_type" in expr
    assert "agent" in expr
    assert expr.count(" and ") == 3


def test_build_filter_expr_sanitizes_quotes() -> None:
    """Double-quotes in user input must be stripped to prevent filter injection."""
    expr = _build_filter_expr('repo"injected', "", "", "")
    assert '"' not in expr.replace('repo_id == "repoinjected"', "")


def test_maybe_schedule_semantic_extraction_skips_below_threshold(monkeypatch) -> None:
    class _Semantic:
        enabled = True
        collection_name = "domain_knowledge"

    class _Memory:
        semantic = _Semantic()

    called = False

    def _fake_create_task(_coro):
        nonlocal called
        called = True
        return None

    monkeypatch.setattr(
        "cognitive_code_agent.tools.findings_store.asyncio.create_task", _fake_create_task
    )

    findings = [
        _normalize_finding(
            {
                "summary": "One",
                "severity": "low",
                "finding_type": "lint_issue",
                "recommendation": "Fix",
            }
        )
    ]

    scheduled = _maybe_schedule_semantic_extraction(
        memory_config=_Memory(),
        findings=findings,
        finding_ids=["a"],
        llm=None,
        embedder=object(),
        milvus_uri="/tmp/test.db",
        repo_id="repo",
    )
    assert scheduled is False
    assert called is False


def test_maybe_schedule_semantic_extraction_skips_when_disabled(monkeypatch) -> None:
    class _Semantic:
        enabled = False
        collection_name = "domain_knowledge"

    class _Memory:
        semantic = _Semantic()

    called = False

    def _fake_create_task(_coro):
        nonlocal called
        called = True
        return None

    monkeypatch.setattr(
        "cognitive_code_agent.tools.findings_store.asyncio.create_task", _fake_create_task
    )

    findings = [
        _normalize_finding(
            {"summary": f"S{i}", "severity": "low", "finding_type": "lint", "recommendation": "Fix"}
        )
        for i in range(3)
    ]

    scheduled = _maybe_schedule_semantic_extraction(
        memory_config=_Memory(),
        findings=findings,
        finding_ids=["a", "b", "c"],
        llm=None,
        embedder=object(),
        milvus_uri="/tmp/test.db",
        repo_id="repo",
    )
    assert scheduled is False
    assert called is False


def test_maybe_schedule_semantic_extraction_schedules_when_enabled(monkeypatch) -> None:
    class _Semantic:
        enabled = True
        collection_name = "domain_knowledge"

    class _Memory:
        semantic = _Semantic()

    called = False

    def _fake_create_task(_coro):
        nonlocal called
        called = True
        _coro.close()
        return None

    monkeypatch.setattr(
        "cognitive_code_agent.tools.findings_store.asyncio.create_task", _fake_create_task
    )

    findings = [
        _normalize_finding(
            {"summary": f"S{i}", "severity": "low", "finding_type": "lint", "recommendation": "Fix"}
        )
        for i in range(3)
    ]

    scheduled = _maybe_schedule_semantic_extraction(
        memory_config=_Memory(),
        findings=findings,
        finding_ids=["a", "b", "c"],
        llm=None,
        embedder=object(),
        milvus_uri="/tmp/test.db",
        repo_id="repo",
    )
    assert scheduled is True
    assert called is True


# ---------------------------------------------------------------------------
# validate_refactoring_plan
# ---------------------------------------------------------------------------


def test_validate_refactoring_plan_accepts_valid_plan() -> None:
    plan = {
        "plan_version": 1,
        "stack": "python",
        "goals": ["P0: fix type errors"],
        "files": [
            {
                "path": "src/auth/service.py",
                "priority": "P0",
                "changes": "Extract login logic",
                "validation": "run_ruff && run_pytest",
            }
        ],
        "execution_order": ["src/auth/service.py"],
    }
    errors = validate_refactoring_plan(plan)
    assert errors == []


def test_validate_refactoring_plan_rejects_missing_required_fields() -> None:
    plan = {"stack": "python"}
    errors = validate_refactoring_plan(plan)
    assert any("plan_version" in e for e in errors)
    assert any("goals" in e for e in errors)
    assert any("files" in e for e in errors)
    assert any("execution_order" in e for e in errors)


def test_validate_refactoring_plan_rejects_empty_files() -> None:
    plan = {
        "plan_version": 1,
        "stack": "python",
        "goals": ["P0: fix"],
        "files": [],
        "execution_order": [],
    }
    errors = validate_refactoring_plan(plan)
    assert any("files" in e and "empty" in e.lower() for e in errors)


def test_validate_refactoring_plan_rejects_file_missing_path() -> None:
    plan = {
        "plan_version": 1,
        "stack": "python",
        "goals": ["P0: fix"],
        "files": [{"priority": "P0", "changes": "Do stuff", "validation": "run_ruff"}],
        "execution_order": ["src/a.py"],
    }
    errors = validate_refactoring_plan(plan)
    assert any("path" in e for e in errors)


def test_validate_refactoring_plan_accepts_optional_constraints() -> None:
    plan = {
        "plan_version": 1,
        "stack": "python",
        "goals": ["P0: fix"],
        "files": [
            {"path": "src/a.py", "priority": "P0", "changes": "Fix", "validation": "run_ruff"}
        ],
        "execution_order": ["src/a.py"],
        "constraints": "Preserve API shapes",
    }
    errors = validate_refactoring_plan(plan)
    assert errors == []

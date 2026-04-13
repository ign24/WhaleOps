"""Integration tests for Milvus-backed findings persistence and retrieval.

These tests use milvus-lite (in-process) and a fake embedder to verify the
full persist → query cycle without real NIM or Redis.
"""

from __future__ import annotations

import asyncio
import json
import os
import uuid
from types import SimpleNamespace

import pytest

import cognitive_code_agent.tools.findings_store as findings_store
from cognitive_code_agent.memory import MemoryConfig
from cognitive_code_agent.memory import SemanticMemoryConfig


pytestmark = pytest.mark.integration

# Ensure cache layer is bypassed (no Redis in CI)
os.environ.setdefault("REDIS_URL", "redis://nonexistent:9999/0")


_EMBED_DIM = 2048  # must match findings_store.EMBEDDING_DIM


class _FakeEmbedder:
    """Deterministic embedder: first component = len(text), rest = 1.0, dim=2048."""

    async def aembed_documents(self, texts: list[str]) -> list[list[float]]:
        return [[float(len(text))] + [1.0] * (_EMBED_DIM - 1) for text in texts]


class _FakeBuilder:
    async def get_embedder(self, embedding_model, wrapper_type=None):
        return _FakeEmbedder()


def _invoke_tool(tool_cm, payload: dict) -> dict:
    async def _run() -> str:
        async with tool_cm as function_info:
            try:
                return await function_info.single_fn(**payload)
            except TypeError:
                tool_input = function_info.input_schema(**payload)
                return await function_info.single_fn(tool_input)

    return json.loads(asyncio.run(_run()))


def _skip_if_no_milvus_lite():
    try:
        import milvus_lite  # noqa: F401
    except Exception:
        pytest.skip("milvus-lite not importable in this environment (missing pkg_resources)")


# ---------------------------------------------------------------------------
# persist_findings
# ---------------------------------------------------------------------------


def test_persist_findings_upserts_and_returns_deterministic_ids(tmp_path) -> None:
    _skip_if_no_milvus_lite()

    db_path = tmp_path / "milvus_lite.db"
    collection = f"qa_findings_{uuid.uuid4().hex[:8]}"
    config = findings_store.PersistFindingsConfig(
        milvus_uri=str(db_path),
        collection_name=collection,
        embedding_model="fake",
    )

    payload = {
        "repo_id": "demo-repo",
        "findings_json": json.dumps(
            {
                "file_path": "src/app.py",
                "finding_type": "security",
                "severity": "high",
                "summary": "Potential injection",
                "recommendation": "Use parameterized query",
            }
        ),
        "branch": "main",
        "commit_sha": "abc123",
    }

    tool_cm = findings_store.persist_findings_tool(config, builder=_FakeBuilder())
    first = _invoke_tool(tool_cm, payload)

    tool_cm_second = findings_store.persist_findings_tool(config, builder=_FakeBuilder())
    second = _invoke_tool(tool_cm_second, payload)

    assert first["status"] == "ok"
    assert second["status"] == "ok"
    assert len(first["ids"]) == 1
    assert first["ids"] == second["ids"]


# ---------------------------------------------------------------------------
# query_findings — empty collection
# ---------------------------------------------------------------------------


def test_query_findings_empty_collection_returns_zero(tmp_path) -> None:
    _skip_if_no_milvus_lite()

    db_path = tmp_path / "milvus_lite.db"
    collection = f"qa_findings_{uuid.uuid4().hex[:8]}"
    config = findings_store.QueryFindingsConfig(
        milvus_uri=str(db_path),
        collection_name=collection,
        embedding_model="fake",
    )

    result = _invoke_tool(
        findings_store.query_findings_tool(config, builder=_FakeBuilder()),
        {"query": "SQL injection vulnerabilities"},
    )

    assert result["status"] == "ok"
    assert result["count"] == 0
    assert result["findings"] == []


# ---------------------------------------------------------------------------
# persist → query round-trip
# ---------------------------------------------------------------------------


def test_persist_then_query_returns_similar_findings(tmp_path) -> None:
    _skip_if_no_milvus_lite()

    db_path = tmp_path / "milvus_lite.db"
    collection = f"qa_findings_{uuid.uuid4().hex[:8]}"

    persist_config = findings_store.PersistFindingsConfig(
        milvus_uri=str(db_path),
        collection_name=collection,
        embedding_model="fake",
    )
    query_config = findings_store.QueryFindingsConfig(
        milvus_uri=str(db_path),
        collection_name=collection,
        embedding_model="fake",
    )

    # Persist a finding
    persist_result = _invoke_tool(
        findings_store.persist_findings_tool(persist_config, builder=_FakeBuilder()),
        {
            "repo_id": "test-repo",
            "findings_json": json.dumps(
                {
                    "file_path": "src/db.py",
                    "finding_type": "security",
                    "severity": "critical",
                    "summary": "SQL injection via raw query interpolation",
                    "recommendation": "Use parameterized queries instead",
                    "agent": "cgn-agent",
                }
            ),
        },
    )
    assert persist_result["status"] == "ok"
    assert persist_result["upsert_count"] == 1

    # Query for similar findings
    query_result = _invoke_tool(
        findings_store.query_findings_tool(query_config, builder=_FakeBuilder()),
        {"query": "SQL injection vulnerability", "repo_id": "test-repo"},
    )

    assert query_result["status"] == "ok"
    assert query_result["count"] >= 1
    first_hit = query_result["findings"][0]
    assert first_hit["severity"] == "critical"
    assert first_hit["finding_type"] == "security"
    assert "similarity_score" in first_hit


# ---------------------------------------------------------------------------
# query_findings with severity filter
# ---------------------------------------------------------------------------


def test_query_findings_filters_by_severity(tmp_path) -> None:
    _skip_if_no_milvus_lite()

    db_path = tmp_path / "milvus_lite.db"
    collection = f"qa_findings_{uuid.uuid4().hex[:8]}"

    persist_config = findings_store.PersistFindingsConfig(
        milvus_uri=str(db_path),
        collection_name=collection,
        embedding_model="fake",
    )
    query_config = findings_store.QueryFindingsConfig(
        milvus_uri=str(db_path),
        collection_name=collection,
        embedding_model="fake",
    )

    # Persist findings with different severities
    findings = [
        {
            "file_path": "src/a.py",
            "finding_type": "security",
            "severity": "critical",
            "summary": "Critical hardcoded password in source code",
            "recommendation": "Move to env var",
        },
        {
            "file_path": "src/b.py",
            "finding_type": "lint_issue",
            "severity": "low",
            "summary": "Low priority style issue in formatting",
            "recommendation": "Run autoformatter",
        },
    ]

    _invoke_tool(
        findings_store.persist_findings_tool(persist_config, builder=_FakeBuilder()),
        {
            "repo_id": "multi-sev-repo",
            "findings_json": json.dumps(findings),
        },
    )

    # Query with severity filter
    result = _invoke_tool(
        findings_store.query_findings_tool(query_config, builder=_FakeBuilder()),
        {
            "query": "security issues",
            "repo_id": "multi-sev-repo",
            "severity": "critical",
        },
    )

    assert result["status"] == "ok"
    for finding in result["findings"]:
        assert finding["severity"] == "critical"


# ---------------------------------------------------------------------------
# query_findings — empty query string
# ---------------------------------------------------------------------------


def test_query_findings_rejects_empty_query(tmp_path) -> None:
    _skip_if_no_milvus_lite()

    db_path = tmp_path / "milvus_lite.db"
    collection = f"qa_findings_{uuid.uuid4().hex[:8]}"
    config = findings_store.QueryFindingsConfig(
        milvus_uri=str(db_path),
        collection_name=collection,
        embedding_model="fake",
    )

    result = _invoke_tool(
        findings_store.query_findings_tool(config, builder=_FakeBuilder()),
        {"query": "  "},  # whitespace-only
    )

    assert result["status"] == "error"
    assert "required" in result["message"]


# ---------------------------------------------------------------------------
# semantic extraction trigger gating
# ---------------------------------------------------------------------------


def test_persist_findings_triggers_semantic_extraction_for_3_plus_when_enabled(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _skip_if_no_milvus_lite()

    db_path = tmp_path / "milvus_lite.db"
    collection = f"qa_findings_{uuid.uuid4().hex[:8]}"
    config = findings_store.PersistFindingsConfig(
        milvus_uri=str(db_path),
        collection_name=collection,
        embedding_model="fake",
    )

    loaded = SimpleNamespace(
        config=MemoryConfig(
            semantic=SemanticMemoryConfig(enabled=True, collection_name="domain_knowledge")
        )
    )
    monkeypatch.setattr(findings_store, "load_memory_config", lambda: loaded)

    scheduled = {"count": 0}

    def _fake_create_task(coro):
        scheduled["count"] += 1
        coro.close()
        return None

    monkeypatch.setattr(findings_store.asyncio, "create_task", _fake_create_task)

    payload = {
        "repo_id": "demo-repo",
        "findings_json": json.dumps(
            [
                {
                    "file_path": "src/a.py",
                    "finding_type": "security",
                    "severity": "high",
                    "summary": "Potential SQL injection",
                    "recommendation": "Use parameterized queries",
                },
                {
                    "file_path": "src/b.py",
                    "finding_type": "security",
                    "severity": "medium",
                    "summary": "Weak input validation",
                    "recommendation": "Validate and sanitize inputs",
                },
                {
                    "file_path": "src/c.py",
                    "finding_type": "security",
                    "severity": "low",
                    "summary": "Missing output encoding",
                    "recommendation": "Encode untrusted output",
                },
            ]
        ),
    }

    result = _invoke_tool(
        findings_store.persist_findings_tool(config, builder=_FakeBuilder()), payload
    )
    assert result["status"] == "ok"
    assert scheduled["count"] == 1


def test_persist_findings_skips_semantic_extraction_for_less_than_3(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _skip_if_no_milvus_lite()

    db_path = tmp_path / "milvus_lite.db"
    collection = f"qa_findings_{uuid.uuid4().hex[:8]}"
    config = findings_store.PersistFindingsConfig(
        milvus_uri=str(db_path),
        collection_name=collection,
        embedding_model="fake",
    )

    loaded = SimpleNamespace(
        config=MemoryConfig(
            semantic=SemanticMemoryConfig(enabled=True, collection_name="domain_knowledge")
        )
    )
    monkeypatch.setattr(findings_store, "load_memory_config", lambda: loaded)

    scheduled = {"count": 0}

    def _fake_create_task(coro):
        scheduled["count"] += 1
        coro.close()
        return None

    monkeypatch.setattr(findings_store.asyncio, "create_task", _fake_create_task)

    payload = {
        "repo_id": "demo-repo",
        "findings_json": json.dumps(
            [
                {
                    "file_path": "src/a.py",
                    "finding_type": "lint_issue",
                    "severity": "low",
                    "summary": "Minor style issue",
                    "recommendation": "Run formatter",
                },
                {
                    "file_path": "src/b.py",
                    "finding_type": "lint_issue",
                    "severity": "low",
                    "summary": "Unused import",
                    "recommendation": "Remove import",
                },
            ]
        ),
    }

    result = _invoke_tool(
        findings_store.persist_findings_tool(config, builder=_FakeBuilder()), payload
    )
    assert result["status"] == "ok"
    assert scheduled["count"] == 0


def test_persist_findings_skips_semantic_extraction_when_disabled(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _skip_if_no_milvus_lite()

    db_path = tmp_path / "milvus_lite.db"
    collection = f"qa_findings_{uuid.uuid4().hex[:8]}"
    config = findings_store.PersistFindingsConfig(
        milvus_uri=str(db_path),
        collection_name=collection,
        embedding_model="fake",
    )

    loaded = SimpleNamespace(
        config=MemoryConfig(
            semantic=SemanticMemoryConfig(enabled=False, collection_name="domain_knowledge")
        )
    )
    monkeypatch.setattr(findings_store, "load_memory_config", lambda: loaded)

    scheduled = {"count": 0}

    def _fake_create_task(coro):
        scheduled["count"] += 1
        coro.close()
        return None

    monkeypatch.setattr(findings_store.asyncio, "create_task", _fake_create_task)

    payload = {
        "repo_id": "demo-repo",
        "findings_json": json.dumps(
            [
                {
                    "file_path": "src/a.py",
                    "finding_type": "security",
                    "severity": "high",
                    "summary": "Potential SQL injection",
                    "recommendation": "Use parameterized queries",
                },
                {
                    "file_path": "src/b.py",
                    "finding_type": "security",
                    "severity": "medium",
                    "summary": "Weak input validation",
                    "recommendation": "Validate and sanitize inputs",
                },
                {
                    "file_path": "src/c.py",
                    "finding_type": "security",
                    "severity": "low",
                    "summary": "Missing output encoding",
                    "recommendation": "Encode untrusted output",
                },
            ]
        ),
    }

    result = _invoke_tool(
        findings_store.persist_findings_tool(config, builder=_FakeBuilder()), payload
    )
    assert result["status"] == "ok"
    assert scheduled["count"] == 0

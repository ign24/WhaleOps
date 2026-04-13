from __future__ import annotations

import pytest

from cognitive_code_agent.memory.semantic import extract_knowledge_statements
from cognitive_code_agent.memory.semantic import upsert_semantic_knowledge


pytestmark = pytest.mark.unit


class _FakeLLM:
    async def ainvoke(self, _prompt: str):
        class _Resp:
            content = "- Always validate user input\n- Prefer parameterized queries"

        return _Resp()


class _FailingLLM:
    async def ainvoke(self, _prompt: str):
        raise RuntimeError("llm unavailable")


class _FakeEmbedder:
    async def aembed_documents(self, texts: list[str]) -> list[list[float]]:
        return [[float(len(text))] + [0.0] * 2047 for text in texts]


class _FakeClient:
    def __init__(self) -> None:
        self._has_collection = False
        self.rows: dict[str, dict] = {}

    def has_collection(self, _name: str) -> bool:
        return self._has_collection

    def prepare_index_params(self):
        class _Index:
            def add_index(self, **_kwargs):
                return None

        return _Index()

    def create_collection(self, **_kwargs):
        self._has_collection = True

    def search(self, **_kwargs):
        # First insertion: empty; subsequent: return existing entry with high similarity.
        if not self.rows:
            return [[]]
        first = next(iter(self.rows.values()))
        return [[{"distance": 0.9, "entity": first}]]

    def upsert(self, collection_name: str, data: list[dict]):
        for row in data:
            self.rows[str(row["id"])] = row
        return {"upsert_count": len(data), "collection_name": collection_name}


@pytest.mark.asyncio
async def test_extract_knowledge_statements_uses_llm_lines() -> None:
    findings = [
        {
            "finding_type": "security",
            "summary": "SQL injection via string interpolation",
            "severity": "high",
        }
    ]

    statements = await extract_knowledge_statements(findings=findings, llm=_FakeLLM(), max_items=3)
    assert len(statements) == 2
    assert "validate user input" in statements[0].lower()


@pytest.mark.asyncio
async def test_upsert_semantic_knowledge_confidence_increases_on_match() -> None:
    client = _FakeClient()
    embedder = _FakeEmbedder()

    first = await upsert_semantic_knowledge(
        client=client,
        collection_name="domain_knowledge",
        embedder=embedder,
        statements=["Prefer prepared statements in data-access code."],
        source_finding_ids=["f1", "f2", "f3"],
        domain="repo/a",
    )
    assert first["created"] == 1

    second = await upsert_semantic_knowledge(
        client=client,
        collection_name="domain_knowledge",
        embedder=embedder,
        statements=["Prefer prepared statements in data-access code."],
        source_finding_ids=["f4", "f5", "f6"],
        domain="repo/a",
    )
    assert second["updated"] == 1
    row = next(iter(client.rows.values()))
    assert float(row["confidence"]) > 0.3


@pytest.mark.asyncio
async def test_extract_knowledge_statements_degrades_to_heuristic_on_llm_failure() -> None:
    findings = [
        {
            "finding_type": "security",
            "summary": "Hardcoded credential in source",
            "severity": "critical",
            "recommendation": "Move secret to env",
        }
    ]
    statements = await extract_knowledge_statements(
        findings=findings, llm=_FailingLLM(), max_items=3
    )
    assert statements

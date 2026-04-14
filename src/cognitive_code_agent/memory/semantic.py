"""L2 semantic memory: extraction + Milvus persistence/retrieval.

This module keeps semantic knowledge accumulation non-blocking and resilient:
- extraction failures never break the caller path
- Milvus failures degrade gracefully
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import time
from typing import Any

logger = logging.getLogger(__name__)

SEMANTIC_SIMILARITY_THRESHOLD = 0.85
SEMANTIC_MIN_CONFIDENCE = 0.3
SEMANTIC_CONFIDENCE_INCREMENT = 0.2
SEMANTIC_MAX_CONFIDENCE = 1.0
SEMANTIC_EMBEDDING_DIM = 2048


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _ensure_semantic_collection(client: Any, collection_name: str) -> None:
    if client.has_collection(collection_name):
        return

    from pymilvus import CollectionSchema, DataType, FieldSchema

    fields = [
        FieldSchema("id", DataType.VARCHAR, is_primary=True, max_length=64),
        FieldSchema("knowledge_text", DataType.VARCHAR, max_length=8192),
        FieldSchema("source_finding_ids", DataType.VARCHAR, max_length=8192),
        FieldSchema("domain", DataType.VARCHAR, max_length=256),
        FieldSchema("confidence", DataType.FLOAT),
        FieldSchema("created_at", DataType.INT64),
        FieldSchema("updated_at", DataType.INT64),
        FieldSchema("embedding", DataType.FLOAT_VECTOR, dim=SEMANTIC_EMBEDDING_DIM),
    ]
    schema = CollectionSchema(fields=fields, enable_dynamic_field=False)

    index_params = client.prepare_index_params()
    index_params.add_index(field_name="embedding", index_type="AUTOINDEX", metric_type="COSINE")

    client.create_collection(
        collection_name=collection_name,
        schema=schema,
        index_params=index_params,
    )


async def _embed_texts(embedder: Any, texts: list[str]) -> list[list[float]]:
    if hasattr(embedder, "aembed_documents"):
        vectors = await embedder.aembed_documents(texts)
        return [list(map(float, vector)) for vector in vectors]
    if hasattr(embedder, "embed_documents"):
        vectors = embedder.embed_documents(texts)
        return [list(map(float, vector)) for vector in vectors]

    vectors: list[list[float]] = []
    for text in texts:
        if hasattr(embedder, "aembed_query"):
            vector = await embedder.aembed_query(text)
        elif hasattr(embedder, "embed_query"):
            vector = embedder.embed_query(text)
        else:
            raise RuntimeError("Embedder does not expose an embedding method")
        vectors.append(list(map(float, vector)))
    return vectors


def _normalize_statements(raw_text: str, *, max_items: int) -> list[str]:
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    cleaned: list[str] = []
    seen: set[str] = set()

    for line in lines:
        line = re.sub(r"^[-*]\s+", "", line)
        line = re.sub(r"^\d+[.)]\s+", "", line)
        line = line.strip()
        if len(line) < 12:
            continue
        key = line.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(line)
        if len(cleaned) >= max_items:
            break

    return cleaned


def _heuristic_statements(findings: list[dict[str, Any]], *, max_items: int) -> list[str]:
    statements: list[str] = []
    seen: set[str] = set()
    for finding in findings:
        finding_type = str(finding.get("finding_type", "issue")).strip().replace("_", " ")
        summary = str(finding.get("summary", "")).strip()
        if not summary:
            continue
        text = f"Repositories in this domain frequently show {finding_type}: {summary}"[:300]
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        statements.append(text)
        if len(statements) >= max_items:
            break
    return statements


async def extract_knowledge_statements(
    *,
    findings: list[dict[str, Any]],
    llm: Any,
    max_items: int = 3,
) -> list[str]:
    """Extract 1-3 generalizable knowledge statements from findings."""
    if not findings:
        return []

    prompt = (
        "Extract 1-3 concise, generalizable engineering knowledge statements from these findings. "
        "Return one bullet per line, no extra text.\n\n"
        f"Findings:\n{json.dumps(findings, ensure_ascii=False)[:16000]}"
    )

    try:
        if llm is not None and hasattr(llm, "ainvoke"):
            response = await llm.ainvoke(prompt)
            text = str(getattr(response, "content", response))
            parsed = _normalize_statements(text, max_items=max_items)
            if parsed:
                return parsed
    except Exception:
        logger.debug("semantic_memory: llm extraction failed, using heuristic", exc_info=True)

    return _heuristic_statements(findings, max_items=max_items)


def _parse_source_ids(raw: str) -> list[str]:
    if not raw:
        return []
    try:
        payload = json.loads(raw)
        if isinstance(payload, list):
            return [str(x) for x in payload]
    except Exception:
        pass
    return []


def _merge_source_ids(existing: str, new_ids: list[str]) -> str:
    merged = list(dict.fromkeys(_parse_source_ids(existing) + [str(x) for x in new_ids]))
    return json.dumps(merged, ensure_ascii=True)


async def upsert_semantic_knowledge(
    *,
    client: Any,
    collection_name: str,
    embedder: Any,
    statements: list[str],
    source_finding_ids: list[str],
    domain: str = "general",
) -> dict[str, int]:
    """Upsert semantic knowledge with similarity-based confidence updates."""
    if not statements:
        return {"created": 0, "updated": 0}

    _ensure_semantic_collection(client, collection_name)
    vectors = await _embed_texts(embedder, statements)

    created = 0
    updated = 0
    now_ts = int(time.time())

    for statement, vector in zip(statements, vectors, strict=True):
        search = client.search(
            collection_name=collection_name,
            data=[vector],
            limit=1,
            output_fields=[
                "id",
                "knowledge_text",
                "source_finding_ids",
                "domain",
                "confidence",
                "created_at",
                "updated_at",
            ],
            search_params={"metric_type": "COSINE"},
            filter=f"confidence >= {SEMANTIC_MIN_CONFIDENCE}",
        )

        row: dict[str, Any]
        if search and search[0]:
            hit = search[0][0]
            score = float(hit.get("distance", 0.0))
            entity = dict(hit.get("entity", hit))
            if score >= SEMANTIC_SIMILARITY_THRESHOLD:
                row = {
                    "id": entity.get("id", _sha256(statement)),
                    "knowledge_text": entity.get("knowledge_text", statement),
                    "source_finding_ids": _merge_source_ids(
                        str(entity.get("source_finding_ids", "[]")),
                        source_finding_ids,
                    ),
                    "domain": entity.get("domain", domain),
                    "confidence": min(
                        SEMANTIC_MAX_CONFIDENCE,
                        float(entity.get("confidence", SEMANTIC_MIN_CONFIDENCE))
                        + SEMANTIC_CONFIDENCE_INCREMENT,
                    ),
                    "created_at": int(entity.get("created_at", now_ts)),
                    "updated_at": now_ts,
                    "embedding": vector,
                }
                updated += 1
            else:
                row = {
                    "id": _sha256(statement),
                    "knowledge_text": statement,
                    "source_finding_ids": json.dumps(source_finding_ids, ensure_ascii=True),
                    "domain": domain,
                    "confidence": SEMANTIC_MIN_CONFIDENCE,
                    "created_at": now_ts,
                    "updated_at": now_ts,
                    "embedding": vector,
                }
                created += 1
        else:
            row = {
                "id": _sha256(statement),
                "knowledge_text": statement,
                "source_finding_ids": json.dumps(source_finding_ids, ensure_ascii=True),
                "domain": domain,
                "confidence": SEMANTIC_MIN_CONFIDENCE,
                "created_at": now_ts,
                "updated_at": now_ts,
                "embedding": vector,
            }
            created += 1

        client.upsert(collection_name=collection_name, data=[row])

    return {"created": created, "updated": updated}


async def search_semantic_knowledge(
    *,
    client: Any,
    collection_name: str,
    embedder: Any,
    query: str,
    top_k: int,
) -> list[dict[str, Any]]:
    if not query.strip() or not client.has_collection(collection_name):
        return []

    query_vector = (await _embed_texts(embedder, [query]))[0]
    result = client.search(
        collection_name=collection_name,
        data=[query_vector],
        limit=max(1, min(20, top_k)),
        output_fields=["knowledge_text", "confidence", "domain"],
        search_params={"metric_type": "COSINE"},
        filter=f"confidence >= {SEMANTIC_MIN_CONFIDENCE}",
    )

    items: list[dict[str, Any]] = []
    for hit in result[0] if result else []:
        entity = dict(hit.get("entity", hit))
        items.append(
            {
                "summary": str(entity.get("knowledge_text", "")),
                "confidence": float(entity.get("confidence", SEMANTIC_MIN_CONFIDENCE)),
                "score": float(hit.get("distance", 0.0)),
                "domain": str(entity.get("domain", "general")),
            }
        )
    return items

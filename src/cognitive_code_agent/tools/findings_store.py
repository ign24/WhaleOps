"""Milvus-backed persistence and retrieval for historical findings.

This module provides two tools:

- **persist_findings**: Embeds and upserts structured findings into Milvus with
  content-hash deduplication. Called after completing an analysis.
- **query_findings**: Semantic vector search over historical findings with optional
  metadata filters for historical context.

Both tools share the same Milvus collection (``COLLECTION_NAME``), embedder, and
optional Redis cache layer.
"""

import hashlib
import json
import logging
import os
import time
import asyncio
from dataclasses import dataclass
from typing import Any
from typing import cast

from pydantic import Field

from nat.builder.builder import Builder
from nat.builder.framework_enum import LLMFrameworkEnum
from nat.builder.function_info import FunctionInfo
from nat.cli.register_workflow import register_function
from nat.data_models.function import FunctionBaseConfig

from cognitive_code_agent.tools.cache import FindingsCache
from cognitive_code_agent.tools.common import json_response
from cognitive_code_agent.memory import load_memory_config
from cognitive_code_agent.memory.semantic import extract_knowledge_statements
from cognitive_code_agent.memory.semantic import upsert_semantic_knowledge

logger = logging.getLogger(__name__)

# Shared cache instance (lazy — connects on first use, degrades if Redis down)
_cache = FindingsCache()

# Milvus resilience: simple circuit breaker to avoid repeated expensive retries
# when the vector service is unavailable.
MILVUS_CIRCUIT_THRESHOLD = 3
MILVUS_CIRCUIT_COOLDOWN_SECONDS = 300
_milvus_failure_count = 0
_milvus_circuit_open_until = 0.0

NO_PREVIOUS_FINDINGS_MESSAGE = "No previous findings available."

# ---------------------------------------------------------------------------
# Schema constants — single source of truth for the qa_findings collection
# ---------------------------------------------------------------------------
COLLECTION_NAME = "qa_findings"
EMBEDDING_DIM = 2048  # nvidia/llama-nemotron-embed-1b-v2 output dimension

# Field length limits (pymilvus VARCHAR requires max_length)
_MAX_ID_LEN = 64
_MAX_SHORT = 256
_MAX_MEDIUM = 1024
_MAX_LONG = 8192

# Output fields returned by query (everything except the embedding vector)
QUERY_OUTPUT_FIELDS = [
    "repo_id",
    "branch",
    "commit_sha",
    "file_path",
    "finding_type",
    "severity",
    "summary",
    "recommendation",
    "rule_id",
    "agent",
    "content_hash",
    "created_at",
    "updated_at",
]

# Valid severity values for filter validation
VALID_SEVERITIES = frozenset({"critical", "high", "medium", "low", "info"})


# ---------------------------------------------------------------------------
# Collection schema management
# ---------------------------------------------------------------------------


def _ensure_collection(client: Any, collection_name: str) -> None:
    """Create the findings collection with an explicit schema if it does not exist.

    This is idempotent — if the collection already exists it is left untouched.
    Using an explicit schema (rather than auto-schema) guarantees field types,
    vector dimension, and index configuration are deterministic across
    environments and restarts.
    """
    if client.has_collection(collection_name):
        return

    from pymilvus import CollectionSchema, DataType, FieldSchema

    fields = [
        FieldSchema("id", DataType.VARCHAR, is_primary=True, max_length=_MAX_ID_LEN),
        # repo_id is a plain VARCHAR field (not partition_key) to ensure filter
        # expressions work correctly with milvus-lite.  Using is_partition_key=True
        # causes an internal schema_helper bug in milvus-lite 2.5.x that makes
        # ANY filter expression on the collection fail with "invalid parameter".
        FieldSchema("repo_id", DataType.VARCHAR, max_length=_MAX_SHORT),
        FieldSchema("branch", DataType.VARCHAR, max_length=_MAX_SHORT),
        FieldSchema("commit_sha", DataType.VARCHAR, max_length=_MAX_SHORT),
        FieldSchema("file_path", DataType.VARCHAR, max_length=_MAX_MEDIUM),
        FieldSchema("finding_type", DataType.VARCHAR, max_length=_MAX_SHORT),
        FieldSchema("severity", DataType.VARCHAR, max_length=32),
        FieldSchema("summary", DataType.VARCHAR, max_length=_MAX_LONG),
        FieldSchema("recommendation", DataType.VARCHAR, max_length=_MAX_LONG),
        FieldSchema("rule_id", DataType.VARCHAR, max_length=_MAX_SHORT),
        FieldSchema("agent", DataType.VARCHAR, max_length=_MAX_SHORT),
        FieldSchema("content_hash", DataType.VARCHAR, max_length=_MAX_ID_LEN),
        FieldSchema("created_at", DataType.INT64),
        FieldSchema("updated_at", DataType.INT64),
        FieldSchema("embedding", DataType.FLOAT_VECTOR, dim=EMBEDDING_DIM),
    ]

    schema = CollectionSchema(fields=fields, enable_dynamic_field=False)

    index_params = client.prepare_index_params()
    index_params.add_index(
        field_name="embedding",
        index_type="AUTOINDEX",
        metric_type="COSINE",
    )

    client.create_collection(
        collection_name=collection_name,
        schema=schema,
        index_params=index_params,
    )
    logger.info(
        "collection=%s created with explicit schema (dim=%s)", collection_name, EMBEDDING_DIM
    )


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class FindingRecord:
    file_path: str
    finding_type: str
    severity: str
    summary: str
    recommendation: str
    rule_id: str
    agent: str
    content_hash: str


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _normalize_finding(raw: dict[str, Any]) -> FindingRecord:
    file_path = str(raw.get("file_path", "")).strip()
    finding_type = str(raw.get("finding_type", "general")).strip() or "general"
    severity = str(raw.get("severity", "medium")).strip().lower() or "medium"
    summary = str(raw.get("summary", "")).strip()
    recommendation = str(raw.get("recommendation", "")).strip()
    rule_id = str(raw.get("rule_id", "")).strip()
    agent = str(raw.get("agent", "cgn-agent")).strip() or "cgn-agent"

    if not summary:
        raise ValueError("Each finding must include a non-empty 'summary'")

    content_hash = str(raw.get("content_hash", "")).strip()
    if not content_hash:
        content_hash = _sha256(f"{file_path}|{finding_type}|{severity}|{summary}|{recommendation}")

    return FindingRecord(
        file_path=file_path,
        finding_type=finding_type,
        severity=severity,
        summary=summary,
        recommendation=recommendation,
        rule_id=rule_id,
        agent=agent,
        content_hash=content_hash,
    )


_PLAN_REQUIRED_FIELDS = ("plan_version", "goals", "files", "execution_order")
_FILE_REQUIRED_FIELDS = ("path", "priority", "changes", "validation")


def validate_refactoring_plan(plan: dict[str, Any]) -> list[str]:
    """Validate a refactoring plan dict. Returns list of error strings (empty = valid)."""
    errors: list[str] = []
    for field in _PLAN_REQUIRED_FIELDS:
        if field not in plan:
            errors.append(f"Missing required field: {field}")
    if errors:
        return errors
    if not isinstance(plan["files"], list) or len(plan["files"]) == 0:
        errors.append("files must be a non-empty list")
        return errors
    for i, entry in enumerate(plan["files"]):
        if not isinstance(entry, dict):
            errors.append(f"files[{i}] must be a dict")
            continue
        for field in _FILE_REQUIRED_FIELDS:
            if field not in entry or not str(entry[field]).strip():
                errors.append(f"files[{i}] missing required field: {field}")
    return errors


def _build_primary_key(repo_id: str, finding: FindingRecord) -> str:
    discriminator = finding.rule_id or finding.finding_type
    return _sha256(f"{repo_id}|{finding.file_path}|{discriminator}|{finding.content_hash}")


def _parse_findings_json(findings_json: str) -> list[FindingRecord]:
    try:
        payload = json.loads(findings_json)
    except json.JSONDecodeError as exc:
        raise ValueError("findings_json must be valid JSON") from exc

    if isinstance(payload, dict):
        items = [payload]
    elif isinstance(payload, list):
        items = payload
    else:
        raise ValueError("findings_json must decode to an object or array")

    findings = [_normalize_finding(item) for item in items if isinstance(item, dict)]
    if not findings:
        raise ValueError("No valid findings found in findings_json")
    return findings


# ---------------------------------------------------------------------------
# Embedding helper
# ---------------------------------------------------------------------------


async def _embed_texts(embedder: Any, texts: list[str]) -> list[list[float]]:
    """Embed a list of texts using whichever method the embedder exposes."""
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


# ---------------------------------------------------------------------------
# Shared client factory
# ---------------------------------------------------------------------------


def _get_milvus_client(milvus_uri: str) -> Any:
    """Create a MilvusClient, ensuring local-file parent directories exist."""
    from pymilvus import MilvusClient

    if "://" not in milvus_uri:
        base_dir = os.path.dirname(milvus_uri)
        if base_dir:
            os.makedirs(base_dir, exist_ok=True)
    return MilvusClient(uri=milvus_uri, timeout=5)


def _milvus_circuit_open() -> bool:
    return (
        _milvus_failure_count >= MILVUS_CIRCUIT_THRESHOLD
        and time.time() < _milvus_circuit_open_until
    )


def _record_milvus_failure() -> None:
    global _milvus_failure_count, _milvus_circuit_open_until
    _milvus_failure_count += 1
    if _milvus_failure_count >= MILVUS_CIRCUIT_THRESHOLD:
        _milvus_circuit_open_until = time.time() + MILVUS_CIRCUIT_COOLDOWN_SECONDS


def _record_milvus_success() -> None:
    global _milvus_failure_count, _milvus_circuit_open_until
    _milvus_failure_count = 0
    _milvus_circuit_open_until = 0.0


async def _run_semantic_extraction(
    *,
    llm: Any,
    embedder: Any,
    milvus_uri: str,
    collection_name: str,
    findings: list[FindingRecord],
    finding_ids: list[str],
    repo_id: str,
) -> None:
    """Best-effort semantic extraction path (never raises to caller)."""
    try:
        client = _get_milvus_client(milvus_uri)
        source_findings = [
            {
                "finding_type": f.finding_type,
                "severity": f.severity,
                "summary": f.summary,
                "recommendation": f.recommendation,
                "file_path": f.file_path,
            }
            for f in findings
        ]
        statements = await extract_knowledge_statements(
            findings=source_findings, llm=llm, max_items=3
        )
        if not statements:
            return
        await upsert_semantic_knowledge(
            client=client,
            collection_name=collection_name,
            embedder=embedder,
            statements=statements,
            source_finding_ids=finding_ids,
            domain=repo_id,
        )
    except Exception:
        logger.debug("semantic_memory: extraction pipeline failed", exc_info=True)


def _maybe_schedule_semantic_extraction(
    *,
    memory_config: Any,
    findings: list[FindingRecord],
    finding_ids: list[str],
    llm: Any,
    embedder: Any,
    milvus_uri: str,
    repo_id: str,
) -> bool:
    if not getattr(memory_config.semantic, "enabled", False):
        return False
    if len(findings) < 3:
        return False

    asyncio.create_task(
        _run_semantic_extraction(
            llm=llm,
            embedder=embedder,
            milvus_uri=milvus_uri,
            collection_name=memory_config.semantic.collection_name,
            findings=findings,
            finding_ids=finding_ids,
            repo_id=repo_id,
        )
    )
    return True


# ---------------------------------------------------------------------------
# Filter expression builder for query_findings
# ---------------------------------------------------------------------------


def _build_filter_expr(
    repo_id: str,
    severity: str,
    finding_type: str,
    agent: str,
) -> str:
    """Build a Milvus boolean filter expression from optional parameters.

    Only non-empty parameters are included.  Multiple clauses are joined with
    ``and``.  Values are sanitised to prevent injection via user-controlled
    strings (double-quotes are stripped).
    """
    clauses: list[str] = []

    def _safe(value: str) -> str:
        return value.replace('"', "").strip()

    if repo_id:
        clauses.append(f'repo_id == "{_safe(repo_id)}"')
    if severity:
        sev = _safe(severity).lower()
        if sev in VALID_SEVERITIES:
            clauses.append(f'severity == "{sev}"')
    if finding_type:
        clauses.append(f'finding_type == "{_safe(finding_type)}"')
    if agent:
        clauses.append(f'agent == "{_safe(agent)}"')

    return " and ".join(clauses)


# ---------------------------------------------------------------------------
# Tool 1: persist_findings
# ---------------------------------------------------------------------------


class PersistFindingsConfig(FunctionBaseConfig, name="persist_findings"):
    description: str = Field(
        default=(
            "Persist structured findings into Milvus for future retrieval. "
            "Call this AFTER completing your analysis to save findings for "
            "historical context. Each finding needs at minimum a 'summary'. "
            "Do NOT call this if you have no concrete tool-backed findings."
        ),
    )
    collection_name: str = Field(default=COLLECTION_NAME)
    milvus_uri: str = Field(default="")
    embedding_model: str = Field(default="nim_embedder")


@register_function(config_type=PersistFindingsConfig)
async def persist_findings_tool(config: PersistFindingsConfig, builder: Builder):
    milvus_uri = config.milvus_uri or os.getenv("MILVUS_URI", "/app/data/milvus_lite.db")
    embedder = await builder.get_embedder(
        config.embedding_model, wrapper_type=LLMFrameworkEnum.LANGCHAIN
    )
    loaded_memory = load_memory_config().config

    client: Any | None = None

    async def _run(
        repo_id: str,
        findings_json: str,
        branch: str = "main",
        commit_sha: str = "",
    ) -> str:
        """Persist structured findings into Milvus for future retrieval.

        Use this tool AFTER completing an analysis to save your most important
        findings.  Each finding is embedded and upserted with content-hash
        deduplication so re-scanning the same repo updates rather than
        duplicates entries.

        Do NOT use this tool:
        - Before you have run any analysis tools (no speculative findings).
        - For findings that are not backed by tool output evidence.
        - For repos that were not actually analysed in this session.

        Args:
            repo_id: Unique identifier for the repository (e.g. "owner/repo"
                     or a local path).
            findings_json: JSON string — a single object or array of objects.
                Each object must have at least ``summary`` (non-empty string).
                Optional fields: file_path, finding_type, severity (critical/
                high/medium/low), recommendation, rule_id, agent.
            branch: Branch name (default "main").
            commit_sha: Commit SHA for traceability (default empty).

        Returns:
            JSON with status, collection, repo_id, upsert_count, and ids.
        """
        nonlocal client

        repo_id = repo_id.strip()
        if not repo_id:
            raise ValueError("repo_id is required")

        if _milvus_circuit_open():
            return json_response(
                {
                    "status": "degraded",
                    "message": NO_PREVIOUS_FINDINGS_MESSAGE,
                    "repo_id": repo_id,
                }
            )

        try:
            if client is None:
                client = _get_milvus_client(milvus_uri)
                _ensure_collection(client, config.collection_name)
            milvus_client = cast(Any, client)

            findings = _parse_findings_json(findings_json)
            texts = [
                f"{finding.summary}\nRecommendation: {finding.recommendation}".strip()
                for finding in findings
            ]
            embeddings = await _cache.get_or_embed(embedder, texts, _embed_texts)

            # Invalidate query cache since new data was written
            _cache.invalidate_query_cache()

            now_ts = int(time.time())
            rows: list[dict[str, Any]] = []
            ids: list[str] = []
            for finding, embedding in zip(findings, embeddings, strict=True):
                record_id = _build_primary_key(repo_id, finding)
                ids.append(record_id)
                rows.append(
                    {
                        "id": record_id,
                        "repo_id": repo_id,
                        "branch": branch,
                        "commit_sha": commit_sha,
                        "file_path": finding.file_path,
                        "finding_type": finding.finding_type,
                        "severity": finding.severity,
                        "summary": finding.summary,
                        "recommendation": finding.recommendation,
                        "rule_id": finding.rule_id,
                        "agent": finding.agent,
                        "content_hash": finding.content_hash,
                        "created_at": now_ts,
                        "updated_at": now_ts,
                        "embedding": embedding,
                    }
                )

            result = milvus_client.upsert(collection_name=config.collection_name, data=rows)
            _record_milvus_success()
            upsert_count = int(result.get("upsert_count", len(rows)))

            semantic_llm: Any = None
            if getattr(loaded_memory.semantic, "enabled", False) and hasattr(builder, "get_llm"):
                try:
                    semantic_llm = await builder.get_llm(
                        "devstral", wrapper_type=LLMFrameworkEnum.LANGCHAIN
                    )
                except Exception:
                    logger.debug("semantic_memory: could not initialize LLM, using heuristic")

            _maybe_schedule_semantic_extraction(
                memory_config=loaded_memory,
                findings=findings,
                finding_ids=ids,
                llm=semantic_llm,
                embedder=embedder,
                milvus_uri=milvus_uri,
                repo_id=repo_id,
            )

            logger.info(
                "tool=persist_findings status=ok collection=%s upsert_count=%s",
                config.collection_name,
                upsert_count,
            )
            return json_response(
                {
                    "status": "ok",
                    "collection": config.collection_name,
                    "repo_id": repo_id,
                    "upsert_count": upsert_count,
                    "ids": ids,
                }
            )
        except Exception as exc:
            _record_milvus_failure()
            logger.warning("tool=persist_findings status=degraded error=%s", exc)
            return json_response(
                {
                    "status": "degraded",
                    "message": NO_PREVIOUS_FINDINGS_MESSAGE,
                    "repo_id": repo_id,
                }
            )

    yield FunctionInfo.from_fn(_run, description=config.description)


# ---------------------------------------------------------------------------
# Tool 2: query_findings
# ---------------------------------------------------------------------------


class QueryFindingsConfig(FunctionBaseConfig, name="query_findings"):
    description: str = Field(
        default=(
            "Search cross-session memory by semantic similarity. "
            "Use this when the user asks what you remember, what was found before, "
            "or to check previous analyses of a repository. "
            "Returns findings ranked by relevance with metadata. "
            "Do NOT use this as a substitute for running actual analysis tools."
        ),
    )
    collection_name: str = Field(default=COLLECTION_NAME)
    milvus_uri: str = Field(default="")
    embedding_model: str = Field(default="nim_embedder")


@register_function(config_type=QueryFindingsConfig)
async def query_findings_tool(config: QueryFindingsConfig, builder: Builder):
    milvus_uri = config.milvus_uri or os.getenv("MILVUS_URI", "/app/data/milvus_lite.db")
    embedder = await builder.get_embedder(
        config.embedding_model, wrapper_type=LLMFrameworkEnum.LANGCHAIN
    )

    client: Any | None = None

    async def _query(
        query: str,
        repo_id: str = "",
        severity: str = "",
        finding_type: str = "",
        agent: str = "",
        top_k: int = 10,
    ) -> str:
        """Search historical findings by semantic similarity and optional filters.

        Use this tool BEFORE starting an analysis to understand what was
        previously found in the same repository.  It helps avoid duplicate
        work and provides historical context (e.g. "this repo had 5 critical
        security findings last scan").

        Do NOT use this tool:
        - As a substitute for running actual analysis tools (semgrep, pytest, etc.).
        - When the user is asking about a brand-new repo with no history.
        - To search for general knowledge — this only searches past findings.

        Args:
            query: Natural language description of what you are looking for.
                Example: "SQL injection vulnerabilities" or "test coverage gaps".
            repo_id: Filter by repository identifier.  Empty string means
                search across all repositories.
            severity: Filter by severity level.  One of: critical, high,
                medium, low, info.  Empty string means all severities.
            finding_type: Filter by finding type (e.g. "security", "lint_issue",
                "test_gap").  Empty string means all types.
            agent: Filter by the agent that generated the finding (e.g.
                "cgn-agent", "reader_agent"). Empty string means all agents.
            top_k: Maximum number of results to return (1-50, default 10).

        Returns:
            JSON with status, count, query echo, and a findings list where each
            entry includes all metadata fields plus a similarity_score (0-1,
            higher is more relevant).
        """
        nonlocal client

        query = query.strip()
        if not query:
            return json_response({"status": "error", "message": "query is required"})

        if _milvus_circuit_open():
            return json_response(
                {
                    "status": "degraded",
                    "count": 0,
                    "query": query,
                    "findings": [],
                    "message": NO_PREVIOUS_FINDINGS_MESSAGE,
                }
            )

        top_k = max(1, min(50, top_k))

        # Check query result cache first
        cache_key = _cache.query_cache_key(query, repo_id, severity, finding_type, agent, top_k)
        cached = _cache.get_query_result(cache_key)
        if cached is not None:
            logger.info("tool=query_findings status=cache_hit")
            return cached

        try:
            if client is None:
                client = _get_milvus_client(milvus_uri)
                _ensure_collection(client, config.collection_name)
            milvus_client = cast(Any, client)

            # Check if collection has data before searching
            if not milvus_client.has_collection(config.collection_name):
                return json_response({"status": "ok", "count": 0, "query": query, "findings": []})

            # Embed the query text (uses embedding cache internally)
            query_vectors = await _cache.get_or_embed(embedder, [query], _embed_texts)
            query_vector = query_vectors[0]

            # Build optional metadata filter
            filter_expr = _build_filter_expr(repo_id, severity, finding_type, agent)

            # Execute vector search
            search_params = {"metric_type": "COSINE"}
            search_kwargs: dict[str, Any] = {
                "collection_name": config.collection_name,
                "data": [query_vector],
                "limit": top_k,
                "output_fields": QUERY_OUTPUT_FIELDS,
                "search_params": search_params,
            }
            if filter_expr:
                search_kwargs["filter"] = filter_expr

            results = milvus_client.search(**search_kwargs)

            # Format results — results is a list of lists (one per query vector)
            findings: list[dict[str, Any]] = []
            for hit in results[0] if results else []:
                entry = dict(hit.get("entity", hit))
                entry["similarity_score"] = round(float(hit.get("distance", 0.0)), 4)
                # Remove internal fields the LLM does not need
                entry.pop("embedding", None)
                entry.pop("id", None)
                findings.append(entry)

            _record_milvus_success()
            logger.info(
                "tool=query_findings status=ok collection=%s hits=%s filter=%s",
                config.collection_name,
                len(findings),
                filter_expr or "(none)",
            )
            result_json = json_response(
                {
                    "status": "ok",
                    "count": len(findings),
                    "query": query,
                    "filters_applied": filter_expr or "(none)",
                    "findings": findings,
                }
            )

            # Cache the result for future identical queries
            _cache.set_query_result(cache_key, result_json)

            return result_json
        except Exception as exc:
            _record_milvus_failure()
            logger.warning("tool=query_findings status=degraded error=%s", exc)
            return json_response(
                {
                    "status": "degraded",
                    "count": 0,
                    "query": query,
                    "findings": [],
                    "message": NO_PREVIOUS_FINDINGS_MESSAGE,
                }
            )

    yield FunctionInfo.from_fn(_query, description=config.description)

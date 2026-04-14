"""Memory layer configuration for the cognitive-code-agent.

Provides typed configuration dataclasses for L0/L1/L2 memory layers and
schema-safe config loading independent from NAT top-level config parsing.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True, slots=True)
class WorkingMemoryConfig:
    """Configuration for the within-session working memory layer."""

    enabled: bool = True
    max_history: int = 8
    summarize_on_eviction: bool = True
    summary_max_tokens: int = 400
    summary_llm_name: str | None = None
    compaction_char_threshold: int = 40000
    compaction_message_threshold: int = 30
    compaction_retain_recent: int = 8
    compaction_cooldown_messages: int = 10


@dataclass(frozen=True, slots=True)
class EpisodicMemoryConfig:
    """Configuration for the cross-session episodic memory layer (Redis-backed)."""

    enabled: bool = True
    store: str = "redis"
    max_sessions_retrieved: int = 5
    ttl_days: int = 90


@dataclass(frozen=True, slots=True)
class AutoRetrievalConfig:
    """Configuration for automatic memory pre-fetch at session start."""

    enabled: bool = True
    timeout_seconds: int = 2
    include_episodic: bool = True
    include_findings: bool = True
    include_semantic: bool = True
    max_findings_retrieved: int = 3


@dataclass(frozen=True, slots=True)
class SemanticMemoryConfig:
    """Configuration for L2 semantic knowledge memory (Milvus-backed)."""

    enabled: bool = True
    collection_name: str = "domain_knowledge"
    max_knowledge_retrieved: int = 3


@dataclass(frozen=True, slots=True)
class MemoryConfig:
    """Top-level memory configuration aggregating all memory layers.

    Use ``MemoryConfig.from_dict()`` to build from a raw dictionary.
    Missing keys fall back to defaults.
    """

    working: WorkingMemoryConfig = field(default_factory=WorkingMemoryConfig)
    episodic: EpisodicMemoryConfig = field(default_factory=EpisodicMemoryConfig)
    semantic: SemanticMemoryConfig = field(default_factory=SemanticMemoryConfig)
    auto_retrieval: AutoRetrievalConfig = field(default_factory=AutoRetrievalConfig)

    @classmethod
    def from_dict(cls, raw: dict[str, Any] | None) -> MemoryConfig:
        """Build a ``MemoryConfig`` from a raw dictionary, using defaults for missing keys."""
        if not raw:
            return cls()

        working_raw = raw.get("working") or {}
        episodic_raw = raw.get("episodic") or {}
        semantic_raw = raw.get("semantic") or {}
        auto_raw = raw.get("auto_retrieval") or {}

        return cls(
            working=WorkingMemoryConfig(
                **{
                    k: v
                    for k, v in working_raw.items()
                    if k in WorkingMemoryConfig.__dataclass_fields__
                }
            ),
            episodic=EpisodicMemoryConfig(
                **{
                    k: v
                    for k, v in episodic_raw.items()
                    if k in EpisodicMemoryConfig.__dataclass_fields__
                }
            ),
            semantic=SemanticMemoryConfig(
                **{
                    k: v
                    for k, v in semantic_raw.items()
                    if k in SemanticMemoryConfig.__dataclass_fields__
                }
            ),
            auto_retrieval=AutoRetrievalConfig(
                **{
                    k: v
                    for k, v in auto_raw.items()
                    if k in AutoRetrievalConfig.__dataclass_fields__
                }
            ),
        )


@dataclass(frozen=True, slots=True)
class LoadedMemoryConfig:
    """Resolved memory configuration with provenance."""

    config: MemoryConfig
    source: str


def load_memory_config(
    *,
    memory_config_path: Path | None = None,
    legacy_config_path: Path | None = None,
) -> LoadedMemoryConfig:
    """Load memory config with precedence: dedicated file > legacy > defaults.

    Args:
        memory_config_path: Optional dedicated memory config path.
        legacy_config_path: Optional legacy main config path.

    Returns:
        LoadedMemoryConfig with config values and source label.
    """
    dedicated = memory_config_path or Path("src/cognitive_code_agent/configs/memory.yml")
    legacy = legacy_config_path or Path("src/cognitive_code_agent/configs/config.yml")

    if dedicated.exists():
        try:
            raw = yaml.safe_load(dedicated.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                return LoadedMemoryConfig(config=MemoryConfig.from_dict(raw), source="dedicated")
        except Exception:
            pass

    if legacy.exists():
        try:
            raw = yaml.safe_load(legacy.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                legacy_memory = raw.get("memory") or raw.get("cognitive_memory")
                if isinstance(legacy_memory, dict):
                    return LoadedMemoryConfig(
                        config=MemoryConfig.from_dict(legacy_memory),
                        source="legacy",
                    )
        except Exception:
            pass

    return LoadedMemoryConfig(config=MemoryConfig(), source="defaults")

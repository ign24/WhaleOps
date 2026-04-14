"""Unit tests for memory configuration parsing.

Tests cover: defaults, partial overrides, disabled flags, and loading from
the production config.yml.
"""

from __future__ import annotations

import pytest

from cognitive_code_agent.memory import MemoryConfig
from cognitive_code_agent.memory import load_memory_config


pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# Defaults — all values are sensible when no overrides are given
# ---------------------------------------------------------------------------


class TestMemoryConfigDefaults:
    def test_default_working_memory_enabled(self) -> None:
        config = MemoryConfig()
        assert config.working.enabled is True

    def test_default_working_max_history(self) -> None:
        config = MemoryConfig()
        assert config.working.max_history == 8

    def test_default_working_summarize_on_eviction(self) -> None:
        config = MemoryConfig()
        assert config.working.summarize_on_eviction is True

    def test_default_working_summary_max_tokens(self) -> None:
        config = MemoryConfig()
        assert config.working.summary_max_tokens == 400

    def test_default_working_summary_llm_name_is_none(self) -> None:
        config = MemoryConfig()
        assert config.working.summary_llm_name is None

    def test_default_compaction_char_threshold(self) -> None:
        config = MemoryConfig()
        assert config.working.compaction_char_threshold == 40000

    def test_default_compaction_message_threshold(self) -> None:
        config = MemoryConfig()
        assert config.working.compaction_message_threshold == 30

    def test_default_compaction_retain_recent(self) -> None:
        config = MemoryConfig()
        assert config.working.compaction_retain_recent == 8

    def test_default_compaction_cooldown_messages(self) -> None:
        config = MemoryConfig()
        assert config.working.compaction_cooldown_messages == 10

    def test_default_episodic_enabled(self) -> None:
        config = MemoryConfig()
        assert config.episodic.enabled is True

    def test_default_episodic_store(self) -> None:
        config = MemoryConfig()
        assert config.episodic.store == "redis"

    def test_default_episodic_max_sessions_retrieved(self) -> None:
        config = MemoryConfig()
        assert config.episodic.max_sessions_retrieved == 5

    def test_default_episodic_ttl_days(self) -> None:
        config = MemoryConfig()
        assert config.episodic.ttl_days == 90

    def test_default_auto_retrieval_enabled(self) -> None:
        config = MemoryConfig()
        assert config.auto_retrieval.enabled is True

    def test_default_auto_retrieval_timeout(self) -> None:
        config = MemoryConfig()
        assert config.auto_retrieval.timeout_seconds == 2

    def test_default_auto_retrieval_include_episodic(self) -> None:
        config = MemoryConfig()
        assert config.auto_retrieval.include_episodic is True

    def test_default_auto_retrieval_include_findings(self) -> None:
        config = MemoryConfig()
        assert config.auto_retrieval.include_findings is True

    def test_default_auto_retrieval_max_findings(self) -> None:
        config = MemoryConfig()
        assert config.auto_retrieval.max_findings_retrieved == 3

    def test_default_semantic_enabled(self) -> None:
        config = MemoryConfig()
        assert config.semantic.enabled is True

    def test_default_semantic_collection_name(self) -> None:
        config = MemoryConfig()
        assert config.semantic.collection_name == "domain_knowledge"

    def test_default_auto_retrieval_include_semantic(self) -> None:
        config = MemoryConfig()
        assert config.auto_retrieval.include_semantic is True


# ---------------------------------------------------------------------------
# from_dict — partial overrides merge with defaults
# ---------------------------------------------------------------------------


class TestMemoryConfigFromDict:
    def test_partial_override_working_only(self) -> None:
        raw = {"working": {"max_history": 12, "summarize_on_eviction": False}}
        config = MemoryConfig.from_dict(raw)
        assert config.working.max_history == 12
        assert config.working.summarize_on_eviction is False
        # unspecified fields keep defaults
        assert config.working.enabled is True
        assert config.episodic.enabled is True

    def test_summary_llm_name_read_from_dict(self) -> None:
        raw = {"working": {"summary_llm_name": "kimi_reader"}}
        config = MemoryConfig.from_dict(raw)
        assert config.working.summary_llm_name == "kimi_reader"

    def test_compaction_thresholds_read_from_dict(self) -> None:
        raw = {"working": {"compaction_char_threshold": 60000, "compaction_message_threshold": 50}}
        config = MemoryConfig.from_dict(raw)
        assert config.working.compaction_char_threshold == 60000
        assert config.working.compaction_message_threshold == 50

    def test_compaction_retain_and_cooldown_read_from_dict(self) -> None:
        raw = {"working": {"compaction_retain_recent": 12, "compaction_cooldown_messages": 5}}
        config = MemoryConfig.from_dict(raw)
        assert config.working.compaction_retain_recent == 12
        assert config.working.compaction_cooldown_messages == 5

    def test_partial_override_episodic_only(self) -> None:
        raw = {"episodic": {"ttl_days": 30, "max_sessions_retrieved": 10}}
        config = MemoryConfig.from_dict(raw)
        assert config.episodic.ttl_days == 30
        assert config.episodic.max_sessions_retrieved == 10
        assert config.working.max_history == 8

    def test_partial_override_auto_retrieval_only(self) -> None:
        raw = {"auto_retrieval": {"timeout_seconds": 5, "include_episodic": False}}
        config = MemoryConfig.from_dict(raw)
        assert config.auto_retrieval.timeout_seconds == 5
        assert config.auto_retrieval.include_episodic is False
        assert config.auto_retrieval.include_findings is True

    def test_empty_dict_returns_defaults(self) -> None:
        config = MemoryConfig.from_dict({})
        assert config.working.enabled is True
        assert config.episodic.enabled is True
        assert config.auto_retrieval.enabled is True

    def test_none_input_returns_defaults(self) -> None:
        config = MemoryConfig.from_dict(None)
        assert config.working.enabled is True


# ---------------------------------------------------------------------------
# Disabled flags — each layer can be independently disabled
# ---------------------------------------------------------------------------


class TestMemoryConfigDisabled:
    def test_disable_working_memory(self) -> None:
        raw = {"working": {"enabled": False}}
        config = MemoryConfig.from_dict(raw)
        assert config.working.enabled is False
        assert config.episodic.enabled is True

    def test_disable_episodic_memory(self) -> None:
        raw = {"episodic": {"enabled": False}}
        config = MemoryConfig.from_dict(raw)
        assert config.episodic.enabled is False
        assert config.working.enabled is True

    def test_disable_auto_retrieval(self) -> None:
        raw = {"auto_retrieval": {"enabled": False}}
        config = MemoryConfig.from_dict(raw)
        assert config.auto_retrieval.enabled is False

    def test_disable_all_layers(self) -> None:
        raw = {
            "working": {"enabled": False},
            "episodic": {"enabled": False},
            "auto_retrieval": {"enabled": False},
        }
        config = MemoryConfig.from_dict(raw)
        assert config.working.enabled is False
        assert config.episodic.enabled is False
        assert config.auto_retrieval.enabled is False


# ---------------------------------------------------------------------------
# Production config loading
# ---------------------------------------------------------------------------


class TestMemoryConfigFromProductionYaml:
    def test_load_from_dedicated_memory_config(self) -> None:
        from pathlib import Path

        memory_config_path = Path("src/cognitive_code_agent/configs/memory.yml")
        assert memory_config_path.exists()

        loaded = load_memory_config(memory_config_path=memory_config_path)
        assert loaded.source == "dedicated"

        config = loaded.config

        assert config.working.enabled is True
        assert config.working.max_history == 8
        assert config.working.summarize_on_eviction is True
        assert config.working.summary_max_tokens == 400
        assert config.working.summary_llm_name == "devstral"
        assert config.working.compaction_char_threshold == 40000
        assert config.working.compaction_message_threshold == 30
        assert config.working.compaction_retain_recent == 8
        assert config.working.compaction_cooldown_messages == 10
        assert config.episodic.enabled is True
        assert config.episodic.store == "redis"
        assert config.episodic.max_sessions_retrieved == 5
        assert config.episodic.ttl_days == 90
        assert config.auto_retrieval.enabled is True
        assert config.auto_retrieval.timeout_seconds == 2
        assert config.auto_retrieval.include_episodic is True
        assert config.auto_retrieval.include_findings is True
        assert config.auto_retrieval.include_semantic is True
        assert config.auto_retrieval.max_findings_retrieved == 3
        assert config.semantic.enabled is True
        assert config.semantic.collection_name == "ops_domain_knowledge"


class TestMemoryConfigLoaderPrecedence:
    def test_legacy_fallback_when_dedicated_missing(self, tmp_path) -> None:
        legacy = tmp_path / "config.yml"
        legacy.write_text(
            "memory:\n  working:\n    max_history: 11\n  semantic:\n    enabled: false\n",
            encoding="utf-8",
        )

        loaded = load_memory_config(
            memory_config_path=tmp_path / "missing-memory.yml",
            legacy_config_path=legacy,
        )

        assert loaded.source == "legacy"
        assert loaded.config.working.max_history == 11
        assert loaded.config.semantic.enabled is False

    def test_defaults_when_no_config_files(self, tmp_path) -> None:
        loaded = load_memory_config(
            memory_config_path=tmp_path / "missing-memory.yml",
            legacy_config_path=tmp_path / "missing-config.yml",
        )

        assert loaded.source == "defaults"
        assert loaded.config.working.max_history == 8
        assert loaded.config.semantic.enabled is True

## 1. Memory config schema alignment

- [x] 1.1 Add dedicated memory config file (`src/cognitive_code_agent/configs/memory.yml`) covering working, episodic, semantic, and auto_retrieval settings.
- [x] 1.2 Update memory loader(s) to use dedicated file first, then legacy fallback, then defaults.
- [x] 1.3 Add startup log that states active memory config source (dedicated file vs fallback vs defaults).
- [x] 1.4 Add/adjust unit tests for loader precedence and missing-file fallback behavior.

## 2. L2 semantic memory implementation

- [x] 2.1 Implement semantic extraction service/module for converting 3+ findings into 1-3 domain knowledge statements.
- [x] 2.2 Implement `domain_knowledge` Milvus schema bootstrap + upsert/search helpers.
- [x] 2.3 Implement similarity-based consolidation and confidence updates per spec.
- [x] 2.4 Add unit tests for extraction success, extraction failure non-blocking behavior, and confidence update logic.

## 3. Findings-store integration

- [x] 3.1 Wire `persist_findings` to conditionally trigger async semantic extraction when semantic is enabled and threshold is met.
- [x] 3.2 Ensure tool response contract remains unchanged and non-blocking when extraction fails.
- [x] 3.3 Add integration tests for: (a) 3+ findings triggers extraction, (b) <3 findings skips, (c) semantic disabled skips.

## 4. Auto-retrieval + readiness extension

- [x] 4.1 Extend readiness helper to probe semantic source availability.
- [x] 4.2 Include semantic source in first-message auto-retrieval when enabled+ready.
- [x] 4.3 Ensure deterministic omission + structured degraded diagnostics when semantic is unready.
- [x] 4.4 Add tests for mixed readiness scenarios across episodic/findings/semantic.

## 5. Documentation and verification

- [x] 5.1 Update README/EASYPANEL docs with L0/L1/L2 model and memory config location.
- [x] 5.2 Add troubleshooting note for NAT config validation conflicts with top-level memory keys.
- [x] 5.3 Run lint + targeted memory/findings test suites and fix regressions.
- [x] 5.4 Validate change with `openspec validate complete-l2-semantic-memory-and-memory-config-alignment --strict`.

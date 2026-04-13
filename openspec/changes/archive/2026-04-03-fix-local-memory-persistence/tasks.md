## 1. Runtime and configuration parity

- [x] 1.1 Update local runtime defaults to use Redis Stack-compatible setup for episodic memory prerequisites.
- [x] 1.2 Add explicit `memory` configuration blocks (`working`, `episodic`, `auto_retrieval`) in `src/cognitive_code_agent/configs/config.yml`.
- [x] 1.3 Align `.env.example` and docs with the expected Redis/Milvus local defaults.

## 2. Memory backend readiness gating

- [x] 2.1 Implement a shared readiness helper for episodic and findings memory sources.
- [x] 2.2 Integrate readiness gating in episodic retrieval path to skip unsupported Redis FT operations.
- [x] 2.3 Integrate readiness gating in episodic persistence path to skip writes when backend is unready.
- [x] 2.4 Emit structured degraded-memory diagnostics with source-specific reasons and limited log spam.

## 3. Validation and regression coverage

- [x] 3.1 Add/adjust tests for retrieval behavior when Redis Stack is unavailable.
- [x] 3.2 Add/adjust tests for successful episodic retrieval/persistence when backend is ready.
- [x] 3.3 Run lint and targeted test suite for memory-related modules and fix regressions.

## 4. Documentation and operator guidance

- [x] 4.1 Update README memory section with readiness expectations and graceful-degradation behavior.
- [x] 4.2 Update deployment notes to differentiate Redis Stack requirements from plain Redis.
- [x] 4.3 Add a troubleshooting note for "unknown command FT.INFO/FT.SEARCH" in local setups.

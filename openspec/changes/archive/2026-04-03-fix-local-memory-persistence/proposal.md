## Why

Local runs are showing memory as "enabled" but cross-session recall is inconsistent because episodic memory depends on Redis Stack modules (RediSearch/RedisJSON) and local environments often start plain Redis. This creates false negatives during testing and noisy runtime errors that obscure real regressions.

## What Changes

- Standardize local memory backend defaults so episodic memory can work out-of-the-box in development.
- Make memory configuration explicit in `config.yml` instead of relying on implicit dataclass defaults.
- Add deterministic readiness checks for memory backends and clear degraded-state signaling when required capabilities are missing.
- Reduce repeated low-value errors (e.g., FT.INFO/FT.SEARCH unknown command loops) while preserving graceful degradation.

## Capabilities

### New Capabilities
- `memory-backend-readiness`: Detect and report memory backend readiness (Redis modules + findings backend reachability) before memory-dependent flows execute.

### Modified Capabilities
- `episodic-memory`: Tighten requirements for backend capability validation and degraded behavior when Redis Stack modules are unavailable.
- `automatic-memory-retrieval`: Clarify behavior when one or more memory sources are unavailable, including deterministic omission and operator-facing diagnostics.

## Impact

- **Runtime/backends**: local Redis container/image and startup behavior.
- **Configuration**: `src/cognitive_code_agent/configs/config.yml` memory section becomes explicit.
- **Agent flow**: memory retrieval/persistence guard paths in `agents/safe_tool_calling_agent.py` and `memory/*`.
- **Operations/docs**: README and deployment guidance for Redis Stack vs plain Redis.

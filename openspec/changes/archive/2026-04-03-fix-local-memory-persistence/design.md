## Context

The current memory architecture is correct at code level (working, episodic, auto-retrieval), but local runtime parity is weak:

- Episodic memory requires Redis Stack commands (`FT.INFO`, `FT.SEARCH`), while some local setups still run plain `redis:7-alpine`.
- `config.yml` does not define an explicit `memory:` block, so behavior depends on implicit defaults loaded at runtime.
- Degradation works functionally, but emits repetitive low-signal errors and makes it hard to distinguish "feature off" vs "backend misconfigured".

This change targets developer confidence: when memory is unavailable, the system should state why; when available, it should work predictably across sessions.

## Goals / Non-Goals

**Goals:**
- Ensure local environment defaults support episodic memory prerequisites.
- Make memory-layer toggles explicit and auditable in `config.yml`.
- Add deterministic readiness checks so degraded mode is intentional and observable.
- Preserve non-blocking behavior (agent keeps working even if memory backends fail).

**Non-Goals:**
- Re-architecting memory layers (no new L0/L1/L2 model beyond current implementation).
- Introducing a new persistent SQL backend for episodic memory.
- Changing retrieval ranking algorithms or embedding models.

## Decisions

### 1) Use Redis Stack for local compose defaults
**Decision:** Update local orchestration/docs to use Redis Stack image/commands that provide RediSearch/RedisJSON.

**Why:** Episodic memory APIs rely on these modules. Plain Redis guarantees repeated command failures and invalidates cross-session tests.

**Alternatives considered:**
- Keep plain Redis and disable episodic memory by default: lower friction, but hides production-like behavior and defeats memory testing.
- Add an automatic fallback to file-based episodic store: larger scope, new consistency concerns.

### 2) Declare memory config explicitly
**Decision:** Add explicit `memory` sections (`working`, `episodic`, `auto_retrieval`) in `config.yml` with current intended defaults.

**Why:** Removes ambiguity between code defaults and operational intent; improves reviewability.

**Alternatives considered:**
- Keep implicit defaults only: simpler file, but opaque operational behavior.

### 3) Add backend readiness probe and cached capability status
**Decision:** Introduce a lightweight readiness check for memory sources and cache capability flags (e.g., Redis vector search availability) to avoid repeated failing calls.

**Why:** Prevents noisy FT.* error loops and gives clear degraded reason paths.

**Alternatives considered:**
- Continue probing on every request: simplest but noisy and wasteful.
- Hard-fail startup when backend missing: too strict for local experimentation.

### 4) Keep graceful degradation as default contract
**Decision:** Memory failures remain non-fatal; missing sources are omitted from context and session persistence is skipped with structured warnings.

**Why:** Maintains service availability while improving observability.

## Risks / Trade-offs

- **[Risk] Local setups without Docker updates still fail episodic memory** → Mitigation: readiness warnings should explicitly call out missing modules and expected image.
- **[Risk] Additional probe logic adds branching complexity** → Mitigation: centralize checks in one helper and reuse across retrieve/persist paths.
- **[Trade-off] More explicit config increases file verbosity** → Mitigation: keep defaults concise and aligned with dataclass definitions.
- **[Trade-off] Cached readiness can become stale** → Mitigation: add TTL/periodic refresh or retry window.

## Migration Plan

1. Update local compose/docs to Redis Stack-compatible defaults.
2. Add explicit `memory:` section in `config.yml` matching intended defaults.
3. Implement readiness helper and wire it into episodic retrieval/persistence gates.
4. Validate behavior in two scenarios:
   - Redis Stack present: episodic retrieval/persist paths execute.
   - Plain Redis/missing modules: deterministic degraded logs, no FT.* spam loop.
5. Rollback strategy: revert compose/config and disable episodic path via config flags while keeping findings store active.

## Open Questions

- Should readiness status be exposed through an API endpoint (e.g., monitor) or remain log-only for now?
- Should degraded-state metrics be added to existing observability counters in this change or deferred?

## Context

The repository already has substantial L0/L1 code paths (working summarization, episodic retrieval/persistence, readiness checks), but there is a mismatch between specs and runtime configuration stability. Recent startup failures confirmed NAT rejects unknown top-level keys (e.g., `cognitive_memory`) and may reserve `memory` for its own discriminator schema. In parallel, L2 semantic memory is specified but not fully wired in production code.

## Goals / Non-Goals

**Goals:**
- Complete L2 semantic memory implementation with async extraction after findings persistence.
- Keep NAT startup stable by decoupling app memory config from NAT schema-sensitive top-level keys.
- Preserve graceful degradation when Redis/Milvus capabilities are missing.
- Provide explicit L0/L1/L2 configuration and operator visibility.

**Non-Goals:**
- Replacing Milvus/Redis with new backends.
- Rewriting the existing L0/L1 architecture.
- Introducing blocking behavior for memory failures.

## Decisions

### 1) Use a dedicated memory config file
**Decision:** Load memory config from a dedicated file (e.g., `src/cognitive_code_agent/configs/memory.yml`) and treat `config.yml` memory sections as optional backward-compat fallback.

**Why:** Avoid NAT `Config` validation conflicts while keeping explicit configuration.

**Alternatives considered:**
- Keep `memory` at NAT root with discriminator tags: brittle and coupled to NAT internals.
- Keep implicit dataclass defaults only: stable but opaque and hard to operate.

### 2) Implement L2 as async, non-blocking post-persist pipeline
**Decision:** Trigger semantic extraction only after successful `persist_findings` (>=3 findings) using fire-and-forget execution.

**Why:** Matches existing non-blocking contract and avoids latency regression on core tool response.

**Alternatives considered:**
- Inline extraction in `persist_findings`: increases tail latency and failure coupling.

### 3) Extend readiness to semantic source
**Decision:** Reuse readiness helpers to gate semantic retrieval/upsert paths and emit structured degraded reasons.

**Why:** Keeps behavior deterministic and consistent with episodic/findings readiness model.

### 4) Keep retrieval assembly source-aware
**Decision:** Auto-retrieval composes memory block from enabled+ready sources only (episodic, findings, semantic), with exact section omission per source.

**Why:** Avoids partial failures leaking to user path and keeps context block trustworthy.

## Risks / Trade-offs

- **[Risk] Config split confusion (`config.yml` + `memory.yml`)** → Mitigation: strict loader precedence, startup logging of active config source, docs with examples.
- **[Risk] Semantic extraction noise/duplicates** → Mitigation: similarity-based consolidation and confidence update policy from spec.
- **[Trade-off] More moving parts in readiness gating** → Mitigation: centralize probes in `memory/readiness.py` and unit-test each gate.

## Migration Plan

1. Add dedicated memory config file and loader precedence.
2. Keep temporary fallback to old inline memory config to avoid abrupt breakage.
3. Implement semantic extraction + domain knowledge upsert pipeline.
4. Wire semantic retrieval into auto-retrieval with readiness gating.
5. Update tests/docs and run regression checks.
6. Remove fallback path in a follow-up once deployments are migrated.

## Open Questions

- Should we expose effective memory layer status (L0/L1/L2 enabled+ready) via a health/debug endpoint?
- Do we want per-layer token/cost telemetry in this change or defer to observability follow-up?

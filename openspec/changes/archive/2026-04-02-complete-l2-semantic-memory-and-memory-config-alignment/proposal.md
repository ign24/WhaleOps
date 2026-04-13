## Why

We paused in the middle of the L0/L1/L2 memory rollout: L0/L1 are mostly implemented, but L2 semantic memory is still spec-only, and recent config edits showed that NAT schema validation can break startup when memory config is placed in unsupported top-level keys. We need to finish L2 and make memory configuration schema-safe so the agent boots reliably while preserving explicit memory controls.

## What Changes

- Complete L2 semantic memory pipeline (`domain_knowledge`) and wire it to `persist_findings` as async post-processing.
- Re-enable/complete semantic source in auto-retrieval with readiness gating and deterministic degradation.
- Introduce schema-safe memory configuration loading that does not depend on unsupported NAT top-level config fields.
- Formalize L0/L1/L2 operator model in docs and config examples (L0=working, L1=episodic+findings, L2=semantic).

## Capabilities

### New Capabilities
- `memory-layer-configuration`: Explicit, schema-safe configuration contract for L0/L1/L2 memory settings and loader precedence.

### Modified Capabilities
- `semantic-knowledge-accumulation`: Move from spec-only to implemented behavior with async extraction, confidence updates, and Milvus persistence.
- `findings-store`: Ensure `persist_findings` conditionally triggers semantic extraction based on config + finding count.
- `automatic-memory-retrieval`: Include semantic retrieval (when enabled and ready) alongside episodic/findings with source-specific degradation behavior.
- `memory-backend-readiness`: Extend readiness checks to cover semantic collection availability and retrieval gating.

## Impact

- **Code**: `src/cognitive_code_agent/memory/*`, `src/cognitive_code_agent/tools/findings_store.py`, `src/cognitive_code_agent/agents/safe_tool_calling_agent.py`.
- **Config**: Introduce/standardize memory config source outside NAT-conflicting root schema; keep backward-compatible fallback during migration.
- **Data**: Milvus `domain_knowledge` collection lifecycle and indexes.
- **Docs/Ops**: README + deployment notes for L0/L1/L2 behavior, readiness expectations, and troubleshooting.

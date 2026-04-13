## Easypanel Setup (Milvus Memory Stack)

Use this in a **new project** (example: `cgn-agent-v2`).

Important:

- Create all services with **Replicas = 1**.
- Set **Zero Downtime = OFF** for `redis`, `milvus-etcd`, `milvus-minio`, `milvus-standalone`.
- For mounts, always use **Add Volume Mount** (not Bind Mount).

---

## Service: `milvus-etcd`

Source type: `Docker Image`

Image:

```text
quay.io/coreos/etcd:v3.5.18
```

Command:

```text
etcd
```

Environment:

```text
ETCD_DATA_DIR=/etcd
ETCD_ADVERTISE_CLIENT_URLS=http://milvus-etcd:2379
ETCD_LISTEN_CLIENT_URLS=http://0.0.0.0:2379
ETCD_AUTO_COMPACTION_MODE=revision
ETCD_AUTO_COMPACTION_RETENTION=1000
ETCD_QUOTA_BACKEND_BYTES=4294967296
ETCD_SNAPSHOT_COUNT=50000
```

Mount:

```text
Volume: etcd_data_v2
Path: /etcd
```

---

## Service: `milvus-minio`

Source type: `Docker Image`

Image:

```text
minio/minio:RELEASE.2025-07-23T15-54-02Z
```

Command:

```text
minio server /minio_data --console-address :9001
```

Environment:

```text
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
```

Do NOT set:

```text
MINIO_ACCESS_KEY
MINIO_SECRET_KEY
```

Mount:

```text
Volume: minio_data_v2
Path: /minio_data
```

---

## Service: `milvus-standalone`

Source type: `Docker Image`

Image:

```text
milvusdb/milvus:v2.5.5
```

Command:

```text
milvus run standalone
```

Environment:

```text
ETCD_ENDPOINTS=milvus-etcd:2379
MINIO_ADDRESS=milvus-minio:9000
```

Mount:

```text
Volume: milvus_data_v2
Path: /var/lib/milvus
```

Ports (if exposed):

```text
19530
9091
```

---

## Service: `redis`

Source type: `Docker Image`

Image (Redis Stack required for episodic memory — includes RediSearch + RedisJSON):

```text
redis/redis-stack-server:latest
```

Command:

```text
redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru --requirepass YOUR_REDIS_PASSWORD --loadmodule /opt/redis-stack/lib/redisearch.so --loadmodule /opt/redis-stack/lib/rejson.so
```

Mount:

```text
Volume: redis_data_v2
Path: /data
```

---

## Service: `agent` (NAT)

Source type: `Git`

Repository URL:

```text
git@github.com:Cognitive-la/CGN-Agent.git
```

Branch:

```text
main
```

Build Path:

```text
/
```

Environment:

```text
MILVUS_URI=http://<project>_milvus-standalone:19530
REDIS_URL=redis://:YOUR_REDIS_PASSWORD@<project>_redis:6379/0
TRACES_PATH=/app/traces/agent_traces.jsonl
LOGS_PATH=/app/logs/agent.log
```

Plus your secrets, for example:

```text
NVIDIA_API_KEY=...
TAVILY_API_KEY=...
GITHUB_TOKEN=...
CONTEXT7_API_KEY=...
```

Proxy port:

```text
8000
```

Optional mounts:

```text
Volume: agent_logs_v2   Path: /app/logs
Volume: agent_traces_v2 Path: /app/traces
```

---

## Deploy Order

1. `milvus-etcd`
2. `milvus-minio`
3. `milvus-standalone`
4. `redis`
5. `agent`

Optional (if you expose MCP over HTTP):
6. `mcp-server`

---

## Optional service: `mcp-server` (streamable HTTP)

If you need a standalone MCP endpoint (for non-CLI clients), deploy `mcp-server`
as an additional service.

Environment:

```text
MCP_AGENT_URL=http://<project>_agent:8000
MCP_TRANSPORT=streamable-http
MCP_PORT=3100
```

Proxy port:

```text
3100
```

---

## Memory Configuration

The agent uses `src/cognitive_code_agent/configs/memory.yml` to control L0/L1/L2 memory layers:

```yaml
working:        # L0: within-session context summarization
  enabled: true
  summarize_on_eviction: true
episodic:       # L1: cross-session summaries in Redis (requires Redis Stack)
  enabled: true
  store: redis
  ttl_days: 90
semantic:       # L2: generalized knowledge in Milvus (domain_knowledge)
  enabled: true
  collection_name: domain_knowledge
auto_retrieval: # Pre-fetch context at session start
  enabled: true
  timeout_seconds: 2
```

**Important:** Episodic memory requires Redis Stack (`redis/redis-stack-server`) with
RediSearch and RedisJSON modules. The standard `redis:7-alpine` image does not include these.
Do not use plain Redis for episodic memory in production or local parity tests.

---

## Quick Validation

- `milvus-minio` logs: should NOT contain `found backend type fs`.
- `milvus-standalone` logs: should NOT contain `lookup ... no such host`.
- `redis` logs: should show `Module 'ReJSON'` and `Module 'search'` loaded successfully.
- In chat, ask:
  - `Tenemos guardado algo por ahora?`
  - Should respond without Milvus socket errors.
- Memory test:
  - `Usa persist_findings con repo_id "test" y findings_json: {"summary":"Test","finding_type":"infra","severity":"low"}`
  - Should return `status: ok`.

If you see `unknown command 'FT.INFO'` or `unknown command 'FT.SEARCH'`:
- Confirm Redis service image is `redis/redis-stack-server:latest`
- Recheck REDIS_URL target and credentials
- Restart `redis` first, then `agent`

If you see `Invalid configuration ... memory` when NAT boots:
- Do not add app memory keys at top-level `config.yml` unless NAT schema explicitly supports them
- Keep app memory configuration in `src/cognitive_code_agent/configs/memory.yml`

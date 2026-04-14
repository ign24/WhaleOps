
# Ops Agent

![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)
![NVIDIA NAT](https://img.shields.io/badge/NVIDIA%20NAT-1.4.1-76B900?logo=nvidia&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-SDK-2496ED?logo=docker&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![Status](https://img.shields.io/badge/Status-v1.0-orange)

Infrastructure operations assistant for Cognitive LATAM LLC. Monitors Docker containers on the host via Docker Python SDK. Read-only (Tier 0).

# WhaleOps

## What it does

- Lists running and stopped containers
- Fetches container logs (last N lines)
- Inspects container health: exit codes, restart counts, restart policy
- Escalates anomalies with severity labels: `INFO` / `WARN` / `CRIT`
- Suggests manual Docker CLI commands when write access is needed

**Tier 0 constraint**: the agent never restarts, stops, or modifies containers. It reports and escalates only.

## Architecture

```
Telegram ──────────────────────────────────┐
                                           |
Browser ─── ui-cognitive (:3000)           |
                  |                        |
           Next.js BFF (:3000)             |
                  |                        ↓
           NAT Agent (:8000) ──── /telegram/webhook
                  |
       +----------+----------+
       |          |          |
  Docker SDK   SQLite     APScheduler
  (docker.sock) (ops_notes.db) + Redis job store
       |                    |
  Redis Stack (:6379)  Milvus (:19530)
  (episodic memory)    (findings store)
```

## Tools

| Tool | Description |
|------|-------------|
| `list_containers` | Lists all containers with name, image, status, and uptime |
| `inspect_container` | Inspects a single container: exit code, restart count, restart policy |
| `get_container_logs` | Fetches last N lines of logs for a container (max 500) |
| `save_note` | Persists a structured note to the SQLite memory store (types: daily_summary, instruction, pattern, anomaly) |
| `get_notes` | Retrieves recent notes from the SQLite store filtered by container and/or type |
| `schedule_task` | Schedules a recurring monitoring task (APScheduler, persisted in Redis) |

## Stack

| Layer | Technology |
|-------|-----------|
| Agent runtime | Python 3.11, NVIDIA NAT 1.4.1 |
| LLM | Devstral 2-123B (all modes) via NVIDIA NIM |
| Container access | Docker Python SDK (`docker.from_env()`) |
| Structured memory | SQLite (`ops_notes.db`) — instructions, patterns, summaries |
| Episodic memory | Redis Stack 7 — cross-session session summaries |
| Semantic memory | Milvus 2.5 — historical findings vector store |
| Cron jobs | APScheduler + Redis job store (namespace `ops:apscheduler:*`) |
| Telegram gateway | `python-telegram-bot` — webhook endpoint at `/telegram/webhook` |
| UI | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4 |
| Auth | Auth.js / NextAuth 5 beta |

## Services (docker-compose)

| Service | Purpose |
|---------|---------|
| `agent` | NAT server — `:8000` |
| `mcp-server` | MCP bridge — `:3100` (optional) |
| `redis` | Episodic memory + cron jobs — Redis Stack, DB 1 |
| `milvus-standalone` | Historical findings vector store — `ops_findings` collection |
| `etcd` | Milvus metadata store |
| `minio` | Milvus object storage |

## Run

```bash
# Docker (recommended)
docker compose up --build

# Bootstrap ops_findings collection (first run, after Milvus is up)
python scripts/bootstrap_milvus_ops.py --uri http://localhost:19530

# Local dev
uv sync
uv run nat serve --config_file src/cognitive_code_agent/configs/config.yml --host 0.0.0.0 --port 8000
```

## Environment

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `NVIDIA_API_KEY` | Yes | NVIDIA NIM API key |
| `REDIS_URL` | No | Redis Stack URL (default: `redis://redis:6379/1`) |
| `MILVUS_URI` | No | Milvus endpoint (default: `http://milvus-standalone:19530`) |
| `TRACES_PATH` | No | JSONL trace output path |
| `LOGS_PATH` | No | Log file path |
| `NOTES_DB_PATH` | No | SQLite structured memory path (default: `/app/data/ops_notes.db`) |
| `TELEGRAM_BOT_TOKEN` | No | Token from @BotFather |
| `TELEGRAM_WEBHOOK_URL` | No | Public HTTPS URL for Telegram webhook |
| `TELEGRAM_ALLOWED_CHAT_IDS` | No | Comma-separated allowed chat IDs |
| `TELEGRAM_WEBHOOK_SECRET` | No | Secret validated from `X-Telegram-Bot-Api-Secret-Token` header |

## Testing

```bash
uv run pytest -m "not e2e" -q
```

## Observability

Traces written to `./traces/agent_traces.jsonl`. Metrics at `GET /monitor/users`.

## NAT Annotation Pitfall

Do **not** use `from __future__ import annotations` in modules that register NAT
functions via `FunctionInfo.from_fn(...)`. NAT reads annotations via
`inspect.signature` at startup — deferred annotations cause `TypeError: issubclass()
arg 1 must be a class` during workflow compilation.

## License

Copyright (c) Cognitive LATAM LLC. All rights reserved. Proprietary and confidential.

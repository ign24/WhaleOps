## ADDED Requirements

### Requirement: Redis key prefix isolated to ops namespace
The system SHALL set a `key_prefix` of `"ops:"` in `memory.yml` for all Redis key operations (working memory, episodic memory, embedding cache) so that ops-agent keys never collide with code-agent keys on the same Redis instance.

#### Scenario: Episodic memory writes use ops prefix
- **WHEN** the agent persists an episodic summary at session end
- **THEN** the Redis key begins with `ops:` and does not overwrite code-agent keys

#### Scenario: Episodic memory retrieval scans only ops prefix
- **WHEN** the agent retrieves past session context at session start
- **THEN** only keys prefixed with `ops:` are queried, not `cgn:` or other prefixes

### Requirement: Episodic memory uses Redis DB index 1
The system SHALL configure the episodic memory Redis connection to use `db: 1` so that ops sessions are stored in a separate logical database from the code-agent default (DB 0).

#### Scenario: Ops agent connects to Redis DB 1
- **WHEN** the episodic memory layer initialises
- **THEN** the Redis client is connected to DB index 1

### Requirement: APScheduler Redis job store uses ops namespace
The system SHALL configure the APScheduler Redis job store (used by `schedule_task`) to use a key prefix of `ops:apscheduler:` instead of the code-agent default `cgn:apscheduler:`.

#### Scenario: Cron jobs stored under ops prefix
- **WHEN** a scheduled task is created via `schedule_task`
- **THEN** the APScheduler job is persisted in Redis under the `ops:apscheduler:*` key namespace

### Requirement: Readiness check logs warning if Redis DB 1 unavailable
The system SHALL update the Redis readiness check in `memory/readiness.py` to verify connectivity to DB 1. If DB 1 is unavailable, the system SHALL log a WARNING and degrade gracefully (disable episodic memory) rather than hard-failing startup.

#### Scenario: Agent starts with Redis DB 1 unavailable
- **WHEN** the Redis server does not expose DB index 1
- **THEN** the agent starts successfully, episodic memory is disabled, and a WARNING is logged indicating the DB index issue

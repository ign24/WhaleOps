## Context

The agent operates two filesystem roots: `/tmp/analysis` (sandbox, ephemeral per container restart) and `/app/workspace` (persistent across runs). Both can hold multiple cloned repos. Today there is no deletion path — `rm -r` is TIER_3_BLOCKED in the safety classifier, and `@modelcontextprotocol/server-filesystem` exposes no delete tool.

In single-user deployments this is a nuisance. In shared team deployments it becomes a problem: repos accumulate, disk fills, and no team member can clean up through the agent. The fix must work without introducing security regressions (PIN in LLM context, path traversal, unbounded deletes).

Current safe pattern in `clone_tools.py` (`_resolve_destination` + `ensure_within_allowed_roots`) is the template for path confinement in the new tool.

## Goals / Non-Goals

**Goals:**
- Agent can delete any repo from sandbox automatically (no PIN, ephemeral)
- Agent can initiate a workspace delete; UI handles PIN confirmation out-of-band
- PIN never enters the LLM context or chat history
- Every error path returns structured JSON so the agent loop continues
- Ownership metadata written at clone time (who cloned what, when)
- Admin configures a bcrypt-hashed PIN via env var; no plaintext secrets at rest

**Non-Goals:**
- Deleting arbitrary paths outside the two known roots
- Remote branch deletion (separate concern)
- Session deletion (separate concern)
- Per-user PINs or role-based delete authorization (future iteration)
- Undo / recycle bin

## Decisions

### D1: Tool returns "awaiting_ui_confirmation" instead of blocking the loop

**Decision**: `workspace_delete` for workspace targets returns immediately with `status="awaiting_ui_confirmation"` plus a UUID token. The UI picks this up from the tool result stream, shows the PIN modal, and POSTs to a separate API route. The agent loop continues — it tells the user "waiting for PIN confirmation in the UI" and stops.

**Alternatives considered**:
- LangGraph `NodeInterrupt`: pauses the graph, requires checkpointer wired up and frontend polling. HITL infrastructure exists but is not fully wired. Too much scope.
- `confirmed=True` parameter: agent would need the user to type the PIN in chat ("confirmed, PIN is 1234") — PIN enters LLM context and chat history. Rejected on security grounds.

**Rationale**: Decouples the destructive operation from the agent loop entirely. The agent is an initiator, not an executor for workspace deletes.

### D2: Confirmation token is UUID v4, single-use, 5-minute TTL, in-memory store

**Decision**: On tool call, generate a UUID token and store `{token: {path, size_mb, expires_at}}` in a module-level dict in the Next.js API layer (or a lightweight Redis if available). The `/api/workspace/delete/confirm` endpoint consumes the token (deletes from store on use).

**Alternatives considered**:
- Signed JWT: stateless, but harder to invalidate before expiry
- SQLite: durable but overkill for a 5-minute window

**Rationale**: Simple, no extra dependency, TTL prevents stale tokens from being replayed. In-process store is fine since confirm always hits the same Next.js instance.

### D3: Sandbox deletes are auto-executed, no PIN

**Decision**: `location="sandbox"` → `shutil.rmtree` directly, no confirmation flow, returns `status="deleted"`.

**Rationale**: `/tmp/analysis` is ephemeral by design (lost on container restart). Requiring PIN for ephemeral content creates friction with no safety benefit.

### D4: Ownership via `.clone_meta.json` written by `clone_repository`

**Decision**: After a successful clone, write `<repo_dir>/.clone_meta.json` with `{cloned_by, cloned_at, repo_url, location}`. `workspace_delete` reads this file (if present) to include ownership info in the tool result.

**Alternatives considered**:
- Central manifest file at root: requires locking for concurrent clones
- DB table: requires schema migration

**Rationale**: Co-locating metadata with the repo keeps them in sync automatically — if you delete the repo, you delete the metadata. No external state to sync.

### D5: PIN stored as bcrypt hash in env var

**Decision**: `WORKSPACE_DELETE_PIN_HASH` holds the bcrypt hash. The confirm endpoint does `bcrypt.compare(incoming_pin, process.env.WORKSPACE_DELETE_PIN_HASH)`. Plain `WORKSPACE_DELETE_PIN` is never stored.

**Rationale**: If the `.env` file or container secrets leak, the plaintext PIN is not exposed. Standard bcrypt cost factor (12) is sufficient for a team PIN.

### D6: All error paths return structured JSON, `retryable` flag included

**Decision**: Every failure case returns `{status, message, retryable, error_type}`. The agent uses `retryable` to decide whether to suggest retry or escalate to the user.

| status | retryable | agent action |
|---|---|---|
| `awaiting_ui_confirmation` | n/a | inform user, show token |
| `confirmation_denied` | false | tell user PIN was wrong, they can retry in UI |
| `token_expired` | true | re-call workspace_delete to get new token |
| `not_found` | false | inform user, suggest listing workspace |
| `blocked` | false | inform user of path restriction |
| `execution_error` | true | retry once, then escalate |
| `deleted` | n/a | report size freed |

## Risks / Trade-offs

- **In-memory token store resets on Next.js hot reload** → TTL is short (5 min), acceptable. Cold restarts are rare during active use.
- **Concurrent deletes of same target** → second delete gets `not_found` after first succeeds. Acceptable — idempotent outcome.
- **bcrypt cost adds ~100ms to confirm endpoint** → acceptable for a destructive operation; not on the hot path.
- **`.clone_meta.json` missing** → delete proceeds without ownership info in response. Not a blocker — metadata is informational only.
- **Python backend delete call from Next.js** → confirm route POSTs to `AGENT_BASE_URL/workspace/delete` (internal API). Adds a network hop but keeps deletion logic in Python where path confinement tests already exist.

## Open Questions

- Should sandbox deletes also write a deletion log entry (for observability)? Not scoped here — can add later.
- Should the modal show a "who cloned this" attribution? Data is available via `.clone_meta.json`. Nice to have, not required for v1.

"""SQLite-based structured memory tools for ops-agent.

Provides two NAT-registered tools:
  - save_note: persist a structured note (instruction, pattern, daily_summary, anomaly)
  - get_notes: retrieve notes filtered by container and/or type, ordered by recency

Database is stored at $NOTES_DB_PATH (default: /app/data/ops_notes.db).
Schema is created on first use — no bootstrap script required.

Do NOT add ``from __future__ import annotations`` — NAT's FunctionInfo
introspection reads inspect.signature annotations at runtime and fails on
Python 3.11 when annotations are deferred strings.
"""

import logging
import os
import sqlite3
import time
import uuid
from contextlib import contextmanager
from typing import Generator, Literal

from pydantic import Field

from nat.builder.builder import Builder
from nat.builder.function_info import FunctionInfo
from nat.cli.register_workflow import register_function
from nat.data_models.function import FunctionBaseConfig

logger = logging.getLogger(__name__)

DB_PATH = os.environ.get("NOTES_DB_PATH", "/app/data/ops_notes.db")

NoteType = Literal["instruction", "pattern", "daily_summary", "anomaly"]

_SCHEMA = """
CREATE TABLE IF NOT EXISTS ops_notes (
    id            TEXT PRIMARY KEY,
    container_name TEXT NOT NULL DEFAULT '',
    note_type     TEXT NOT NULL,
    content       TEXT NOT NULL,
    created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_container ON ops_notes (container_name);
CREATE INDEX IF NOT EXISTS idx_notes_type      ON ops_notes (note_type);
CREATE INDEX IF NOT EXISTS idx_notes_created   ON ops_notes (created_at DESC);
"""


@contextmanager
def _db() -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        conn.executescript(_SCHEMA)
        yield conn
        conn.commit()
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# NAT-registered tools
# ---------------------------------------------------------------------------

class SaveNoteConfig(FunctionBaseConfig, name="save_note"):
    description: str = Field(
        default=(
            "Persist a structured note to the ops memory store. "
            "Use note_type='daily_summary' for end-of-day reports, "
            "'instruction' for rules about a container, "
            "'pattern' for recurring behaviours, "
            "'anomaly' for one-off incidents."
        ),
    )


@register_function(config_type=SaveNoteConfig)
async def save_note_tool(config: SaveNoteConfig, builder: Builder):
    async def _run(
        content: str,
        note_type: str = "pattern",
        container_name: str = "",
    ) -> str:
        """Save a note to the ops structured memory store.

        Args:
            content:        The note body. Be concise and factual.
            note_type:      One of: instruction, pattern, daily_summary, anomaly.
            container_name: Container this note relates to. Leave empty for host-level notes.
        """
        valid_types = {"instruction", "pattern", "daily_summary", "anomaly"}
        if note_type not in valid_types:
            return f"Error: note_type must be one of {sorted(valid_types)}, got '{note_type}'."

        note_id = str(uuid.uuid4())[:16]
        ts = int(time.time())
        try:
            with _db() as conn:
                conn.execute(
                    "INSERT INTO ops_notes (id, container_name, note_type, content, created_at) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (note_id, container_name or "", note_type, content, ts),
                )
            scope = f"container '{container_name}'" if container_name else "host"
            return f"Note saved (id={note_id}, type={note_type}, scope={scope})."
        except Exception as exc:
            logger.error("save_note: failed to write to %s: %s", DB_PATH, exc)
            return f"Error: could not save note — {exc}"

    yield FunctionInfo.from_fn(_run, description=config.description)


class GetNotesConfig(FunctionBaseConfig, name="get_notes"):
    description: str = Field(
        default=(
            "Retrieve recent notes from the ops memory store. "
            "Filter by container_name and/or note_type. "
            "Returns the most recent notes first (default limit: 20)."
        ),
    )


@register_function(config_type=GetNotesConfig)
async def get_notes_tool(config: GetNotesConfig, builder: Builder):
    async def _run(
        container_name: str = "",
        note_type: str = "",
        limit: int = 20,
    ) -> str:
        """Retrieve notes from the ops structured memory store.

        Args:
            container_name: Filter to a specific container. Empty = all containers.
            note_type:      Filter by type (instruction/pattern/daily_summary/anomaly). Empty = all.
            limit:          Maximum number of notes to return (default 20, max 100).
        """
        safe_limit = min(max(1, limit), 100)
        query = "SELECT id, container_name, note_type, content, created_at FROM ops_notes WHERE 1=1"
        params: list = []

        if container_name:
            query += " AND container_name = ?"
            params.append(container_name)
        if note_type:
            query += " AND note_type = ?"
            params.append(note_type)

        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(safe_limit)

        try:
            with _db() as conn:
                rows = conn.execute(query, params).fetchall()
        except Exception as exc:
            logger.error("get_notes: failed to query %s: %s", DB_PATH, exc)
            return f"Error: could not retrieve notes — {exc}"

        if not rows:
            filters = []
            if container_name:
                filters.append(f"container='{container_name}'")
            if note_type:
                filters.append(f"type='{note_type}'")
            scope = ", ".join(filters) if filters else "all"
            return f"No notes found ({scope})."

        lines = []
        for row in rows:
            ts_str = time.strftime("%Y-%m-%d %H:%M", time.localtime(row["created_at"]))
            container_label = f"[{row['container_name']}] " if row["container_name"] else "[host] "
            lines.append(
                f"{ts_str} | {row['note_type']:<15} | {container_label}{row['content']}"
            )
        return "\n".join(lines)

    yield FunctionInfo.from_fn(_run, description=config.description)

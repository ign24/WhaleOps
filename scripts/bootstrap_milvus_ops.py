#!/usr/bin/env python3
"""Bootstrap the ops_findings Milvus collection for ops-agent historical log analysis.

Schema is intentionally different from qa_findings (code-agent):
  - container_name / host instead of repo_id / file_path
  - log_window instead of commit_sha / branch
  - anomaly_type / severity for ops escalation labels

Usage:
    python scripts/bootstrap_milvus_ops.py --uri http://localhost:19530
"""

from __future__ import annotations

import argparse
from typing import Sequence

from pymilvus import Collection, CollectionSchema, DataType, FieldSchema, connections, utility


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bootstrap Milvus ops_findings collection")
    parser.add_argument("--uri", default="http://localhost:19530", help="Milvus URI")
    parser.add_argument("--token", default="", help="Milvus token (optional)")
    parser.add_argument("--collection", default="ops_findings", help="Collection name")
    parser.add_argument("--dim", type=int, default=2048, help="Embedding dimension")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)

    connect_kwargs: dict = {"alias": "default", "uri": args.uri}
    if args.token:
        connect_kwargs["token"] = args.token
    connections.connect(**connect_kwargs)

    if utility.has_collection(args.collection):
        print(f"Collection '{args.collection}' already exists — skipping")
        return 0

    fields = [
        FieldSchema(name="id", dtype=DataType.VARCHAR, is_primary=True, max_length=64),
        # partition key: one partition per container name for efficient scoped queries
        FieldSchema(name="container_name", dtype=DataType.VARCHAR, max_length=256, is_partition_key=True),
        FieldSchema(name="host", dtype=DataType.VARCHAR, max_length=128),
        # ISO-8601 window: "2026-04-13T22:00:00Z/2026-04-13T22:05:00Z"
        FieldSchema(name="log_window", dtype=DataType.VARCHAR, max_length=64),
        FieldSchema(name="anomaly_type", dtype=DataType.VARCHAR, max_length=128),
        # INFO / WARN / CRIT
        FieldSchema(name="severity", dtype=DataType.VARCHAR, max_length=8),
        FieldSchema(name="summary", dtype=DataType.VARCHAR, max_length=8192),
        FieldSchema(name="raw_excerpt", dtype=DataType.VARCHAR, max_length=8192),
        FieldSchema(name="recommendation", dtype=DataType.VARCHAR, max_length=4096),
        FieldSchema(name="content_hash", dtype=DataType.VARCHAR, max_length=64),
        FieldSchema(name="created_at", dtype=DataType.INT64),
        FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=args.dim),
    ]

    schema = CollectionSchema(
        fields,
        description="Ops-agent historical log findings and anomaly store",
        enable_dynamic_field=False,
    )

    collection = Collection(name=args.collection, schema=schema)
    collection.create_index(
        field_name="embedding",
        index_params={"index_type": "AUTOINDEX", "metric_type": "COSINE", "params": {}},
    )

    print(f"Collection '{args.collection}' created (partition key: container_name, dim={args.dim})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

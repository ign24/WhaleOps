#!/usr/bin/env python3

from __future__ import annotations

import argparse
from typing import Sequence

from pymilvus import Collection
from pymilvus import CollectionSchema
from pymilvus import DataType
from pymilvus import FieldSchema
from pymilvus import connections
from pymilvus import utility


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bootstrap Milvus collection for findings storage")
    parser.add_argument("--uri", default="http://localhost:19530", help="Milvus URI")
    parser.add_argument("--token", default="", help="Milvus token (optional)")
    parser.add_argument("--collection", default="qa_findings", help="Collection name")
    parser.add_argument("--dim", type=int, default=2048, help="Embedding dimension")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    connect_kwargs = {"alias": "default", "uri": args.uri}
    if args.token:
        connect_kwargs["token"] = args.token
    connections.connect(**connect_kwargs)

    if utility.has_collection(args.collection):
        print(f"Collection '{args.collection}' already exists")
        return 0

    fields = [
        FieldSchema(name="id", dtype=DataType.VARCHAR, is_primary=True, max_length=64),
        FieldSchema(name="repo_id", dtype=DataType.VARCHAR, max_length=128, is_partition_key=True),
        FieldSchema(name="branch", dtype=DataType.VARCHAR, max_length=128),
        FieldSchema(name="commit_sha", dtype=DataType.VARCHAR, max_length=64),
        FieldSchema(name="file_path", dtype=DataType.VARCHAR, max_length=1024),
        FieldSchema(name="finding_type", dtype=DataType.VARCHAR, max_length=128),
        FieldSchema(name="severity", dtype=DataType.VARCHAR, max_length=16),
        FieldSchema(name="summary", dtype=DataType.VARCHAR, max_length=8192),
        FieldSchema(name="recommendation", dtype=DataType.VARCHAR, max_length=8192),
        FieldSchema(name="rule_id", dtype=DataType.VARCHAR, max_length=128),
        FieldSchema(name="agent", dtype=DataType.VARCHAR, max_length=64),
        FieldSchema(name="content_hash", dtype=DataType.VARCHAR, max_length=64),
        FieldSchema(name="created_at", dtype=DataType.INT64),
        FieldSchema(name="updated_at", dtype=DataType.INT64),
        FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=args.dim),
    ]

    schema = CollectionSchema(
        fields,
        description="CGN findings store",
        enable_dynamic_field=False,
    )

    collection = Collection(name=args.collection, schema=schema)
    collection.create_index(
        field_name="embedding",
        index_params={"index_type": "AUTOINDEX", "metric_type": "COSINE", "params": {}},
    )

    print(f"Collection '{args.collection}' created with partition key 'repo_id'")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

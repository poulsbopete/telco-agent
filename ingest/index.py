#!/usr/bin/env python3
"""Create index and bulk-ingest chunked carrier knowledge into Elasticsearch."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

INFERENCE_ID = os.getenv("INFERENCE_ID", "jina-embeddings-v3")
INDEX_NAME = os.getenv("TELCO_INDEX", "telco-tmobile-kb")


def es_headers(api_key: str) -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Authorization": f"ApiKey {api_key}",
    }


def ensure_inference(client: httpx.Client, es_url: str, api_key: str) -> None:
    endpoint = f"{es_url}/_inference/text_embedding/{INFERENCE_ID}"
    body = {
        "service": "elastic",
        "service_settings": {
            "model_id": "jina-embeddings-v3",
            "dimensions": 1024,
            "max_input_tokens": 8192,
        },
    }
    resp = client.put(endpoint, headers=es_headers(api_key), json=body)
    if resp.status_code >= 300 and resp.status_code != 409:
        print(f"WARN inference endpoint: HTTP {resp.status_code} {resp.text[:300]}", file=sys.stderr)


def ensure_index(client: httpx.Client, es_url: str, api_key: str, index: str) -> None:
    client.delete(f"{es_url}/{index}", headers=es_headers(api_key))
    mapping = {
        "settings": {"number_of_shards": 1, "number_of_replicas": 0},
        "mappings": {
            "properties": {
                "carrier": {"type": "keyword"},
                "persona_tags": {"type": "keyword"},
                "url": {"type": "keyword"},
                "chunk_id": {"type": "keyword"},
                "title": {"type": "text"},
                "heading": {"type": "text"},
                "section": {"type": "keyword"},
                "content": {"type": "text"},
                "body_semantic": {
                    "type": "semantic_text",
                    "inference_id": INFERENCE_ID,
                },
                "fetched_at": {"type": "date"},
            }
        },
    }
    resp = client.put(f"{es_url}/{index}", headers=es_headers(api_key), json=mapping)
    resp.raise_for_status()


def bulk_index(client: httpx.Client, es_url: str, api_key: str, index: str, chunks_dir: Path) -> int:
    lines: list[str] = []
    count = 0
    for path in sorted(chunks_dir.glob("*.chunks.json")):
        chunks = json.loads(path.read_text(encoding="utf-8"))
        for chunk in chunks:
            doc_id = chunk["chunk_id"].replace("/", "_").replace("#", "_")
            lines.append(json.dumps({"index": {"_index": index, "_id": doc_id}}))
            lines.append(json.dumps(chunk))
            count += 1

    if not lines:
        return 0

    body = "\n".join(lines) + "\n"
    resp = client.post(
        f"{es_url}/_bulk?refresh=true",
        headers={
            "Content-Type": "application/x-ndjson",
            "Authorization": f"ApiKey {api_key}",
        },
        content=body.encode("utf-8"),
        timeout=600.0,
    )
    resp.raise_for_status()
    result = resp.json()
    if result.get("errors"):
        failed = [item for item in result.get("items", []) if "error" in item.get("index", {})]
        print(f"WARN bulk had {len(failed)} failures", file=sys.stderr)
    return count


def index_chunks(chunks_dir: Path, index: str | None = None) -> int:
    es_url = os.getenv("ES_URL", "").rstrip("/")
    api_key = os.getenv("ES_API_KEY", "").strip()
    if not es_url or not api_key:
        print("ES_URL and ES_API_KEY are required.", file=sys.stderr)
        sys.exit(1)

    target = index or INDEX_NAME
    with httpx.Client(timeout=600.0) as client:
        ensure_inference(client, es_url, api_key)
        ensure_index(client, es_url, api_key, target)
        return bulk_index(client, es_url, api_key, target, chunks_dir)


def main() -> None:
    parser = argparse.ArgumentParser(description="Index chunked pages into Elasticsearch")
    parser.add_argument("--input", default=str(ROOT / "data/chunks/tmobile"))
    parser.add_argument("--index", default=INDEX_NAME)
    args = parser.parse_args()
    count = index_chunks(Path(args.input), args.index)
    print(f"Indexed {count} chunks into {args.index}")


if __name__ == "__main__":
    main()

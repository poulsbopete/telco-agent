#!/usr/bin/env python3
"""BFS crawl of carrier sites using Jina Reader."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urldefrag, urlparse

import httpx
import yaml
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

JINA_READER = "https://r.jina.ai"
LINK_RE = re.compile(r"\[([^\]]*)\]\((https?://[^)]+)\)")
TITLE_RE = re.compile(r"^#\s+(.+)$", re.MULTILINE)


def load_seed_config(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def normalize_url(url: str) -> str:
    url, _ = urldefrag(url.strip())
    parsed = urlparse(url)
    scheme = parsed.scheme or "https"
    netloc = parsed.netloc.lower()
    path = parsed.path.rstrip("/") or ""
    return f"{scheme}://{netloc}{path}"


def allowed(url: str, domains: list[str]) -> bool:
    host = urlparse(url).netloc.lower()
    return any(host == d or host.endswith(f".{d}") for d in domains)


def infer_persona_tags(url: str) -> list[str]:
    path = urlparse(url).path.lower()
    tags: list[str] = []
    if "/support" in path or "/help" in path:
        tags.append("care")
    if "/business" in path or "/enterprise" in path:
        tags.extend(["noc", "care"])
    if "/billing" in path or "/payment" in path or "/account" in path:
        tags.append("billing")
    if "/shop" in path or "/devices" in path or "/deals" in path or "/plans" in path:
        tags.append("retail")
    if "/coverage" in path or "/network" in path or "/5g" in path:
        tags.append("noc")
    if not tags:
        tags.append("care")
    return sorted(set(tags))


def infer_section(url: str) -> str:
    path = urlparse(url).path.strip("/")
    if not path:
        return "home"
    return path.split("/")[0]


def read_page(client: httpx.Client, url: str, api_key: str) -> tuple[str, list[str]]:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "text/plain",
        "X-Return-Format": "markdown",
        "X-With-Links-Summary": "true",
    }
    resp = client.get(f"{JINA_READER}/{url}", headers=headers, timeout=120.0)
    resp.raise_for_status()
    text = resp.text
    links = LINK_RE.findall(text)
    extracted = [normalize_url(href) for _, href in links]
    return text, extracted


def extract_title(markdown: str, url: str) -> str:
    match = TITLE_RE.search(markdown)
    if match:
        return match.group(1).strip()
    path = urlparse(url).path.strip("/") or "home"
    return path.replace("-", " ").title()


def crawl(config_path: Path, output_dir: Path) -> int:
    api_key = os.getenv("JINA_API_KEY", "").strip()
    if not api_key:
        print("JINA_API_KEY is required for crawling.", file=sys.stderr)
        sys.exit(1)

    cfg = load_seed_config(config_path)
    carrier = cfg["carrier"]
    domains = cfg["allow_domains"]
    max_depth = int(os.getenv("CRAWL_MAX_DEPTH", cfg.get("max_depth", 3)))
    max_pages = int(os.getenv("CRAWL_MAX_PAGES", cfg.get("max_pages", 200)))

    output_dir.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    queue: deque[tuple[str, int]] = deque()

    for seed in cfg["seeds"]:
        queue.append((normalize_url(seed), 0))

    saved = 0
    with httpx.Client(follow_redirects=True) as client:
        while queue and saved < max_pages:
            url, depth = queue.popleft()
            if url in seen:
                continue
            if not allowed(url, domains):
                continue
            seen.add(url)

            try:
                markdown, links = read_page(client, url, api_key)
            except httpx.HTTPError as exc:
                print(f"WARN skip {url}: {exc}", file=sys.stderr)
                continue

            doc = {
                "url": url,
                "carrier": carrier,
                "title": extract_title(markdown, url),
                "section": infer_section(url),
                "persona_tags": infer_persona_tags(url),
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "markdown": markdown,
            }
            slug = re.sub(r"[^a-zA-Z0-9]+", "-", urlparse(url).path.strip("/") or "home")[:80]
            out_path = output_dir / f"{saved:04d}-{slug}.json"
            out_path.write_text(json.dumps(doc, indent=2), encoding="utf-8")
            saved += 1
            print(f"[{saved}/{max_pages}] depth={depth} {url}")

            if depth < max_depth:
                for link in links:
                    if link not in seen and allowed(link, domains):
                        queue.append((link, depth + 1))

            time.sleep(0.5)

    manifest = {
        "carrier": carrier,
        "pages": saved,
        "output_dir": str(output_dir),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    (output_dir / "_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return saved


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl carrier site with Jina Reader")
    parser.add_argument(
        "--seeds",
        default=str(ROOT / "ingest/seeds/tmobile.yaml"),
        help="Path to seed YAML",
    )
    parser.add_argument(
        "--output",
        default=str(ROOT / "data/raw/tmobile"),
        help="Directory for raw page JSON",
    )
    args = parser.parse_args()
    count = crawl(Path(args.seeds), Path(args.output))
    print(f"Crawled {count} pages into {args.output}")


if __name__ == "__main__":
    main()

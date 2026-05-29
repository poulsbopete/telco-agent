#!/usr/bin/env python3
"""Heading-aware chunking of crawled markdown pages."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

HEADING_RE = re.compile(r"^(#{1,3})\s+(.+)$", re.MULTILINE)
APPROX_CHARS = 1000
OVERLAP_CHARS = 150


def split_sections(markdown: str) -> list[tuple[str, str]]:
    matches = list(HEADING_RE.finditer(markdown))
    if not matches:
        return [("", markdown.strip())]

    sections: list[tuple[str, str]] = []
    for idx, match in enumerate(matches):
        heading = match.group(2).strip()
        start = match.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(markdown)
        body = markdown[start:end].strip()
        if body:
            sections.append((heading, body))
    return sections or [("", markdown.strip())]


def chunk_text(text: str, max_chars: int = APPROX_CHARS, overlap: int = OVERLAP_CHARS) -> list[str]:
    text = text.strip()
    if len(text) <= max_chars:
        return [text] if text else []

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + max_chars)
        if end < len(text):
            split_at = text.rfind("\n\n", start, end)
            if split_at > start + max_chars // 2:
                end = split_at
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks


def chunk_page(page: dict) -> list[dict]:
    base = {
        "carrier": page["carrier"],
        "url": page["url"],
        "title": page["title"],
        "section": page.get("section", ""),
        "persona_tags": page.get("persona_tags", []),
        "fetched_at": page.get("fetched_at"),
    }
    chunks: list[dict] = []
    chunk_idx = 0
    for heading, body in split_sections(page.get("markdown", "")):
        for piece in chunk_text(body):
            chunk_idx += 1
            chunks.append(
                {
                    **base,
                    "chunk_id": f"{page['url']}#chunk-{chunk_idx}",
                    "heading": heading,
                    "content": f"{heading}\n\n{piece}".strip() if heading else piece,
                    "body_semantic": piece[:2000],
                }
            )
    return chunks


def chunk_directory(input_dir: Path, output_dir: Path) -> int:
    output_dir.mkdir(parents=True, exist_ok=True)
    total = 0
    for path in sorted(input_dir.glob("*.json")):
        if path.name.startswith("_"):
            continue
        page = json.loads(path.read_text(encoding="utf-8"))
        chunks = chunk_page(page)
        out_path = output_dir / f"{path.stem}.chunks.json"
        out_path.write_text(json.dumps(chunks, indent=2), encoding="utf-8")
        total += len(chunks)
    manifest = {"chunks": total, "source": str(input_dir), "output": str(output_dir)}
    (output_dir / "_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return total


def main() -> None:
    parser = argparse.ArgumentParser(description="Chunk crawled pages")
    parser.add_argument("--input", default=str(ROOT / "data/raw/tmobile"))
    parser.add_argument("--output", default=str(ROOT / "data/chunks/tmobile"))
    args = parser.parse_args()
    count = chunk_directory(Path(args.input), Path(args.output))
    print(f"Created {count} chunks in {args.output}")


if __name__ == "__main__":
    main()

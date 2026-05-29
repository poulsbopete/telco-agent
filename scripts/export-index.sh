#!/usr/bin/env bash
# Export telco knowledge index from Elastic Cloud to local snapshot NDJSON.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
[ -f "$ROOT/.env" ] && set -a && source "$ROOT/.env" && set +a

INDEX="${TELCO_INDEX:-telco-tmobile-kb}"
OUT_DIR="${1:-$ROOT/data/snapshots/tmobile}"
OUT_FILE="$OUT_DIR/${INDEX}.json"

mkdir -p "$OUT_DIR"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required (Node.js)." >&2
  exit 1
fi

if [ -z "${ES_URL:-}" ] || [ -z "${ES_API_KEY:-}" ]; then
  echo "ES_URL and ES_API_KEY must be set in .env" >&2
  exit 1
fi

echo "Exporting ${INDEX} from ${ES_URL} -> ${OUT_FILE}"
npx --yes elasticdump@6.104.0 \
  --input="${ES_URL}/${INDEX}" \
  --output="$OUT_FILE" \
  --type=data \
  --limit=100 \
  --headers='{"Authorization":"ApiKey '"${ES_API_KEY}"'"}'

echo "Export complete: ${OUT_FILE}"

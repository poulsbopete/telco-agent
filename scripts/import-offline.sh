#!/usr/bin/env bash
# Import telco knowledge snapshot into local Docker Elasticsearch (offline demo).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
[ -f "$ROOT/.env" ] && set -a && source "$ROOT/.env" && set +a

INDEX="${TELCO_INDEX:-telco-tmobile-kb}"
LOCAL_ES="${LOCAL_ES_URL:-http://localhost:9200}"
SNAPSHOT="${1:-$ROOT/data/snapshots/tmobile/${INDEX}.json}"
SAMPLE="${ROOT}/data/snapshots/tmobile/${INDEX}.sample.json"

mkdir -p "$(dirname "$SNAPSHOT")"

SOURCE="$SNAPSHOT"
if [ ! -f "$SOURCE" ] && [ -f "$SAMPLE" ]; then
  echo "Full snapshot missing; using sample: $SAMPLE"
  SOURCE="$SAMPLE"
fi

if [ ! -f "$SOURCE" ]; then
  echo "No snapshot found at $SNAPSHOT or $SAMPLE" >&2
  exit 1
fi

echo "Waiting for local Elasticsearch at ${LOCAL_ES}..."
for _ in $(seq 1 60); do
  if curl -fsS "${LOCAL_ES}/_cluster/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

curl -fsS "${LOCAL_ES}/_cluster/health" >/dev/null

echo "Recreating index ${INDEX} on local ES..."
curl -fsS -X DELETE "${LOCAL_ES}/${INDEX}" >/dev/null 2>&1 || true

curl -fsS -X PUT "${LOCAL_ES}/${INDEX}" -H 'Content-Type: application/json' -d '{
  "mappings": {
    "properties": {
      "carrier": { "type": "keyword" },
      "persona_tags": { "type": "keyword" },
      "url": { "type": "keyword" },
      "chunk_id": { "type": "keyword" },
      "title": { "type": "text" },
      "heading": { "type": "text" },
      "section": { "type": "keyword" },
      "content": { "type": "text" },
      "body_semantic": { "type": "text" },
      "fetched_at": { "type": "date" }
    }
  }
}'

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required for elasticdump import." >&2
  exit 1
fi

echo "Importing ${SOURCE}..."
npx --yes elasticdump@6.104.0 \
  --input="$SOURCE" \
  --output="${LOCAL_ES}/${INDEX}" \
  --type=data \
  --limit=100

curl -fsS -X POST "${LOCAL_ES}/${INDEX}/_refresh"
COUNT="$(curl -fsS "${LOCAL_ES}/${INDEX}/_count" | python3 -c 'import json,sys; print(json.load(sys.stdin)["count"])')"
echo "Imported ${COUNT} documents into ${INDEX}"

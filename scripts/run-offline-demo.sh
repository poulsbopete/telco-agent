#!/usr/bin/env bash
# Offline demo: local Elasticsearch + Next.js UI in RAG mode.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== Starting local Elasticsearch =="
docker compose -f docker/docker-compose.yml up -d

echo "== Importing snapshot =="
bash scripts/import-offline.sh

echo "== Starting web UI (offline RAG mode) =="
if [ ! -d node_modules ]; then
  npm install
fi

export DEMO_MODE=offline
export LOCAL_ES_URL="${LOCAL_ES_URL:-http://localhost:9200}"
export TELCO_INDEX="${TELCO_INDEX:-telco-tmobile-kb}"

echo ""
echo "Offline demo running at http://localhost:3000"
echo "DEMO_MODE=offline — uses /api/rag against local ES"
echo "Optional: start Ollama for LLM replies (OLLAMA_BASE_URL=http://localhost:11434)"
npm run dev

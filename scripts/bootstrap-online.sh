#!/usr/bin/env bash
# Online prep: crawl T-Mobile with Jina Reader, index to Serverless, deploy Agent Builder agents.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "Copy .env.example to .env and fill in credentials." >&2
  exit 1
fi
set -a
# shellcheck source=/dev/null
source .env
set +a

require_var() {
  if [ -z "${!1:-}" ]; then
    echo "Missing required env var: $1" >&2
    exit 1
  fi
}

require_var ES_URL
require_var ES_API_KEY
require_var KIBANA_BASE_URL
require_var KIBANA_API_KEY
require_var JINA_API_KEY

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
# shellcheck source=/dev/null
source .venv/bin/activate
pip -q install -r requirements.txt

echo "== Step 1: Crawl T-Mobile with Jina Reader =="
python ingest/crawl.py

echo "== Step 2: Chunk pages =="
python ingest/chunk.py

echo "== Step 3: Index to Elasticsearch (${TELCO_INDEX:-telco-tmobile-kb}) =="
python ingest/index.py

echo "== Step 4: Deploy Agent Builder tools and personas =="
python agents/deploy.py

echo ""
echo "Online bootstrap complete."
echo "Agent state: agents/state/agents.json"
echo ""
echo "Sample converse (replace AGENT_ID):"
echo "curl -sS -X POST \"\${KIBANA_BASE_URL}/api/agent_builder/converse\" \\"
echo "  -H \"Authorization: ApiKey \${KIBANA_API_KEY}\" -H \"kbn-xsrf: true\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"agent_id\":\"tmobile-customer-care\",\"input\":\"What unlimited plans does T-Mobile offer?\"}'"

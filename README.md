# Telco Persona Agent Demo Platform

Role-based telco assistants (T-Mobile, AT&T, Verizon scaffold) powered by **Elastic Agent Builder**, **Jina Reader** ingest, **Jina embeddings** in Elasticsearch, and a **Next.js/Vercel** chat UI—with an **offline RAG** demo path using exported index snapshots.

## Clone the repository

```bash
git clone git@github.com:poulsbopete/telco-agent.git
cd telco-agent
```

Or with HTTPS:

```bash
git clone https://github.com/poulsbopete/telco-agent.git
cd telco-agent
```

Then follow [Setup](#setup) below. Never commit `.env` or `web/.env.local`—they are gitignored and hold your Elastic, Kibana, and Jina credentials.

## Architecture

```
Online prep:  Jina Reader → chunk → ES (semantic_text + jina-embeddings-v3) → Agent Builder agents
Online demo:  Next.js UI → /api/converse → Kibana Agent Builder
Offline demo: exported snapshot → local Docker ES → Next.js /api/rag (+ optional Ollama)
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- Docker (offline demo)
- Elastic Cloud Serverless project with Agent Builder
- Jina API key (online crawl only)

## Setup

```bash
cp .env.example .env
# Fill in ES_URL, ES_API_KEY, KIBANA_BASE_URL, KIBANA_API_KEY, JINA_API_KEY

cp web/env.example web/.env.local
# Set DEMO_MODE=online and Kibana credentials for online demo
```

## Online demo (full stack)

Run the full bootstrap: crawl T-Mobile, index to Serverless, deploy agents.

```bash
./scripts/bootstrap-online.sh
```

Start the UI:

```bash
cd web
npm install
npm run dev
# http://localhost:3000/chat
```

Deploy to Vercel:

1. Import the `web/` directory as a project
2. Set `KIBANA_BASE_URL`, `KIBANA_API_KEY`, `DEMO_MODE=online`
3. Deploy

### Configure Jina LLM in Kibana

Agent Builder uses your project's default chat model. In Kibana → Agent Builder settings, select a Jina or Elastic-managed chat model if available. Vector search uses the `jina-embeddings-v3` inference endpoint created by `ingest/index.py` and `agents/deploy.py`.

## Offline demo (air-gapped)

1. **Online prep once** (export index):

```bash
./scripts/bootstrap-online.sh   # or index from existing data
./scripts/export-index.sh
```

2. **Offline run** (local ES + UI):

```bash
./scripts/run-offline-demo.sh
```

This starts Docker Elasticsearch, imports `data/snapshots/tmobile/telco-tmobile-kb.sample.json` (or full export if present), and runs Next.js with `DEMO_MODE=offline`.

Optional: set `OLLAMA_BASE_URL=http://localhost:11434` in `web/.env.local` for LLM-synthesized answers instead of retrieval-only snippets.

## Personas (T-Mobile v1)

| Role | Agent ID | Focus |
|------|----------|-------|
| NOC Engineer | `tmobile-noc-engineer` | Outages, 5G/core, coverage |
| Customer Care | `tmobile-customer-care` | Plans, devices, support |
| Billing Ops | `tmobile-billing-ops` | Charges, disputes |
| Retail Sales | `tmobile-retail-sales` | Promotions, upgrades |

Instructions live in [`agents/personas/`](agents/personas/). Deploy mapping in [`agents/config.yaml`](agents/config.yaml).

## Adding AT&T / Verizon

1. Copy `ingest/seeds/tmobile.yaml` → `att.yaml` / `verizon.yaml`
2. Add carrier block in `agents/config.yaml`
3. Create persona markdown files under `agents/personas/`
4. Enable carrier in `web/lib/personas.ts`
5. Run crawl → index → deploy for each carrier

## Project layout

```
ingest/          Jina Reader crawl, chunk, index
agents/          Persona instructions + Agent Builder deploy
scripts/         bootstrap, export, import, offline demo
web/             Next.js UI (Vercel-ready)
docker/          Local Elasticsearch for offline mode
data/snapshots/  Exported index (sample included for smoke tests)
```

## Verification checklist

- [ ] `jina-embeddings-v3` endpoint active: `GET $ES_URL/_inference/text_embedding/jina-embeddings-v3`
- [ ] Index populated: `GET $ES_URL/telco-tmobile-kb/_count`
- [ ] Agents deployed: `GET $KIBANA_BASE_URL/api/agent_builder/agents` (with API key)
- [ ] Online UI: persona switch sends different `agent_id`; streaming works
- [ ] Offline: `./scripts/run-offline-demo.sh` returns KB-grounded answers without Serverless
- [ ] Sample questions per persona cite T-Mobile KB content

## Sample converse (curl)

```bash
curl -sS -X POST "${KIBANA_BASE_URL}/api/agent_builder/converse" \
  -H "Authorization: ApiKey ${KIBANA_API_KEY}" \
  -H "kbn-xsrf: true" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"tmobile-customer-care","input":"What unlimited plans does T-Mobile offer?"}'
```

## References

- Agent Builder API patterns: [elastic-launch-demo/AGENTS.MD](../elastic-launch-demo/AGENTS.MD)
- Converse proxy UI: [o11y-security/web](../o11y-security/web)
- Jina embeddings + semantic_text: youversion Elasticsearch workshop

# Telco Persona Agent Demo Platform

Role-based telco assistants (T-Mobile, AT&T, Verizon scaffold) powered by **Elastic Agent Builder**, **Jina Reader** ingest, **Jina embeddings** in Elasticsearch, and a **Next.js/Vercel** chat UI—with an **offline RAG** demo path using exported index snapshots.

## Quick links

| Resource | Link |
|----------|------|
| **Live chat demo** | Deploy to [Vercel](https://vercel.com/new) → open **`/chat`** on your deployment |
| **Presentation slides** | [poulsbopete.github.io/telco-agent](https://poulsbopete.github.io/telco-agent/) |
| **GitHub repository** | [github.com/poulsbopete/telco-agent](https://github.com/poulsbopete/telco-agent) |

The [Vercel chat UI](#deploy-to-vercel) links back to the slides; the [slide deck](#presentation-slides-github-pages) links to the repo and live demo.

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

Then follow [Setup](#setup) below. Never commit `.env` or `.env.local`—they are gitignored and hold your Elastic, Kibana, and Jina credentials.

## Presentation slides (GitHub Pages)

Professional **reveal.js** slide deck — one slide at a time, arrow keys to advance, **O** for overview, **F** for fullscreen.

| | |
|---|---|
| **Live URL** | [**Open slides →**](https://poulsbopete.github.io/telco-agent/) |
| **Source files** | [`slides/`](slides/) (canonical) and [`docs/`](docs/) (synced copy) |
| **Live chat demo** | Vercel deployment → **`/chat`** (see [Deploy to Vercel](#deploy-to-vercel)) |

### Enable GitHub Pages (required — use GitHub Actions)

The README must **not** be your homepage. Jekyll was rendering it as a docs page instead of the slide deck.

1. Open [Settings → Pages](https://github.com/poulsbopete/telco-agent/settings/pages)
2. Under **Build and deployment → Source**, choose **GitHub Actions** (not “Deploy from a branch”)
3. Push to `main` — the workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) publishes the `slides/` folder
4. Wait ~1 minute, then hard-refresh: **https://poulsbopete.github.io/telco-agent/**

You should see a dark fullscreen title slide (“Telco Persona Agent Demo”), not this README text.

**If you still see the README:** Pages source is still set to branch `/ (root)` or Jekyll is active. Switch to **GitHub Actions** and hard-refresh (Cmd+Shift+R).

### Preview locally

```bash
cd slides && python3 -m http.server 8080
# Open http://localhost:8080 — use arrow keys to navigate
```

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

cp env.example .env.local
# Set DEMO_MODE=online and Kibana credentials for online demo
```

## Online demo (full stack)

Run the full bootstrap: crawl T-Mobile, index to Serverless, deploy agents.

```bash
./scripts/bootstrap-online.sh
```

Start the UI:

```bash
npm install
npm run dev
# http://localhost:3000/chat
```

Deploy to Vercel:

1. Import the repo at [vercel.com/new](https://vercel.com/new) (repo root — Next.js app lives at root)
2. Leave **Root Directory** empty (repo root)
3. Confirm framework is **Next.js**, not Python
4. Set env vars in the Vercel project (Production + Preview):
   - `KIBANA_BASE_URL` = `https://ai-assistants-ffcafb.kb.us-east-1.aws.elastic.cloud` (**`.kb.`**, not `.es.`)
   - `KIBANA_API_KEY` = your Kibana API key
   - `DEMO_MODE` = `online`
5. Redeploy after changing env vars (Deployments → … → Redeploy)
6. Open **`/api/kibana-health`** — should show `"ok": true` and `"urlKind": "kibana"`
7. Open **`/chat`** after deploy — header links to [presentation slides](https://poulsbopete.github.io/telco-agent/) and [GitHub](https://github.com/poulsbopete/telco-agent)

### Troubleshooting: `no handler found for uri [/api/agent_builder/converse]`

That JSON error comes from **Elasticsearch**, not Kibana. It means `KIBANA_BASE_URL` is set to your **`.es.`** endpoint instead of **`.kb.`**.

Fix in Vercel → Settings → Environment Variables, then redeploy. Verify at `/api/kibana-health`.

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

Optional: set `OLLAMA_BASE_URL=http://localhost:11434` in `.env.local` for LLM-synthesized answers instead of retrieval-only snippets.

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
4. Enable carrier in `lib/personas.ts`
5. Run crawl → index → deploy for each carrier

## Project layout

```
ingest/          Jina Reader crawl, chunk, index
agents/          Persona instructions + Agent Builder deploy
scripts/         bootstrap, export, import, offline demo
app/             Next.js routes (chat UI, API proxies)
components/      React UI components
lib/             Personas, converse client, offline RAG
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

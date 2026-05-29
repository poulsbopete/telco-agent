# Telco Agent Chat UI (Vercel)

Next.js app that lets users pick a **T-Mobile persona agent** and chat via **Elastic Agent Builder**.

| Role | Agent ID |
|------|----------|
| NOC Engineer | `tmobile-noc-engineer` |
| Customer Care | `tmobile-customer-care` |
| Billing Ops | `tmobile-billing-ops` |
| Retail Sales | `tmobile-retail-sales` |

## Local dev

```bash
cp env.example .env.local
# Set KIBANA_BASE_URL, KIBANA_API_KEY, DEMO_MODE=online

npm install
npm run dev
# http://localhost:3000/chat
```

## Deploy to Vercel

**Important:** Deploy from the **repository root** (not only `web/`). Root `vercel.json` builds the Next.js app in `web/` and avoids Python ingest being detected.

1. Import this repo in [Vercel](https://vercel.com/new)
2. Leave **Root Directory** empty (repo root) — or set it to **`web`** if you prefer; then delete root `vercel.json` and use `web/vercel.json` only
3. Framework should auto-detect **Next.js** (not Python)
4. Add environment variables:

| Variable | Value |
|----------|--------|
| `KIBANA_BASE_URL` | `https://ai-assistants-ffcafb.kb.us-east-1.aws.elastic.cloud` |
| `KIBANA_API_KEY` | Your Kibana API key with Agent Builder access |
| `DEMO_MODE` | `online` |

4. Deploy — the `/chat` route is the main UI (root redirects there)

## How it works

```
Browser → /api/converse/stream → Kibana Agent Builder
                agent_id: tmobile-noc-engineer | tmobile-customer-care | …
```

Each persona sends a different `agent_id` to Agent Builder. Agents use the shared `telco-tmobile-kb-search` tool against index `telco-tmobile-kb`.

## Offline mode

Set `DEMO_MODE=offline` and `LOCAL_ES_URL` for air-gapped RAG demo (no Agent Builder).

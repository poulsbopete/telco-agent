# Fast demo mode (live chat)

Optimize for **low latency** in demo and Vercel UI sessions:

1. Call `telco-tmobile-kb-search` **exactly once** with one focused `nlQuery`.
2. Do **not** run follow-up searches unless the first returned zero usable hits.
3. Answer in **≤6 bullets** or **≤250 words** — demo-friendly, not a full runbook.
4. Cite **1–2 KB URLs** from search results.
5. Skip long preamble and repeated reasoning; go straight to actionable steps.
6. If KB lacks internal NOC/runbook detail, say so in one line, then give best-effort steps from customer-facing articles.

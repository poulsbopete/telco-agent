import fs from "fs";
import path from "path";

const PERSONA_FILES: Record<string, string> = {
  "tmobile-noc-engineer": "tmobile-noc-engineer.md",
  "tmobile-customer-care": "tmobile-customer-care.md",
  "tmobile-billing-ops": "tmobile-billing-ops.md",
  "tmobile-retail-sales": "tmobile-retail-sales.md",
};

export function loadPersonaInstructions(agentId: string): string {
  const file = PERSONA_FILES[agentId];
  if (!file) {
    return "You are a helpful telco assistant. Answer only from provided context.";
  }
  const personaPath = path.join(process.cwd(), "agents", "personas", file);
  try {
    return fs.readFileSync(personaPath, "utf-8");
  } catch {
    return "You are a helpful telco assistant. Answer only from provided context.";
  }
}

export type RagHit = {
  title?: string;
  url?: string;
  content?: string;
  body_semantic?: string | { inference?: string };
};

export function hitText(hit: RagHit): string {
  const semantic = hit.body_semantic;
  const semanticText =
    typeof semantic === "string"
      ? semantic
      : semantic && typeof semantic.inference === "string"
        ? semantic.inference
        : "";
  const parts = [hit.title, hit.content, semanticText].filter(Boolean);
  return parts.join("\n\n").slice(0, 2500);
}

export async function searchLocalKb(
  query: string,
  index: string,
  esUrl: string,
  personaTag?: string
): Promise<RagHit[]> {
  const filter =
    personaTag && personaTag !== "all"
      ? [{ term: { persona_tags: personaTag } }]
      : [];

  const body = {
    size: 5,
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query,
              fields: ["title^3", "content", "body_semantic", "heading"],
              type: "best_fields",
            },
          },
        ],
        filter,
      },
    },
  };

  const resp = await fetch(`${esUrl.replace(/\/$/, "")}/${index}/_search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ES search failed (${resp.status}): ${text.slice(0, 400)}`);
  }

  const data = (await resp.json()) as {
    hits?: { hits?: Array<{ _source?: RagHit }> };
  };
  return (data.hits?.hits ?? []).map((h) => h._source ?? {});
}

export async function synthesizeWithOllama(
  systemPrompt: string,
  question: string,
  context: string
): Promise<string> {
  const base = process.env.OLLAMA_BASE_URL?.replace(/\/$/, "") || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.2";
  const prompt = `${systemPrompt}\n\n## Retrieved knowledge\n${context}\n\n## User question\n${question}\n\nAnswer using only the retrieved knowledge. Cite source URLs when available.`;

  const resp = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false }),
  });

  if (!resp.ok) {
    throw new Error(`Ollama error (${resp.status})`);
  }

  const data = (await resp.json()) as { response?: string };
  return data.response?.trim() || "No response from local LLM.";
}

export function fallbackAnswer(hits: RagHit[], question: string): string {
  if (hits.length === 0) {
    return `I could not find relevant T-Mobile knowledge for: "${question}". Try rephrasing or run the online crawl to refresh the index.`;
  }
  const lines = hits.map((h, i) => {
    const url = h.url ? `\nSource: ${h.url}` : "";
    return `**${i + 1}. ${h.title || "Result"}**\n${hitText(h)}${url}`;
  });
  return `Here is what I found in the offline knowledge base:\n\n${lines.join("\n\n")}`;
}

import { NextRequest, NextResponse } from "next/server";
import {
  fallbackAnswer,
  hitText,
  loadPersonaInstructions,
  searchLocalKb,
  synthesizeWithOllama,
} from "@/lib/rag";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const input = typeof body.input === "string" ? body.input.trim() : "";
  const agentId = typeof body.agent_id === "string" ? body.agent_id : "tmobile-customer-care";
  const roleKey = typeof body.role_key === "string" ? body.role_key : undefined;

  if (!input) {
    return NextResponse.json({ message: "input is required" }, { status: 400 });
  }

  const esUrl = process.env.LOCAL_ES_URL?.replace(/\/$/, "") || "http://localhost:9200";
  const index = process.env.TELCO_INDEX || "telco-tmobile-kb";

  try {
    const hits = await searchLocalKb(input, index, esUrl, roleKey);
    const context = hits.map((h, i) => `[${i + 1}] ${hitText(h)}${h.url ? `\nURL: ${h.url}` : ""}`).join("\n\n");

    let message: string;
    if (process.env.OLLAMA_BASE_URL) {
      const system = loadPersonaInstructions(agentId);
      message = await synthesizeWithOllama(system, input, context);
    } else {
      message = fallbackAnswer(hits, input);
    }

    return NextResponse.json({
      message,
      hits: hits.map((h) => ({ title: h.title, url: h.url })),
      mode: "offline-rag",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "RAG search failed";
    return NextResponse.json({ message: msg }, { status: 502 });
  }
}

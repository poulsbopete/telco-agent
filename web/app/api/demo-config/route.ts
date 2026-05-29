import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const mode = process.env.DEMO_MODE === "offline" ? "offline" : "online";
  return NextResponse.json({
    mode,
    defaultAgentConfigured: Boolean(process.env.KIBANA_AGENT_ID?.trim()),
    ollamaConfigured: Boolean(process.env.OLLAMA_BASE_URL?.trim()),
  });
}

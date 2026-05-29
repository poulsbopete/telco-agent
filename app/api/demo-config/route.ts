import { NextResponse } from "next/server";

export const runtime = "nodejs";

function kibanaUrlKind(base?: string): "kibana" | "elasticsearch" | "missing" | "unknown" {
  if (!base) return "missing";
  if (/\.kb\./.test(base)) return "kibana";
  if (/\.es\./.test(base)) return "elasticsearch";
  return "unknown";
}

export async function GET() {
  const mode = process.env.DEMO_MODE === "offline" ? "offline" : "online";
  const kibanaBase = process.env.KIBANA_BASE_URL?.replace(/\/$/, "");
  let kibanaHostname: string | undefined;
  if (kibanaBase) {
    try {
      kibanaHostname = new URL(kibanaBase).hostname;
    } catch {
      kibanaHostname = undefined;
    }
  }

  return NextResponse.json({
    mode,
    defaultAgentConfigured: Boolean(process.env.KIBANA_AGENT_ID?.trim()),
    ollamaConfigured: Boolean(process.env.OLLAMA_BASE_URL?.trim()),
    kibanaConfigured: Boolean(kibanaBase && process.env.KIBANA_API_KEY?.trim()),
    kibanaUrlKind: kibanaUrlKind(kibanaBase),
    kibanaHostname,
    healthCheckPath: "/api/kibana-health",
  });
}

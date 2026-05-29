import { NextResponse } from "next/server";
import { requireKibanaConverseEnv } from "@/lib/kibana-converse-request";

export const runtime = "nodejs";

function urlKind(base: string): "kibana" | "elasticsearch" | "unknown" {
  if (/\.kb\./.test(base)) return "kibana";
  if (/\.es\./.test(base)) return "elasticsearch";
  return "unknown";
}

export async function GET() {
  const env = requireKibanaConverseEnv();
  if (!env.ok) {
    const body = await env.response.json();
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        ...body,
      },
      { status: env.response.status }
    );
  }

  let hostname = "unknown";
  try {
    hostname = new URL(env.base).hostname;
  } catch {
    /* ignore */
  }

  const kind = urlKind(env.base);
  if (kind === "elasticsearch") {
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        urlKind: kind,
        hostname,
        message:
          "KIBANA_BASE_URL points at Elasticsearch (*.es.*). Set it to your Kibana URL (*.kb.*.elastic.cloud) in Vercel → Settings → Environment Variables, then redeploy.",
      },
      { status: 503 }
    );
  }

  let agentsStatus = 0;
  let agentsError = "";
  try {
    const r = await fetch(`${env.base}/api/agent_builder/agents`, {
      headers: {
        Authorization: `ApiKey ${env.key}`,
        "kbn-xsrf": "true",
      },
      cache: "no-store",
    });
    agentsStatus = r.status;
    if (!r.ok) {
      agentsError = (await r.text()).slice(0, 300);
    }
  } catch (err) {
    agentsError = err instanceof Error ? err.message : "fetch failed";
  }

  return NextResponse.json({
    ok: agentsStatus === 200,
    configured: true,
    urlKind: kind,
    hostname,
    agentsStatus,
    agentsError: agentsError || undefined,
    hint:
      agentsStatus === 200
        ? "Kibana Agent Builder is reachable from this deployment."
        : "Kibana URL looks correct but Agent Builder did not respond with HTTP 200. Check KIBANA_API_KEY privileges.",
  });
}

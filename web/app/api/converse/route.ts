import { NextRequest, NextResponse } from "next/server";
import {
  parseConverseJsonBody,
  requireKibanaConverseEnv,
} from "@/lib/kibana-converse-request";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const env = requireKibanaConverseEnv();
  if (!env.ok) return env.response;

  const parsed = await parseConverseJsonBody(req);
  if (!parsed.ok) return parsed.response;

  const url = `${env.base}/api/agent_builder/converse`;

  let r: Response;
  try {
    r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${env.key}`,
        "kbn-xsrf": "true",
      },
      body: JSON.stringify(parsed.payload),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch failed";
    return NextResponse.json({ message: `Upstream fetch failed: ${msg}` }, { status: 502 });
  }

  const text = await r.text();
  const ct = r.headers.get("content-type") || "application/json; charset=utf-8";
  return new NextResponse(text, { status: r.status, headers: { "Content-Type": ct } });
}

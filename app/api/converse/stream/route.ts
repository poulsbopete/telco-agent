import { NextRequest, NextResponse } from "next/server";
import {
  interpretKibanaUpstreamError,
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

  const url = `${env.base}/api/agent_builder/converse/async`;

  let r: Response;
  try {
    r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${env.key}`,
        "kbn-xsrf": "true",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(parsed.payload),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch failed";
    return NextResponse.json({ message: `Upstream fetch failed: ${msg}` }, { status: 502 });
  }

  if (!r.ok) {
    const text = await r.text();
    const hint = interpretKibanaUpstreamError(text);
    const body = hint ? JSON.stringify({ message: hint, error: text }) : text;
    const ct = r.headers.get("content-type") || "application/json; charset=utf-8";
    return new NextResponse(body, { status: r.status, headers: { "Content-Type": ct } });
  }

  return new NextResponse(r.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";

export type KibanaConverseEnv =
  | { ok: true; base: string; key: string }
  | { ok: false; response: NextResponse };

export function requireKibanaConverseEnv(): KibanaConverseEnv {
  const base = process.env.KIBANA_BASE_URL?.replace(/\/$/, "");
  const key = process.env.KIBANA_API_KEY;
  if (!base || !key) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          message:
            "Server is missing KIBANA_BASE_URL or KIBANA_API_KEY. Set them for online mode.",
        },
        { status: 503 }
      ),
    };
  }
  return { ok: true, base, key };
}

export async function parseConverseJsonBody(
  req: NextRequest
): Promise<
  | { ok: false; response: NextResponse }
  | { ok: true; payload: Record<string, unknown> }
> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ message: "Invalid JSON body" }, { status: 400 }),
    };
  }
  const payload: Record<string, unknown> =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? { ...(body as Record<string, unknown>) }
      : {};

  const fromClient = payload.agent_id;
  const clientEmpty =
    fromClient === undefined ||
    fromClient === null ||
    (typeof fromClient === "string" && fromClient.trim() === "");
  const defaultAgent = process.env.KIBANA_AGENT_ID?.trim();
  if (clientEmpty && defaultAgent) {
    payload.agent_id = defaultAgent;
  }

  return { ok: true, payload };
}

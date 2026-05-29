export function converseStreamUrl(converseUrl: string): string {
  const base = converseUrl.replace(/\/$/, "");
  return `${base}/stream`;
}

function parseSseFrame(raw: string): { event: string; data: string } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).replace(/^\s/, "");
    if (key === "event") event = value;
    else if (key === "data") dataLines.push(value);
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

export type StreamCallbacks = {
  onConversationId?: (id: string) => void;
  onTextChunk?: (chunk: string) => void;
  onCompleteMessage?: (full: string) => void;
};

export async function consumeAgentBuilderSse(
  body: ReadableStream<Uint8Array> | null,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  if (!body) throw new Error("No response body");

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let carry = "";

  const onAbort = () => {
    void reader.cancel("aborted");
  };
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }

  const dispatchFrame = (frame: string) => {
    const parsed = parseSseFrame(frame);
    if (!parsed) return;
    const { event, data } = parsed;
    let json: unknown;
    try {
      json = data ? JSON.parse(data) : null;
    } catch {
      return;
    }
    if (!json || typeof json !== "object") return;
    const o = json as Record<string, unknown>;

    if (
      (event === "conversation_id_set" || event === "conversation_created") &&
      typeof o.conversation_id === "string"
    ) {
      callbacks.onConversationId?.(o.conversation_id);
    }

    if (event === "message_chunk" && typeof o.text_chunk === "string") {
      callbacks.onTextChunk?.(o.text_chunk);
    }

    if (event === "message_complete" && typeof o.message_content === "string") {
      callbacks.onCompleteMessage?.(o.message_content);
    }

    if (event === "round_complete" && o.round && typeof o.round === "object") {
      const r = o.round as Record<string, unknown>;
      if (typeof r.conversation_id === "string") {
        callbacks.onConversationId?.(r.conversation_id);
      }
    }
  };

  try {
    while (true) {
      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await reader.read();
      } catch {
        break;
      }
      const { done, value } = readResult;
      if (done) break;
      carry += decoder.decode(value, { stream: true });
      const parts = carry.split(/\r\n\r\n|\n\n/);
      carry = parts.pop() ?? "";
      for (const rawFrame of parts) {
        if (rawFrame.trim()) dispatchFrame(rawFrame);
      }
    }
    if (carry.trim()) dispatchFrame(carry);
  } finally {
    if (signal) signal.removeEventListener("abort", onAbort);
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }
}

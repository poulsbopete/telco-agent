/** Parse Agent Builder converse JSON into displayable assistant text. */
export function extractAssistantMessage(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const o = data as Record<string, unknown>;

  if (o.response && typeof o.response === "object") {
    const r = o.response as Record<string, unknown>;
    if (typeof r.message === "string") return r.message;
    if (typeof r.output === "string") return r.output;
  }

  if (typeof o.message === "string") return o.message;
  if (typeof o.output === "string") return o.output;

  if (Array.isArray(o.messages)) {
    for (let i = o.messages.length - 1; i >= 0; i--) {
      const m = o.messages[i];
      if (m && typeof m === "object") {
        const msg = m as Record<string, unknown>;
        if (msg.role === "assistant" && typeof msg.content === "string") {
          return msg.content;
        }
      }
    }
  }

  if (Array.isArray(o.steps)) {
    for (let i = o.steps.length - 1; i >= 0; i--) {
      const step = o.steps[i];
      if (step && typeof step === "object") {
        const s = step as Record<string, unknown>;
        if (typeof s.message === "string") return s.message;
      }
    }
  }

  return "";
}

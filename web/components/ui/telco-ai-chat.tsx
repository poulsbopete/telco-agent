"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  Headphones,
  LoaderIcon,
  Network,
  Receipt,
  RotateCcw,
  SendIcon,
  Sparkles,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { extractAssistantMessage } from "@/lib/extract-assistant-message";
import {
  CARRIERS,
  getCarrier,
  getRole,
  type TelcoCarrier,
  type TelcoRole,
} from "@/lib/personas";
import { consumeAgentBuilderSse, converseStreamUrl } from "@/lib/converse-stream-client";

type ChatMsg = {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
};

type DemoConfig = {
  mode: "online" | "offline";
  defaultAgentConfigured: boolean;
  ollamaConfigured: boolean;
};

const ROLE_ICONS = {
  network: Network,
  headset: Headphones,
  receipt: Receipt,
  store: Store,
} as const;

function newMsgId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function TelcoAIChat() {
  const [carrierKey, setCarrierKey] = useState("tmobile");
  const [roleKey, setRoleKey] = useState("noc");
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [demoConfig, setDemoConfig] = useState<DemoConfig>({
    mode: "online",
    defaultAgentConfigured: false,
    ollamaConfigured: false,
  });
  const conversationIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const carrier = useMemo(() => getCarrier(carrierKey) ?? CARRIERS[0], [carrierKey]);
  const role = useMemo(
    () => getRole(carrierKey, roleKey) ?? carrier.roles[0],
    [carrierKey, roleKey, carrier]
  );

  const chatEndpoint = demoConfig.mode === "offline" ? "/api/rag" : "/api/converse";
  const streamEndpoint = converseStreamUrl("/api/converse");

  useEffect(() => {
    fetch("/api/demo-config")
      .then((r) => r.json())
      .then((d) => setDemoConfig(d as DemoConfig))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const resetConversation = useCallback(() => {
    conversationIdRef.current = null;
    setMessages([]);
  }, []);

  useEffect(() => {
    resetConversation();
  }, [roleKey, demoConfig.mode, resetConversation]);

  const submitMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending || !role) return;

      setMessages((m) => [...m, { id: newMsgId(), role: "user", text: trimmed }]);
      setValue("");
      setIsSending(true);

      const body: Record<string, unknown> = {
        input: trimmed,
        agent_id: role.agentId,
        role_key: role.key,
      };
      if (conversationIdRef.current && demoConfig.mode === "online") {
        body.conversation_id = conversationIdRef.current;
      }

      const appendError = (errText: string) => {
        setMessages((m) => [...m, { id: newMsgId(), role: "error", text: errText }]);
      };

      try {
        if (demoConfig.mode === "offline") {
          const r = await fetch(chatEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", "kbn-xsrf": "true" },
            body: JSON.stringify(body),
          });
          const data = await r.json();
          if (!r.ok) {
            appendError(typeof data.message === "string" ? data.message : `HTTP ${r.status}`);
            return;
          }
          const reply =
            extractAssistantMessage(data) ||
            (typeof data.message === "string" ? data.message : "(Empty reply)");
          setMessages((m) => [...m, { id: newMsgId(), role: "assistant", text: reply }]);
          return;
        }

        const streamId = newMsgId();
        let streamed = false;

        try {
          const streamResp = await fetch(streamEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "kbn-xsrf": "true",
              Accept: "text/event-stream",
            },
            body: JSON.stringify(body),
          });

          const ct = streamResp.headers.get("content-type") ?? "";
          const useStream =
            streamResp.ok &&
            streamResp.body &&
            (/\btext\/event-stream\b/i.test(ct) ||
              /\bapplication\/octet-stream\b/i.test(ct));

          if (useStream) {
            streamed = true;
            setMessages((m) => [...m, { id: streamId, role: "assistant", text: "" }]);
            let buffer = "";
            await consumeAgentBuilderSse(streamResp.body, {
              onConversationId: (id) => {
                conversationIdRef.current = id;
              },
              onTextChunk: (chunk) => {
                buffer += chunk;
                setMessages((m) =>
                  m.map((msg) => (msg.id === streamId ? { ...msg, text: buffer } : msg))
                );
              },
              onCompleteMessage: (full) => {
                buffer = full;
                setMessages((m) =>
                  m.map((msg) => (msg.id === streamId ? { ...msg, text: full } : msg))
                );
              },
            });
            if (!buffer.trim()) {
              setMessages((m) =>
                m.map((msg) =>
                  msg.id === streamId ? { ...msg, text: "(Empty reply from agent)" } : msg
                )
              );
            }
          }
        } catch {
          streamed = false;
        }

        if (!streamed) {
          const r = await fetch(chatEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", "kbn-xsrf": "true" },
            body: JSON.stringify(body),
          });
          const raw = await r.text();
          let data: unknown = null;
          try {
            data = raw ? JSON.parse(raw) : null;
          } catch {
            data = null;
          }
          if (!r.ok) {
            const errObj = data as Record<string, unknown> | null;
            appendError(
              (errObj && typeof errObj.message === "string" && errObj.message) ||
                raw ||
                `HTTP ${r.status}`
            );
            return;
          }
          const obj = data as Record<string, unknown> | null;
          if (obj && typeof obj.conversation_id === "string") {
            conversationIdRef.current = obj.conversation_id;
          }
          const reply = extractAssistantMessage(data) || "(Empty reply from agent)";
          setMessages((m) => [...m, { id: newMsgId(), role: "assistant", text: reply }]);
        }
      } catch (err) {
        appendError(err instanceof Error ? err.message : "Network error");
      } finally {
        setIsSending(false);
      }
    },
    [chatEndpoint, demoConfig.mode, isSending, role, streamEndpoint]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) void submitMessage(value);
    }
  };

  return (
    <div className="relative min-h-screen w-full px-4 py-8 text-white sm:px-6">
      <div className="relative mx-auto w-full max-w-6xl space-y-6">
        <header className="space-y-3 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
            <Sparkles className="h-3.5 w-3.5" style={{ color: carrier.accent }} />
            {demoConfig.mode === "offline" ? "Offline RAG" : "Elastic Agent Builder"}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            T-Mobile Persona Agents
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-white/50">
            Select a role below. Each agent connects to a dedicated Elastic Agent Builder
            assistant with T-Mobile knowledge base search.
          </p>
        </header>

        <AgentSelector
          carrier={carrier}
          carrierKey={carrierKey}
          roleKey={roleKey}
          onCarrierChange={setCarrierKey}
          onRoleChange={setRoleKey}
        />

        {role && (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
            style={{ borderColor: `${carrier.accent}44`, backgroundColor: `${carrier.accent}11` }}
          >
            <div>
              <p className="text-sm font-semibold text-white">{role.label}</p>
              <p className="font-mono text-xs text-white/50">agent_id: {role.agentId}</p>
            </div>
            <button
              type="button"
              onClick={resetConversation}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              New conversation
            </button>
          </div>
        )}

        <motion.div
          className="overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-2xl backdrop-blur-xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
              Starter prompts · {role?.label}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {role?.starters.map((s) => (
                <button
                  key={s.title}
                  type="button"
                  disabled={isSending}
                  onClick={() => void submitMessage(s.question)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-left text-xs text-white/80 transition hover:border-white/20 hover:bg-white/10 disabled:opacity-40"
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[min(52vh,32rem)] space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-sm text-white/35">
                Chat with the <strong className="text-white/60">{role?.label}</strong> agent.
                Answers are grounded in the T-Mobile knowledge index via Agent Builder.
              </p>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "rounded-xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user" && "border border-tmo/30 bg-tmo/10",
                  msg.role === "assistant" && "border border-emerald-500/25 bg-emerald-950/30",
                  msg.role === "error" && "border border-red-400/30 bg-red-500/10 text-red-100"
                )}
              >
                <span className="mb-1 block text-[0.65rem] font-bold uppercase tracking-wider text-white/45">
                  {msg.role === "user" ? "You" : msg.role === "assistant" ? role?.label : "Error"}
                </span>
                {msg.role === "assistant" ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-white/10 p-4">
            <div className="flex gap-2">
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${role?.label ?? "agent"}…`}
                rows={2}
                disabled={isSending}
                className="min-h-[3.5rem] flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-tmo/50 focus:outline-none"
              />
              <button
                type="button"
                disabled={isSending || !value.trim()}
                onClick={() => void submitMessage(value)}
                className="flex h-[3.5rem] w-[3.5rem] items-center justify-center rounded-xl text-white transition disabled:opacity-40"
                style={{ backgroundColor: carrier.accent }}
                aria-label="Send"
              >
                {isSending ? (
                  <LoaderIcon className="h-5 w-5 animate-spin" />
                ) : (
                  <SendIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function AgentSelector({
  carrier,
  carrierKey,
  roleKey,
  onCarrierChange,
  onRoleChange,
}: {
  carrier: TelcoCarrier;
  carrierKey: string;
  roleKey: string;
  onCarrierChange: (key: string) => void;
  onRoleChange: (key: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/40">Carrier</span>
        <select
          value={carrierKey}
          onChange={(e) => {
            const next = getCarrier(e.target.value);
            onCarrierChange(e.target.value);
            if (next?.roles[0]) onRoleChange(next.roles[0].key);
          }}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white"
        >
          {CARRIERS.map((c) => (
            <option key={c.key} value={c.key} disabled={!c.enabled}>
              {c.displayName}
              {!c.enabled ? " (coming soon)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {carrier.roles.map((r: TelcoRole) => {
          const Icon = ROLE_ICONS[r.icon];
          const active = roleKey === r.key;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => onRoleChange(r.key)}
              className={cn(
                "rounded-xl border p-4 text-left transition",
                active
                  ? "border-tmo bg-tmo/15 ring-1 ring-tmo/40"
                  : "border-white/10 bg-black/40 hover:border-white/20 hover:bg-white/5"
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    active ? "bg-tmo/30 text-white" : "bg-white/10 text-white/70"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-semibold text-sm text-white">{r.label}</span>
              </div>
              <p className="text-xs text-white/50">{r.description}</p>
              <p className="mt-2 font-mono text-[0.65rem] text-white/35">{r.agentId}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUp, MessageCircle, Sparkles, X } from "lucide-react";
import { ASSISTANT_GREETING, ASSISTANT_SUGGESTIONS } from "@/lib/assistant/prompt";
import { cn } from "@/lib/cn";
import { track } from "@/components/analytics";

type Msg = { role: "user" | "assistant"; content: string };

/** Homepage greeter: floating chat bubble backed by /api/assistant (streams plain text). */
export function AssistantWidget() {
  const [open, setOpen] = React.useState(false);
  const [teaser, setTeaser] = React.useState(false);
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Greet once per visit, a few seconds after landing.
  React.useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem("undriq-greeted") === "1"; } catch { /* private mode */ }
    if (seen) return;
    const t = setTimeout(() => setTeaser(true), 4000);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const openChat = () => {
    setOpen(true);
    setTeaser(false);
    try { sessionStorage.setItem("undriq-greeted", "1"); } catch { /* ignore */ }
    track("assistant_opened");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  async function send(text: string) {
    const q = text.trim().slice(0, 1200);
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    track("assistant_message");
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next }) });
      if (!res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMsgs([...next, { role: "assistant", content: acc }]);
      }
      if (!acc.trim()) setMsgs([...next, { role: "assistant", content: "Sorry, I couldn't answer just now. Please try again." }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "I couldn't connect. Check your connection and try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open ? (
        <section aria-label="UndrIq assistant" className="flex h-[min(560px,calc(100dvh-6rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-panel animate-in">
          <header className="flex items-center gap-3 border-b border-line-soft px-4 py-3">
            <span className="grid size-8 place-items-center rounded-full bg-text text-ink"><Sparkles className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">UndrIq assistant</div>
              <div className="text-xs text-muted">Automated · usually answers in seconds</div>
            </div>
            <button type="button" aria-label="Close chat" onClick={() => setOpen(false)} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-text"><X className="size-4" /></button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            <Bubble role="assistant" text={ASSISTANT_GREETING} />
            {msgs.length === 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {ASSISTANT_SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:border-muted hover:text-text">{s}</button>
                ))}
              </div>
            ) : null}
            {msgs.map((m, i) => <Bubble key={i} role={m.role} text={m.content} typing={busy && i === msgs.length - 1 && !m.content} />)}
          </div>

          <div className="border-t border-line-soft p-3">
            <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex items-center gap-2">
              <input
                ref={inputRef}
                aria-label="Message"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={1200}
                placeholder="Ask about UndrIq…"
                className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-raised px-3 text-sm placeholder:text-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-door/30"
              />
              <button type="submit" aria-label="Send" disabled={busy || !input.trim()} className="grid size-10 place-items-center rounded-lg bg-text text-ink disabled:opacity-40"><ArrowUp className="size-4" /></button>
            </form>
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted">
              <span>Automated assistant. Not investment advice.</span>
              <Link href="/login?mode=signup" className="font-medium text-text hover:underline">Try a deal free →</Link>
            </div>
          </div>
        </section>
      ) : teaser ? (
        <div className="max-w-[280px] rounded-2xl border border-line bg-surface p-3 text-sm shadow-panel animate-in">
          <div className="flex items-start gap-2">
            <p className="flex-1">{ASSISTANT_GREETING}</p>
            <button type="button" aria-label="Dismiss" onClick={() => { setTeaser(false); try { sessionStorage.setItem("undriq-greeted", "1"); } catch { /* ignore */ } }} className="text-muted hover:text-text"><X className="size-3.5" /></button>
          </div>
          <button type="button" onClick={openChat} className="mt-2 text-xs font-semibold hover:underline">Chat with me →</button>
        </div>
      ) : null}

      {!open ? (
        <button type="button" onClick={openChat} aria-label="Chat with UndrIq assistant" className="flex items-center gap-2 rounded-full bg-text px-4 py-3 text-sm font-medium text-ink shadow-panel transition hover:scale-[1.03]">
          <MessageCircle className="size-4" /> Ask UndrIq
        </button>
      ) : null}
    </div>
  );
}

function Bubble({ role, text, typing }: { role: "user" | "assistant"; text: string; typing?: boolean }) {
  return (
    <div className={cn("flex", role === "user" ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", role === "user" ? "bg-text text-ink" : "bg-raised")}>
        {typing ? <span className="inline-flex gap-1" aria-label="Typing"><Dot /><Dot d="150ms" /><Dot d="300ms" /></span> : text}
      </div>
    </div>
  );
}
const Dot = ({ d = "0ms" }: { d?: string }) => <span className="size-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: d }} />;

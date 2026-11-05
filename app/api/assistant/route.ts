import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ASSISTANT_SYSTEM } from "@/lib/assistant/prompt";
import { isAnthropicConfigured } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Model for the public greeter. Override with ANTHROPIC_CHAT_MODEL (e.g. claude-haiku-5-5 for lower cost). */
const MODEL = process.env.ANTHROPIC_CHAT_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ timeout: 45_000, maxRetries: 1 }));

const body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(1200) }))
    .min(1)
    .max(20),
});

// Best-effort abuse guard for a public endpoint: per-IP message budget per server instance.
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 20;
const g = globalThis as unknown as { __assistantHits?: Map<string, number[]> };
function allow(ip: string): boolean {
  const hits = (g.__assistantHits ??= new Map<string, number[]>());
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return false;
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}

const text = (msg: string, status = 200) => new Response(msg, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

/**
 * POST /api/assistant  { messages: [{role, content}...] }  → streams plain text.
 * Public (no sign-in) homepage greeter. Keeps only the last 12 turns, caps length, rate-limits by IP.
 */
export async function POST(req: Request) {
  if (!isAnthropicConfigured()) return text("The assistant isn't available right now. You can still analyze your first deal free from the homepage.", 503);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
  if (!allow(ip)) return text("You've sent a lot of messages. Take a break and try again in a few minutes, or sign up to try the analyzer.", 429);

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return text("Please send a shorter message.", 400);
  // Conversation must start with the visitor; the greeting shown in the widget isn't sent.
  let history = parsed.data.messages.slice(-12);
  while (history.length && history[0]!.role !== "user") history = history.slice(1);
  if (!history.length) return text("Please type a question.", 400);
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  const stream = anthropic().beta.messages.stream({
    model: MODEL,
    max_tokens: 4000,
    // Low effort keeps replies quick for a chat greeter; thinking text is omitted by default.
    output_config: { effort: "low" },
    // Re-run on a fallback model if a request is declined, instead of returning nothing.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // Stable system prompt, cached across visitors.
    system: [{ type: "text", text: ASSISTANT_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sent = false;
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            sent = true;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (!sent || final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode(sent ? "" : "I can help with questions about UndrIq: how it works, plans, and getting started. What would you like to know?"));
        }
      } catch (e) {
        console.error("assistant stream failed", e);
        controller.enqueue(encoder.encode(sent ? "\n\n(Connection dropped. Please ask again.)" : "Sorry, I couldn't answer just now. Please try again in a moment."));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });
  return new Response(readable, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}

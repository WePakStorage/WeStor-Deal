import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { env } from "../env";

let client: Anthropic | null = null;
// Large OMs can take SI a minute or more to read; one retry on transient errors.
const anthropic = () => (client ??= new Anthropic({ timeout: 110_000, maxRetries: 1 }));

/** A plain-language reason the SI (Claude) step failed, safe to show to the account owner. */
export function explainAiError(e: unknown): string {
  const err = e as { status?: number; message?: string; error?: { error?: { message?: string } }; name?: string };
  const msg = `${err?.error?.error?.message ?? ""} ${err?.message ?? ""}`.toLowerCase();
  if (err?.status === 401 || msg.includes("api key") || msg.includes("authentication")) return "The Claude API key was rejected. Check ANTHROPIC_API_KEY in Vercel and redeploy.";
  if (msg.includes("credit balance")) return "The Anthropic account is out of credits. Add credits at console.anthropic.com → Plans & Billing.";
  if (err?.status === 404 || msg.includes("model")) return "The SI model name wasn't found. Check ANTHROPIC_MODEL in Vercel (use claude-sonnet-5-5).";
  if (err?.status === 429) return "The Anthropic rate limit was hit. Try again in a minute.";
  if (err?.status === 529 || msg.includes("overloaded")) return "The SI service is busy right now. Try again in a minute.";
  if (err?.name?.includes("Timeout") || msg.includes("timed out") || msg.includes("timeout")) return "The SI step took too long. Try again, or paste less text.";
  if (msg.includes("declined")) return "SI declined to read this document.";
  if (msg.includes("page") && (msg.includes("exceed") || msg.includes("limit") || msg.includes("maximum"))) return "This PDF has too many pages for SI to read in one go. Upload the summary pages (financials, rent roll, property details) or paste the listing text.";
  if (err?.status === 413 || msg.includes("too large") || msg.includes("request size")) return "This PDF is too large for SI. Compress it (most PDF tools can) or upload just the key pages.";
  return "The SI step failed unexpectedly. Try again; if it keeps happening, check Vercel → Logs.";
}

/** Tiny live call used by /status to prove the key, credits and model all work. */
export async function pingClaude(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await anthropic().messages.create({ model: env.anthropicModel, max_tokens: 5, messages: [{ role: "user", content: "Reply with: ok" }] });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: explainAiError(e) };
  }
}

export interface ClaudeUsage {
  input: number;
  output: number;
}

type Content = Anthropic.Beta.BetaContentBlockParam[];

/**
 * One streamed request with server-side refusal fallbacks enabled.
 * Model comes from ANTHROPIC_MODEL (default claude-sonnet-5-5).
 */
async function call(system: string, content: Content, maxTokens: number): Promise<{ text: string; usage: ClaudeUsage }> {
  const stream = anthropic().beta.messages.stream({
    model: env.anthropicModel,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system,
    messages: [{ role: "user", content }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("The AI declined to read this document.");
  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return { text, usage: { input: msg.usage.input_tokens, output: msg.usage.output_tokens } };
}

/** Pull the JSON object out of a response: strip code fences and any prose around it. */
export function extractJson(text: string): unknown {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

export type JsonResult<T> =
  | { ok: true; data: T; usage: ClaudeUsage; attempts: number }
  | { ok: false; error: string; raw: unknown; usage: ClaudeUsage; attempts: number };

/**
 * Ask for JSON only and validate with Zod. On failure, retry once with the
 * validation errors included; if that fails too, return ok:false (needs review).
 */
export async function jsonFromClaude<S extends z.ZodType>(opts: {
  system: string;
  content: Content;
  schema: S;
  maxTokens?: number;
}): Promise<JsonResult<z.infer<S>>> {
  const usage: ClaudeUsage = { input: 0, output: 0 };
  let content = opts.content;
  let lastErr = "";
  let lastRaw: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await call(opts.system, content, opts.maxTokens ?? 16_000);
    usage.input += r.usage.input;
    usage.output += r.usage.output;
    let parsed: unknown;
    try {
      parsed = extractJson(r.text);
    } catch {
      lastErr = "Response was not valid JSON.";
      lastRaw = r.text;
      content = [...opts.content, { type: "text", text: `Your previous reply was not valid JSON. Reply with only the JSON object.` }];
      continue;
    }
    const v = opts.schema.safeParse(parsed);
    if (v.success) return { ok: true, data: v.data, usage, attempts: attempt };
    lastRaw = parsed;
    lastErr = v.error.issues.slice(0, 20).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    content = [
      ...opts.content,
      { type: "text", text: `Your previous JSON failed validation:\n${lastErr}\n\nPrevious JSON:\n${JSON.stringify(parsed).slice(0, 20_000)}\n\nReturn the corrected JSON object only.` },
    ];
  }
  return { ok: false, error: lastErr, raw: lastRaw, usage, attempts: 2 };
}

export async function textFromClaude(system: string, prompt: string, maxTokens = 4000): Promise<{ text: string; usage: ClaudeUsage }> {
  return call(system, [{ type: "text", text: prompt }], maxTokens);
}

export const pdfBlock = (bytes: Uint8Array): Anthropic.Beta.BetaContentBlockParam => ({
  type: "document",
  source: { type: "base64", media_type: "application/pdf", data: Buffer.from(bytes).toString("base64") },
});

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { env } from "../env";

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

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

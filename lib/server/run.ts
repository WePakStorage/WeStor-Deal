import "server-only";
import { ZodError } from "zod";
import type { ActionResult } from "../actions/result";
import { getContext, type Ctx } from "./context";
import { requirePro } from "./gate";

/** Wrap a server action: resolve context, optionally require Pro, normalise errors. */
export async function run<T>(fn: (ctx: Ctx) => Promise<T>, opts: { pro?: boolean } = {}): Promise<ActionResult<T>> {
  try {
    const ctx = await getContext();
    if (!ctx) return { ok: false, error: "Sign in to continue.", status: 401 };
    if (opts.pro) await requirePro(ctx.store, ctx.orgId);
    return { ok: true, data: await fn(ctx) };
  } catch (e) {
    if (e instanceof ZodError) return { ok: false, error: e.issues[0]?.message ?? "Check the form and try again.", status: 400 };
    const err = e as Error & { status?: number };
    if (!err.status) console.error(err);
    return { ok: false, error: err.message || "Something went wrong.", status: err.status ?? 500 };
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

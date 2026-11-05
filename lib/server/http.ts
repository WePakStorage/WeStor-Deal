import "server-only";
import { NextResponse } from "next/server";
import { getContext, type Ctx } from "./context";
import { requireFeature, type Feature } from "./gate";

/** Route-handler wrapper: auth, optional Pro gate (402), JSON errors. */
export async function handle(fn: (ctx: Ctx) => Promise<Response>, opts: { pro?: boolean; feature?: Feature } = {}): Promise<Response> {
  try {
    const ctx = await getContext();
    if (!ctx) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    if (opts.pro) requireFeature(ctx, "liveUnderwriting");
    if (opts.feature) requireFeature(ctx, opts.feature);
    return await fn(ctx);
  } catch (e) {
    const err = e as Error & { status?: number };
    if (!err.status) console.error(err);
    return NextResponse.json({ error: err.message || "Something went wrong." }, { status: err.status ?? 500 });
  }
}

export const csvResponse = (body: string, filename: string) =>
  new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"` } });

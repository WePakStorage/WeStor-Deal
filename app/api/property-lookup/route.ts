import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/server/http";
import { HttpError } from "@/lib/server/run";
import { lookupProperty } from "@/lib/integrations/lookup-service";
import { resolveAddress, suggestFacts } from "@/lib/integrations/rentcast";
import { ASSET_CLASSES } from "@/lib/undriq/assets";

export const runtime = "nodejs";
export const maxDuration = 30;

const input = z.object({ address: z.string().max(200).optional(), link: z.string().max(2000).optional(), asset: z.enum(ASSET_CLASSES) });

export async function POST(req: Request) {
  return handle(async (ctx) => {
    const v = input.safeParse(await req.json().catch(() => ({})));
    if (!v.success) throw new HttpError(400, "Send an address or a listing link.");
    const a = resolveAddress(v.data.address, v.data.link);
    if (!a) throw new HttpError(400, "Enter the full address like 1234 Main St, Memphis, TN 38118.");
    const { record, cached } = await lookupProperty(ctx, a);
    return NextResponse.json({ address: a, record, cached, suggested: suggestFacts(record, v.data.asset) });
  });
}

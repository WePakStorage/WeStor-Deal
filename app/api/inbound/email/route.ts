import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { spacePlanFor } from "@/lib/server/gate";
import { getAdminStore } from "@/lib/server/context";
import { inboundToken } from "@/lib/sourcing/alerts";
import { ingestAlert } from "@/lib/sourcing/ingest";

export const runtime = "nodejs";
export const maxDuration = 120;

// Accepts Resend's inbound webhook shape ({ type, data: {...} }) or a flat email object.
const addr = z.union([z.string(), z.object({ email: z.string() }).transform((o) => o.email)]);
const emailShape = z.object({
  to: z.union([addr, z.array(addr)]).transform((v) => (Array.isArray(v) ? v : [v])),
  from: addr.optional(),
  subject: z.string().optional(),
  text: z.string().optional(),
  html: z.string().optional(),
});
const payload = z.union([z.object({ data: emailShape }).transform((p) => p.data), emailShape]);

const stripHtml = (h: string) => h.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|li|h\d)>/gi, "\n\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ");

function authorized(req: Request): boolean {
  const secret = process.env.RESEND_INBOUND_SECRET;
  if (!secret) return false;
  const given = req.headers.get("x-inbound-secret") ?? new URL(req.url).searchParams.get("secret") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = payload.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unrecognised email payload" }, { status: 400 });
  const email = parsed.data;

  const token = inboundToken(email.to);
  if (!token) return NextResponse.json({ error: "No org address found" }, { status: 404 });
  const store = getAdminStore();
  const org = await store.findOrgByInboundToken(token);
  if (!org) return NextResponse.json({ error: "Unknown inbox" }, { status: 404 });
  if (!(await spacePlanFor(org.id)).features.sourcing) return NextResponse.json({ error: "Listing alerts need a paid UndrIq plan" }, { status: 402 });

  const text = email.text || (email.html ? stripHtml(email.html) : "");
  const result = await ingestAlert(store, org.id, { subject: email.subject, text }, "Listing alert");
  return NextResponse.json({ created: result.created.length, deals: result.created });
}

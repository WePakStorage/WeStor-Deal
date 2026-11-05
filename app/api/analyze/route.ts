import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/server/http";
import { HttpError } from "@/lib/server/run";
import { takeUploadedPdf } from "@/lib/server/uploads";
import { analyzeInput, runAnalysis } from "@/lib/undriq/service";

export const runtime = "nodejs";
// Large OMs take SI longer to read. Vercel caps this at the plan's limit.
export const maxDuration = 300;

/** Inline (multipart) uploads must stay under Vercel's 4.5 MB request limit; bigger PDFs go via storage. */
const MAX_INLINE_PDF = 4 * 1024 * 1024;

const isPdf = (b: Uint8Array) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;

/**
 * POST /api/analyze
 * - JSON body, optionally with `pdfPath`: a PDF the browser uploaded straight to Supabase Storage (up to 20 MB).
 * - Or multipart with `payload` (JSON) and `file` (PDF up to 4 MB): used in demo mode without storage.
 * Auth, plan quota, SI read, engine, SI memo and save all happen on the server.
 */
export async function POST(req: Request) {
  return handle(async (ctx) => {
    let raw: unknown;
    let pdf: Uint8Array | null = null;
    const type = req.headers.get("content-type") ?? "";
    if (type.startsWith("multipart/form-data")) {
      const form = await req.formData();
      raw = JSON.parse(String(form.get("payload") ?? "{}"));
      const file = form.get("file");
      if (file instanceof File && file.size > 0) {
        if (file.size > MAX_INLINE_PDF) throw new HttpError(413, "That PDF is over 4 MB. Upload a smaller version or paste the listing text.");
        const bytes = new Uint8Array(await file.arrayBuffer());
        // %PDF magic bytes: never trust the extension or the browser's MIME type.
        if (!isPdf(bytes)) throw new HttpError(415, "Upload a PDF.");
        pdf = bytes;
      }
    } else {
      raw = await req.json().catch(() => ({}));
      const pdfPath = z.object({ pdfPath: z.string().max(200).optional() }).catch({}).parse(raw).pdfPath;
      if (pdfPath) {
        if (ctx.demo) throw new HttpError(400, "Large uploads need Supabase storage, which demo mode doesn't have.");
        pdf = await takeUploadedPdf(ctx.orgId, pdfPath);
      }
    }
    const input = analyzeInput.safeParse(raw);
    if (!input.success) throw new HttpError(400, input.error.issues[0]?.message ?? "Check the form and try again.");
    const row = await runAnalysis(ctx, input.data, pdf);
    return NextResponse.json({ id: row.id });
  });
}

import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { HttpError } from "@/lib/server/run";
import { analyzeInput, runAnalysis } from "@/lib/undriq/service";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_PDF = 25 * 1024 * 1024;

/**
 * POST /api/analyze: JSON body, or multipart with `payload` (JSON) and an optional `file` (PDF).
 * Auth, plan quota, AI read, engine, AI memo and save all happen on the server.
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
        if (file.size > MAX_PDF) throw new HttpError(413, "That PDF is over 25 MB.");
        const bytes = new Uint8Array(await file.arrayBuffer());
        // %PDF magic bytes: never trust the extension or the browser's MIME type.
        if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) throw new HttpError(415, "Upload a PDF.");
        pdf = bytes;
      }
    } else {
      raw = await req.json().catch(() => ({}));
    }
    const input = analyzeInput.safeParse(raw);
    if (!input.success) throw new HttpError(400, input.error.issues[0]?.message ?? "Check the form and try again.");
    const row = await runAnalysis(ctx, input.data, pdf);
    return NextResponse.json({ id: row.id });
  });
}

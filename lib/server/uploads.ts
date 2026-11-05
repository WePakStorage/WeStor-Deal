import "server-only";
import { supabaseServer } from "../supabase/server";
import { HttpError } from "./run";

export const UPLOAD_BUCKET = "deal-files";
/** Largest PDF SI can take: base64 adds about a third, and a Claude request tops out at 32 MB. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const PATH_RE = /^[0-9a-f-]{36}\/uploads\/[0-9a-f-]{36}\.pdf$/i;

/**
 * Read a PDF the browser uploaded straight to Supabase Storage (bypassing Vercel's 4.5 MB request limit),
 * then delete it. The path must sit in the caller's active space folder; storage RLS enforces the same.
 */
export async function takeUploadedPdf(orgId: string, path: string): Promise<Uint8Array> {
  if (!PATH_RE.test(path) || !path.startsWith(`${orgId}/uploads/`)) throw new HttpError(400, "That upload isn't valid. Upload the PDF again.");
  const sb = await supabaseServer();
  const { data, error } = await sb.storage.from(UPLOAD_BUCKET).download(path);
  if (error || !data) throw new HttpError(404, "The uploaded PDF wasn't found. Upload it again.");
  const bytes = new Uint8Array(await data.arrayBuffer());
  // One-time use: the file is only needed for this analysis.
  void sb.storage.from(UPLOAD_BUCKET).remove([path]).catch(() => undefined);
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new HttpError(413, "That PDF is over 20 MB. Upload a smaller version or paste the listing text.");
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) throw new HttpError(415, "Upload a PDF.");
  return bytes;
}

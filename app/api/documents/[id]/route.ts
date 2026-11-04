import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";

export const runtime = "nodejs";

/** Download a stored document. Org ownership is checked by the store (and RLS). */
export const GET = (_req: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async ({ store, orgId }) => {
    const { id } = await params;
    const doc = await store.getDocument(orgId, id);
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const bytes = await store.getFile(doc.storage_path);
    if (!bytes) return NextResponse.json({ error: "File missing" }, { status: 404 });
    return new Response(Buffer.from(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${doc.name.replace(/"/g, "")}"`,
        "cache-control": "private, no-store",
      },
    });
  });

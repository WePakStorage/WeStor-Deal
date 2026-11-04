import { NextResponse } from "next/server";
import { z } from "zod";
import { buildOmModel, buildPreviewModel } from "@/lib/docs/models";
import { renderOmPdf, renderPreviewPdf } from "@/lib/docs/pdf";
import { canGenerateOm } from "@/lib/pipeline";
import { handle } from "@/lib/server/http";
import { HttpError } from "@/lib/server/run";
import { trackServer } from "@/lib/server/analytics";
import { DEFAULT_ASSUMPTIONS } from "@/lib/types";

export const runtime = "nodejs";

const body = z.object({ kind: z.enum(["preview", "om"]) });

/**
 * Generate a pre-contract preview or the full OM. The OM gate (contract stage
 * + signed date) is enforced here no matter what the client sends.
 */
export const POST = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(
    async ({ store, orgId, user }) => {
      const { id } = await params;
      const { kind } = body.parse(await req.json().catch(() => ({})));
      const [bundle, org] = await Promise.all([store.getDealBundle(orgId, id), store.getOrg(orgId)]);
      if (!bundle || !org) throw new HttpError(404, "Deal not found");

      let pdf: Buffer;
      if (kind === "om") {
        const gate = canGenerateOm(bundle.deal);
        if (!gate.ok) throw new HttpError(403, gate.reason);
        if (!org.disclosure_entity) throw new HttpError(400, "Add your disclosure entity in Settings before generating an OM.");
        pdf = await renderOmPdf(buildOmModel(bundle, org, org.defaults ?? DEFAULT_ASSUMPTIONS));
      } else {
        pdf = await renderPreviewPdf(buildPreviewModel(bundle, org));
      }

      const stamp = new Date().toISOString().slice(0, 10);
      const name = kind === "om" ? `${bundle.deal.name} OM ${stamp}.pdf` : `Pre-contract preview ${bundle.deal.market_state} ${stamp}.pdf`;
      const path = `${orgId}/${id}/generated/${Date.now()}-${kind}.pdf`;
      await store.putFile(path, new Uint8Array(pdf), "application/pdf");
      const doc = await store.addDocument(orgId, { deal_id: id, kind: kind === "om" ? "generated_om" : "generated_preview", name, storage_path: path, parsed: false, parse_status: "n/a", parse_error: null });
      await store.logUsage(orgId, "doc_generate", 0, 0);
      await store.logActivity({ org_id: orgId, deal_id: id, actor: user.name, action: kind === "om" ? "om_generated" : "preview_generated", payload: { doc: doc.id } });
      await trackServer(kind === "om" ? "om_generated" : "preview_generated", orgId);
      return NextResponse.json({ docId: doc.id, url: `/api/documents/${doc.id}` });
    },
    { pro: true },
  );

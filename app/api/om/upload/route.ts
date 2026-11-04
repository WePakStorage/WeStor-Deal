import { NextResponse } from "next/server";
import { jsonFromClaude, pdfBlock } from "@/lib/ai/claude";
import { isAnthropicConfigured } from "@/lib/env";
import { DEMO_EXTRACTION } from "@/lib/om/demo-extraction";
import { OM_SYSTEM_PROMPT, omExtractionSchema } from "@/lib/om/schema";
import { rateLimitAi } from "@/lib/server/gate";
import { handle } from "@/lib/server/http";
import { HttpError } from "@/lib/server/run";
import { trackServer } from "@/lib/server/analytics";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 25 * 1024 * 1024;

/** Upload a broker OM PDF, extract it with Claude, and hand back the review URL. */
export const POST = (req: Request) =>
  handle(
    async ({ store, orgId, user }) => {
      await rateLimitAi(store, orgId);
      const form = await req.formData();
      const file = form.get("file");
      const existingDealId = form.get("dealId");
      if (!(file instanceof File)) throw new HttpError(400, "Choose a PDF to upload.");
      if (file.size > MAX_BYTES) throw new HttpError(413, "That PDF is over 25 MB. Compress it or upload the key pages.");
      if (file.type && file.type !== "application/pdf") throw new HttpError(415, "Only PDF files are supported.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      // Check the magic number, not just the browser's MIME claim.
      if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new HttpError(415, "That file isn't a valid PDF.");

      let dealId = typeof existingDealId === "string" && existingDealId ? existingDealId : null;
      if (dealId) {
        if (!(await store.getDealBundle(orgId, dealId))) throw new HttpError(404, "Deal not found");
      } else {
        const draft = await store.createDeal(orgId, {
          name: file.name.replace(/\.pdf$/i, "").slice(0, 80) || "New OM",
          market_city: "", market_state: "", address: null, property_type: "drive_up",
          units: null, nrsf: null, acres: null, buildings: null, year_built: null, physical_occupancy: null,
          list_price: null, target_price: null, appraised_value: null, appraisal_date: null,
          stage: "sourced", contract_signed_at: null, contract_price: null, assignable: false,
          notes: "", is_sample: false, construction: null, listing_url: null, sources: {},
        });
        dealId = draft.id;
      }

      const path = `${orgId}/${dealId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      await store.putFile(path, bytes, "application/pdf");
      const doc = await store.addDocument(orgId, { deal_id: dealId, kind: "broker_om", name: file.name, storage_path: path, parsed: false, parse_status: "pending", parse_error: null });
      await store.logActivity({ org_id: orgId, deal_id: dealId, actor: user.name, action: "om_uploaded", payload: { name: file.name } });
      await trackServer("om_uploaded", orgId);

      if (!isAnthropicConfigured()) {
        await store.updateDocument(orgId, doc.id, { parsed: true, parse_status: "parsed", extraction: DEMO_EXTRACTION, parse_error: "Demo extraction: add ANTHROPIC_API_KEY to read real OMs." });
        await store.logUsage(orgId, "om_parse", 0, 0);
        return NextResponse.json({ dealId, docId: doc.id, status: "parsed", demo: true });
      }

      const result = await jsonFromClaude({
        system: OM_SYSTEM_PROMPT,
        content: [pdfBlock(bytes), { type: "text", text: "Extract this offering memorandum into the JSON object described. JSON only." }],
        schema: omExtractionSchema,
      });
      await store.logUsage(orgId, "om_parse", result.usage.input, result.usage.output);

      if (result.ok) {
        await store.updateDocument(orgId, doc.id, { parsed: true, parse_status: "parsed", extraction: result.data, parse_error: null });
        await trackServer("om_parsed", orgId, { attempts: result.attempts });
        return NextResponse.json({ dealId, docId: doc.id, status: "parsed" });
      }
      await store.updateDocument(orgId, doc.id, { parsed: false, parse_status: "needs_review", extraction: result.raw, parse_error: result.error });
      return NextResponse.json({ dealId, docId: doc.id, status: "needs_review", error: result.error });
    },
    { pro: true },
  );

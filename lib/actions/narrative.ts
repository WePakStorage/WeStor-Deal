"use server";

import { textFromClaude } from "../ai/claude";
import { isAnthropicConfigured } from "../env";
import { buildOmModel } from "../docs/models";
import { rateLimitAi } from "../server/gate";
import { HttpError, run } from "../server/run";
import { DEFAULT_ASSUMPTIONS } from "../types";
import type { ActionResult } from "./result";

const SYSTEM = `You write the "opportunity" section of self-storage offering memorandums for an acquisitions firm.
Write 2 to 3 short paragraphs in plain, confident, professional English. No headings, no bullet points, no hype words like "incredible" or "once-in-a-lifetime".
Use only the facts provided. Never invent numbers, tenants, demographics or market claims. Never mention a street address.`;

/** Draft the OM narrative from saved deal data. The user edits it before export. */
export async function draftNarrative(dealId: string): Promise<ActionResult<{ text: string }>> {
  return run(
    async ({ store, orgId }) => {
      const [bundle, org] = await Promise.all([store.getDealBundle(orgId, dealId), store.getOrg(orgId)]);
      if (!bundle || !org) throw new HttpError(404, "Deal not found");
      const m = buildOmModel(bundle, org, org.defaults ?? DEFAULT_ASSUMPTIONS);
      const facts = [
        `Name: ${m.title}`,
        `Market and type: ${m.subtitle}`,
        ...m.summary.map((x) => `${x.label}: ${x.value}`),
        ...m.highlights.map((h) => `Highlight: ${h}`),
        bundle.deal.construction ? `Construction: ${bundle.deal.construction}` : "",
      ].filter(Boolean).join("\n");

      if (!isAnthropicConfigured()) {
        return {
          text: `${m.title} is a ${m.subtitle.split("·")[1]?.trim().toLowerCase() ?? "self-storage"} facility in ${m.subtitle.split("·")[0]?.trim()}. ${m.highlights[0] ?? ""}\n\n${m.highlights.slice(1, 3).join(" ")}\n\nThe offering suits an operator who can bring in-place rents to market and push occupancy toward stabilized levels.`,
        };
      }
      await rateLimitAi(store, orgId);
      const r = await textFromClaude(SYSTEM, `Facts:\n${facts}\n\nWrite the opportunity section.`, 2000);
      await store.logUsage(orgId, "doc_generate", r.usage.input, r.usage.output);
      return { text: r.text.trim() };
    },
    { pro: true },
  );
}

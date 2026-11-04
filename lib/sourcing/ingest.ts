import "server-only";
import { jsonFromClaude } from "../ai/claude";
import type { Store } from "../data/store";
import { isAnthropicConfigured } from "../env";
import { capRate } from "../underwriting";
import { ALERT_SYSTEM, alertSchema, parseAlertHeuristic, type ParsedAlert } from "./alerts";

/**
 * Turn a forwarded listing-alert email into Sourced deals. Only uses the email
 * the user forwarded: never fetches or scrapes the listing site.
 */
export async function ingestAlert(store: Store, orgId: string, email: { subject?: string; text: string }, actor: string): Promise<{ created: { id: string; name: string }[] }> {
  const body = `${email.subject ?? ""}\n\n${email.text}`.slice(0, 60_000);
  let parsed: ParsedAlert;
  if (isAnthropicConfigured()) {
    const r = await jsonFromClaude({ system: ALERT_SYSTEM, content: [{ type: "text", text: body }], schema: alertSchema, maxTokens: 4000 });
    await store.logUsage(orgId, "alert_parse", r.usage.input, r.usage.output);
    parsed = r.ok ? r.data : parseAlertHeuristic(body);
  } else {
    parsed = parseAlertHeuristic(body);
  }

  const created: { id: string; name: string }[] = [];
  for (const l of parsed.listings.slice(0, 25)) {
    const noi = l.noi ?? (l.cap_rate_pct && l.price ? (l.cap_rate_pct / 100) * l.price : null);
    const deal = await store.createDeal(orgId, {
      name: l.name.slice(0, 120),
      market_city: l.city ?? "",
      market_state: (l.state ?? "").toUpperCase().slice(0, 2),
      address: null,
      property_type: /rv|boat/i.test(l.name) ? "rv_boat" : "drive_up",
      units: l.units,
      nrsf: l.nrsf,
      acres: null,
      buildings: null,
      year_built: null,
      physical_occupancy: null,
      list_price: l.price,
      target_price: l.price ? Math.round((l.price * 0.9) / 5000) * 5000 : null,
      appraised_value: null,
      appraisal_date: null,
      stage: "sourced",
      contract_signed_at: null,
      contract_price: null,
      assignable: false,
      notes: l.url ? `From listing alert: ${l.url}` : "From listing alert",
      is_sample: false,
      construction: null,
      listing_url: l.url,
      sources: { list_price: "broker_om", units: "broker_om", nrsf: "broker_om", target_price: "calculated" },
    });
    // Quick underwrite: record NOI so cap rate and the live panel work immediately.
    if (noi) {
      await store.replaceFinancials(orgId, deal.id, [
        { period: "t12", period_label: l.noi ? "Listing NOI" : "Implied from stated cap", potential_rent: null, vacancy: null, other_income: null, egi: null, expenses: [], total_expenses: null, noi, source: l.noi ? "broker_om" : "calculated" },
      ]);
    }
    await store.logActivity({
      org_id: orgId,
      deal_id: deal.id,
      actor,
      action: "alert_imported",
      payload: { subject: email.subject ?? "", cap_at_list: noi && l.price ? Number(capRate(noi, l.price).toFixed(4)) : null },
    });
    created.push({ id: deal.id, name: deal.name });
  }
  return { created };
}
